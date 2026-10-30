import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, isNotNull, isNull, like, lte, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { affiliates, lots, orderItems, orders, tickets } from "../../drizzle/schema";
import { protectedProcedure } from "../_core/trpc";
import { consumeRateLimit } from "../auth/service";
import { getDb } from "../db";
import { ADMIN_LEVELS, requireEventAccess } from "./access";
import { requestIp, writeSecurityAudit } from "./audit";
import { maskCpf } from "./helpers";
import { notifyOrderApproved } from "./notify";
import { toCents } from "./reports";

const eventId = z.string().min(1).max(36);
const filter = z.object({ eventId, from: z.coerce.date().optional(), to: z.coerce.date().optional() });
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }); // YYYY-MM-DD no fuso do Brasil

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  return db;
}
const safeCell = (v: string) => (/^[=+\-@\t\r]/.test(v) && !/^-?\d+(\.\d+)?$/.test(v) ? `'${v}` : v);

export const reportsExtra = {
  /** Série diária (fuso de Fortaleza) de ingressos, receita bruta e comissão de afiliados, só de pedidos aprovados. */
  timeline: protectedProcedure.input(filter).query(async ({ ctx, input }) => {
    await requireEventAccess(ctx.user, input.eventId, ADMIN_LEVELS);
    const db = await requireDb();
    const rows = await db.select({ at: orders.paymentVerifiedAt, unit: orderItems.unitAmount, commission: orderItems.commissionAmount })
      .from(orderItems).innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(eq(orders.eventId, input.eventId), eq(orders.status, "APPROVED"), isNotNull(orders.paymentVerifiedAt), input.from ? gte(orders.paymentVerifiedAt, input.from) : undefined, input.to ? lte(orders.paymentVerifiedAt, input.to) : undefined))
      .limit(100_000);
    const byDay = new Map<string, { day: string; tickets: number; grossCents: number; commissionCents: number }>();
    for (const r of rows) {
      const day = dayFmt.format(r.at!);
      const d = byDay.get(day) ?? { day, tickets: 0, grossCents: 0, commissionCents: 0 };
      d.tickets += 1; d.grossCents += toCents(r.unit); d.commissionCents += toCents(r.commission);
      byDay.set(day, d);
    }
    return Array.from(byDay.values()).sort((a, b) => a.day.localeCompare(b.day));
  }),

  /** Ocupação por lote: vendido (ingressos emitidos), reservado (aguardando pagamento) e disponível. */
  lotsOccupancy: protectedProcedure.input(z.object({ eventId })).query(async ({ ctx, input }) => {
    await requireEventAccess(ctx.user, input.eventId, ADMIN_LEVELS);
    const db = await requireDb();
    const ls = await db.select().from(lots).where(eq(lots.eventId, input.eventId)).orderBy(asc(lots.createdAt));
    const sold = await db.select({ lotId: tickets.lotId }).from(tickets).innerJoin(orders, eq(tickets.orderId, orders.id)).where(and(eq(orders.eventId, input.eventId), eq(orders.status, "APPROVED")));
    return ls.map(l => {
      const s = sold.filter(t => t.lotId === l.id).length;
      return { lotId: l.id, title: l.title, total: l.totalQuantity, sold: s, reserved: Math.max(0, l.totalQuantity - l.availableQuantity - s), available: l.availableQuantity };
    });
  }),

  /** Vendas e comissão por afiliado (somente pedidos aprovados; comissão é o valor congelado no pedido). */
  affiliatesReport: protectedProcedure.input(filter).query(async ({ ctx, input }) => {
    await requireEventAccess(ctx.user, input.eventId, ADMIN_LEVELS);
    const db = await requireDb();
    const rows = await db.select({ id: affiliates.id, name: affiliates.name, code: affiliates.code, unit: orderItems.unitAmount, commission: orderItems.commissionAmount })
      .from(orderItems).innerJoin(orders, eq(orderItems.orderId, orders.id)).innerJoin(affiliates, eq(orders.affiliateId, affiliates.id))
      .where(and(eq(orders.eventId, input.eventId), eq(orders.status, "APPROVED"), input.from ? gte(orders.createdAt, input.from) : undefined, input.to ? lte(orders.createdAt, input.to) : undefined));
    const m = new Map<string, { name: string; code: string; tickets: number; grossCents: number; commissionCents: number }>();
    for (const r of rows) {
      const a = m.get(r.id) ?? { name: r.name, code: r.code, tickets: 0, grossCents: 0, commissionCents: 0 };
      a.tickets += 1; a.grossCents += toCents(r.unit); a.commissionCents += toCents(r.commission);
      m.set(r.id, a);
    }
    return Array.from(m.values()).sort((a, b) => b.grossCents - a.grossCents);
  }),

  /** Gestão de participantes: busca por nome ou código; CPF sempre mascarado. */
  participants: protectedProcedure.input(z.object({ eventId, q: z.string().trim().max(60).optional(), offset: z.number().int().min(0).default(0) })).query(async ({ ctx, input }) => {
    await requireEventAccess(ctx.user, input.eventId, ADMIN_LEVELS);
    const db = await requireDb();
    const esc = input.q?.replace(/[\\%_]/g, m => `\\${m}`);
    const rows = await db.select({ ticketId: tickets.id, code: tickets.ticketCode, status: tickets.status, usedAt: tickets.usedAt, holderName: orderItems.holderName, holderCpf: orderItems.holderCpf, lotTitle: lots.title, orderId: orders.id })
      .from(tickets).innerJoin(orders, eq(tickets.orderId, orders.id)).innerJoin(orderItems, eq(tickets.orderItemId, orderItems.id)).innerJoin(lots, eq(tickets.lotId, lots.id))
      .where(and(eq(orders.eventId, input.eventId), eq(orders.status, "APPROVED"), esc ? or(like(orderItems.holderName, `%${esc}%`), eq(tickets.ticketCode, input.q!.toUpperCase())) : undefined))
      .orderBy(asc(orderItems.holderName)).limit(51).offset(input.offset);
    return { rows: rows.slice(0, 50).map(r => ({ ...r, holderCpf: undefined, cpfMasked: maskCpf(r.holderCpf) })), hasMore: rows.length > 50 };
  }),

  /** Reenvia o e-mail do voucher ao comprador (máx. 3 por pedido por hora). */
  resendVoucher: protectedProcedure.input(z.object({ eventId, orderId: z.string().min(1).max(36) })).mutation(async ({ ctx, input }) => {
    await requireEventAccess(ctx.user, input.eventId, ADMIN_LEVELS);
    const db = await requireDb();
    const [o] = await db.select({ id: orders.id }).from(orders).where(and(eq(orders.id, input.orderId), eq(orders.eventId, input.eventId), eq(orders.status, "APPROVED"))).limit(1);
    if (!o) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado." });
    if (!(await consumeRateLimit(db, `resend-voucher:${o.id}`, 3, 3_600_000))) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Limite de reenvios atingido. Tente em 1 hora." });
    await notifyOrderApproved(db, o.id);
    await writeSecurityAudit(db, { actor: { type: "USER", userId: ctx.user.id }, ip: requestIp(ctx.req as never), action: "VOUCHER_RESENT", scopeType: "ORDER", scopeId: o.id });
    return { success: true } as const;
  }),

  /** Pagamentos que chegaram depois da reserva expirar e sem estoque: precisam de reembolso manual na InfinitePay. */
  refunds: protectedProcedure.input(z.object({ eventId })).query(async ({ ctx, input }) => {
    await requireEventAccess(ctx.user, input.eventId, ADMIN_LEVELS);
    const db = await requireDb();
    return db.select({ orderId: orders.id, totalAmount: orders.totalAmount, transactionNsu: orders.transactionNsu, invoiceSlug: orders.invoiceSlug, paidAt: orders.paymentVerifiedAt })
      .from(orders).where(and(eq(orders.eventId, input.eventId), eq(orders.status, "CANCELLED"), isNotNull(orders.paymentVerifiedAt), isNull(orders.refundedAt))).orderBy(desc(orders.paymentVerifiedAt));
  }),
  markRefunded: protectedProcedure.input(z.object({ eventId, orderId: z.string().min(1).max(36) })).mutation(async ({ ctx, input }) => {
    await requireEventAccess(ctx.user, input.eventId, ADMIN_LEVELS);
    const db = await requireDb();
    const [res] = await db.update(orders).set({ refundedAt: new Date() }).where(and(eq(orders.id, input.orderId), eq(orders.eventId, input.eventId), eq(orders.status, "CANCELLED"), isNotNull(orders.paymentVerifiedAt), isNull(orders.refundedAt)));
    if (res.affectedRows !== 1) throw new TRPCError({ code: "NOT_FOUND", message: "Reembolso não encontrado." });
    await writeSecurityAudit(db, { actor: { type: "USER", userId: ctx.user.id }, ip: requestIp(ctx.req as never), action: "REFUND_MARKED_DONE", scopeType: "ORDER", scopeId: input.orderId });
    return { success: true } as const;
  }),

  /** XLSX para conciliação (ExcelJS no servidor). Mesmas colunas minimizadas do CSV: sem CPF, e-mail, telefone, nomes, QR/hash/token. */
  exportXlsx: protectedProcedure.input(filter).mutation(async ({ ctx, input }) => {
    await requireEventAccess(ctx.user, input.eventId, ADMIN_LEVELS);
    const db = await requireDb();
    const rows = await db.select({ orderId: orders.id, orderStatus: orders.status, createdAt: orders.createdAt, lotTitle: lots.title, unit: orderItems.unitAmount, commission: orderItems.commissionAmount, ticketStatus: tickets.status, usedAt: tickets.usedAt })
      .from(orderItems).innerJoin(orders, eq(orderItems.orderId, orders.id)).innerJoin(lots, eq(orderItems.lotId, lots.id)).leftJoin(tickets, eq(tickets.orderItemId, orderItems.id))
      .where(and(eq(orders.eventId, input.eventId), input.from ? gte(orders.createdAt, input.from) : undefined, input.to ? lte(orders.createdAt, input.to) : undefined)).orderBy(desc(orders.createdAt)).limit(50_001);
    if (rows.length > 50_000) throw new TRPCError({ code: "BAD_REQUEST", message: "Período muito grande. Reduza o intervalo de datas." });
    const { default: ExcelJS } = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Vendas");
    ws.columns = [{ header: "Pedido", key: "o", width: 38 }, { header: "Status do pedido", key: "s", width: 16 }, { header: "Criado em", key: "c", width: 20 }, { header: "Lote", key: "l", width: 28 }, { header: "Valor unitário (R$)", key: "u", width: 18 }, { header: "Comissão de afiliado (R$)", key: "a", width: 24 }, { header: "Comissão do lote (R$)", key: "k", width: 20 }, { header: "Status do ingresso", key: "t", width: 18 }, { header: "Usado em", key: "d", width: 20 }];
    ws.getRow(1).font = { bold: true };
    for (const r of rows) ws.addRow({ o: r.orderId, s: r.orderStatus, c: r.createdAt, l: safeCell(r.lotTitle), u: toCents(r.unit) / 100, a: toCents(r.commission) / 100, k: 0, t: r.ticketStatus ?? "", d: r.usedAt ?? "" });
    ws.getColumn("u").numFmt = '"R$" #,##0.00'; ws.getColumn("a").numFmt = '"R$" #,##0.00'; ws.getColumn("k").numFmt = '"R$" #,##0.00';
    ws.getColumn("c").numFmt = "dd/mm/yyyy hh:mm"; ws.getColumn("d").numFmt = "dd/mm/yyyy hh:mm";
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    await writeSecurityAudit(db, { actor: { type: "USER", userId: ctx.user.id }, ip: requestIp(ctx.req as never), action: "SALES_REPORT_EXPORTED", scopeType: "EVENT", scopeId: input.eventId, summary: { format: "XLSX", rowCount: rows.length } });
    return { filename: `vendas-${input.eventId.slice(0, 8)}-${randomUUID().slice(0, 4)}.xlsx`, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", base64: buf.toString("base64") };
  }),
};
