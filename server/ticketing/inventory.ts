import { randomUUID } from "node:crypto";
import { and, eq, inArray, lt } from "drizzle-orm";
import { inventoryReservations, lots, orderItems, orders, tickets } from "../../drizzle/schema";
import type { getDb } from "../db";
import { writeSecurityAudit } from "./audit";
import { TERMS_VERSION } from "../../shared/legal";
import { centsToDecimal, commissionCents, randomCode } from "./util";
import { toCents } from "./reports";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
export const RESERVATION_MS = 15 * 60_000;

const countByLot = (items: { lotId: string }[]) => {
  const m = new Map<string, number>();
  for (const i of items) m.set(i.lotId, (m.get(i.lotId) ?? 0) + 1);
  return m;
};

export type NewItem = { lotId: string; holderName: string; holderCpf: string; holderEmail: string; holderPhone: string; holderInstagram: string | null; commissionRate: string | null };

/** Reserva estoque sob lock, congela preços e comissões no servidor e cria o pedido PENDING (tudo na mesma transação). */
export async function createPendingOrder(db: Db, o: {
  eventId: string; affiliateId: string | null;
  buyer: { name: string; cpf: string; email: string; phone: string; instagram: string | null };
  items: NewItem[]; voucherTokenHash: string; orderId?: string; termsAcceptedAt?: Date;
}) {
  const wanted = countByLot(o.items);
  return db.transaction(async tx => {
    const lotRows = await tx.select().from(lots).where(and(inArray(lots.id, Array.from(wanted.keys())), eq(lots.eventId, o.eventId))).for("update");
    if (lotRows.length !== wanted.size) throw new Error("LOT_NOT_FOUND");
    let totalCents = 0;
    const priceOf = new Map<string, number>();
    for (const lot of lotRows) {
      const n = wanted.get(lot.id)!;
      if (lot.status !== "ACTIVE") throw new Error("LOT_UNAVAILABLE");
      if (lot.availableQuantity < n) throw new Error("SOLD_OUT");
      priceOf.set(lot.id, toCents(lot.price));
      totalCents += toCents(lot.price) * n;
    }
    const orderId = o.orderId ?? randomUUID(), orderNsu = randomUUID(), expiresAt = new Date(Date.now() + RESERVATION_MS);
    await tx.insert(orders).values({
      id: orderId, eventId: o.eventId, affiliateId: o.affiliateId, buyerName: o.buyer.name, buyerCpf: o.buyer.cpf, buyerEmail: o.buyer.email,
      buyerPhone: o.buyer.phone, buyerInstagram: o.buyer.instagram, totalAmount: (totalCents / 100).toFixed(2), orderNsu,
      voucherTokenHash: o.voucherTokenHash, expiresAt, termsAcceptedAt: o.termsAcceptedAt ?? null, termsVersion: o.termsAcceptedAt ? TERMS_VERSION : null,
    });
    for (const it of o.items) {
      const unit = priceOf.get(it.lotId)!;
      await tx.insert(orderItems).values({
        id: randomUUID(), orderId, lotId: it.lotId, holderName: it.holderName, holderCpf: it.holderCpf, holderEmail: it.holderEmail,
        holderPhone: it.holderPhone, holderInstagram: it.holderInstagram, unitAmount: centsToDecimal(unit),
        commissionAmount: centsToDecimal(it.commissionRate ? commissionCents(unit, it.commissionRate) : 0),
      });
    }
    for (const lot of lotRows) {
      const n = wanted.get(lot.id)!;
      await tx.update(lots).set({ availableQuantity: lot.availableQuantity - n }).where(eq(lots.id, lot.id));
      await tx.insert(inventoryReservations).values({ id: randomUUID(), orderId, lotId: lot.id, quantity: n, expiresAt });
    }
    return { orderId, orderNsu, totalCents, expiresAt };
  });
}

