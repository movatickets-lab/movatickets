import { eq } from "drizzle-orm";
import { events, orders, organizations } from "../../drizzle/schema";
import type { getDb } from "../db";
import { writeSecurityAudit } from "./audit";
import { notifyOrderApproved, safe } from "./notify";
import { approveOrder, type ApproveResult } from "./inventory";
import { paymentCheck } from "./infinitepay";
import { toCents } from "./reports";
import { decryptSecret } from "../security";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type VerifyOutcome = ApproveResult | "NOT_PAID" | "AMOUNT_MISMATCH" | "NO_GATEWAY";

/**
 * Confirma o pagamento direto na InfinitePay (payment_check) usando a InfiniteTag DA PRODUTORA dona do evento,
 * exige paid=true e valor igual ao do pedido local, e só então aprova. É a única porta de aprovação paga.
 */
export async function verifyAndApprove(db: Db, orderId: string, ref: { transactionNsu: string; slug: string }): Promise<VerifyOutcome> {
  const [row] = await db
    .select({ order: orders, cipher: organizations.gatewayCredentialCiphertext })
    .from(orders).innerJoin(events, eq(orders.eventId, events.id)).innerJoin(organizations, eq(events.organizationId, organizations.id))
    .where(eq(orders.id, orderId)).limit(1);
  if (!row) return "NOT_FOUND";
  if (row.order.status === "APPROVED") return "ALREADY_APPROVED";
  if (!row.cipher) return "NO_GATEWAY";

  const check = await paymentCheck({ handle: decryptSecret(row.cipher), orderNsu: row.order.orderNsu, transactionNsu: ref.transactionNsu, slug: ref.slug });
  if (!check.success || !check.paid) return "NOT_PAID";
  if (check.amount !== toCents(row.order.totalAmount)) {
    await writeSecurityAudit(db, { actor: { type: "SYSTEM" }, ip: null, action: "PAYMENT_AMOUNT_MISMATCH", scopeType: "ORDER", scopeId: orderId, summary: { expectedCents: toCents(row.order.totalAmount), receivedCents: check.amount } });
    return "AMOUNT_MISMATCH";
  }
  const result = await approveOrder(db, orderId, { transactionNsu: ref.transactionNsu, invoiceSlug: ref.slug, captureMethod: check.capture_method ?? "desconhecido", paidAmountCents: check.paid_amount, amountCents: check.amount });
  if (result === "APPROVED") await safe(() => notifyOrderApproved(db, orderId));
  return result;
}
