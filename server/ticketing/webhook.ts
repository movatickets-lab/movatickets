import { randomUUID, createHash } from "node:crypto";// @ts-nocheck
import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { orders, paymentWebhookEvents } from "../../drizzle/schema";
import { getDb } from "../db";
import { verifyAndApprove } from "./payments";

const body = z.object({
  invoice_slug: z.string().min(1).max(120),
  transaction_nsu: z.string().min(1).max(120),
  order_nsu: z.string().min(1).max(80),
}).passthrough();

/**
 * Webhook da InfinitePay. O corpo NÃO é assinado: nada aqui é confiável. Usamos apenas order_nsu/transaction_nsu/slug
 * como referência e confirmamos o pagamento por payment_check. 400 = a InfinitePay tenta reenviar (falha transitória).
 */
export async function infinitePayWebhook(req: Request, res: Response) {
  const parsed = body.safeParse(req.body);
  if (!parsed.success) return res.status(200).json({ ignored: true }); // lixo: não adianta reenviar
  const b = parsed.data;
  try {
    const db = await getDb();
    if (!db) return res.status(400).json({ error: "indisponível" });
    const [order] = await db.select({ id: orders.id }).from(orders).where(eq(orders.orderNsu, b.order_nsu)).limit(1);
    if (!order) return res.status(200).json({ ignored: true });

    const eventKey = `${b.order_nsu}:${b.transaction_nsu}`.slice(0, 180);
    const payloadHash = createHash("sha256").update(JSON.stringify({ o: b.order_nsu, t: b.transaction_nsu, s: b.invoice_slug })).digest("hex");
    await db.insert(paymentWebhookEvents).values({ id: randomUUID(), eventKey, orderId: order.id, payloadHash }).onDuplicateKeyUpdate({ set: { payloadHash } });

    const outcome = await verifyAndApprove(db, order.id, { transactionNsu: b.transaction_nsu, slug: b.invoice_slug });
    const status = outcome === "APPROVED" || outcome === "ALREADY_APPROVED" ? "VERIFIED" : "REJECTED";
    await db.update(paymentWebhookEvents).set({ status, processedAt: new Date() }).where(eq(paymentWebhookEvents.eventKey, eventKey));
    if (outcome === "NOT_PAID") return res.status(400).json({ error: "pagamento ainda não confirmado" }); // reenvio
    return res.status(200).json({ outcome });
  } catch (e) {
    console.error("[webhook:infinitepay]", e instanceof Error ? e.message : e);
    return res.status(400).json({ error: "falha ao processar" });
  }
}