/** Cancela um pedido PENDING e devolve o estoque reservado. Idempotente. */
export async function releaseOrder(db: Db, orderId: string, reason: string): Promise<boolean> {
  return db.transaction(async tx => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1).for("update");
    if (!order || order.status !== "PENDING") return false;
    const res = await tx.select().from(inventoryReservations).where(and(eq(inventoryReservations.orderId, orderId), eq(inventoryReservations.status, "HELD"))).for("update");
    for (const r of res) {
      const [lot] = await tx.select().from(lots).where(eq(lots.id, r.lotId)).limit(1).for("update");
      if (lot) await tx.update(lots).set({ availableQuantity: lot.availableQuantity + r.quantity }).where(eq(lots.id, lot.id));
      await tx.update(inventoryReservations).set({ status: "RELEASED", releasedAt: new Date() }).where(eq(inventoryReservations.id, r.id));
    }
    await tx.update(orders).set({ status: "CANCELLED" }).where(eq(orders.id, orderId));
    await writeSecurityAudit(tx, { actor: { type: "SYSTEM" }, ip: null, action: "ORDER_CANCELLED", scopeType: "ORDER", scopeId: orderId, summary: { reason } });
    return true;
  });
}

export async function expirePendingOrders(db: Db): Promise<number> {
  const due = await db.select({ id: orders.id }).from(orders).where(and(eq(orders.status, "PENDING"), lt(orders.expiresAt, new Date()))).limit(50);
  let n = 0;
  for (const d of due) if (await releaseOrder(db, d.id, "reserva_expirada")) n++;
  return n;
}

export type Verified = { transactionNsu: string; invoiceSlug: string; captureMethod: string; paidAmountCents: number; amountCents: number } | null;
export type ApproveResult = "APPROVED" | "ALREADY_APPROVED" | "NOT_FOUND" | "REFUND_NEEDED";

/**
 * Aprova o pedido APÓS verificação server-side (ou pedido gratuito, verified = null), consome as reservas e emite os ingressos.
 * Pagamento que chega depois da expiração tenta reaver o estoque; sem estoque, o pedido fica marcado para reembolso manual.
 */
export async function approveOrder(db: Db, orderId: string, verified: Verified): Promise<ApproveResult> {
  return db.transaction(async tx => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1).for("update");
    if (!order) return "NOT_FOUND";
    if (order.status === "APPROVED") return "ALREADY_APPROVED";
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    const paid = verified ? { transactionNsu: verified.transactionNsu, invoiceSlug: verified.invoiceSlug, captureMethod: verified.captureMethod, paymentVerifiedAt: new Date() } : { paymentVerifiedAt: new Date() };

    if (order.status === "CANCELLED") {
      const need = countByLot(items);
      const lotRows = await tx.select().from(lots).where(inArray(lots.id, Array.from(need.keys()))).for("update");
      if (lotRows.length !== need.size || lotRows.some(l => l.availableQuantity < need.get(l.id)!)) {
        await tx.update(orders).set(paid).where(eq(orders.id, orderId)); // guarda o NSU para o reembolso
        await writeSecurityAudit(tx, { actor: { type: "SYSTEM" }, ip: null, action: "PAYMENT_AFTER_EXPIRY_REFUND_NEEDED", scopeType: "ORDER", scopeId: orderId, summary: { amountCents: verified?.amountCents ?? 0 } });
        return "REFUND_NEEDED";
      }
      for (const l of lotRows) await tx.update(lots).set({ availableQuantity: l.availableQuantity - need.get(l.id)! }).where(eq(lots.id, l.id));
    }
    await tx.update(inventoryReservations).set({ status: "CONSUMED", consumedAt: new Date() }).where(eq(inventoryReservations.orderId, orderId));

    for (const it of items) {
      let code = "";
      for (;;) {
        code = `BL-2026-${randomCode(6)}`;
        const dup = await tx.select({ id: tickets.id }).from(tickets).where(eq(tickets.ticketCode, code)).limit(1);
        if (!dup.length) break;
      }
      await tx.insert(tickets).values({ id: randomUUID(), orderId, orderItemId: it.id, lotId: it.lotId, ticketCode: code, verificationHash: `MT-${randomCode(16)}` });
    }
    const fee = verified && verified.paidAmountCents > verified.amountCents ? ((verified.paidAmountCents - verified.amountCents) / 100).toFixed(2) : null;
    await tx.update(orders).set({ ...paid, status: "APPROVED", gatewayFeeAmount: fee }).where(eq(orders.id, orderId));
    await writeSecurityAudit(tx, { actor: { type: "SYSTEM" }, ip: null, action: "ORDER_APPROVED", scopeType: "ORDER", scopeId: orderId, summary: { amountCents: verified?.amountCents ?? 0, method: verified?.captureMethod ?? "gratuito", tickets: items.length } });
    return "APPROVED";
  });
}
