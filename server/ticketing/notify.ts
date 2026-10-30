import { and, eq } from "drizzle-orm";
import { events, orders, organizations, staffAccess } from "../../drizzle/schema";
import { getDb } from "../db";
import { sendMail } from "../auth/mailer";
import { env } from "../env";
import { voucherToken } from "../security";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/** Notificações nunca podem derrubar o fluxo principal: falha de e-mail só vai para o log. */
export async function safe(fn: () => Promise<unknown>): Promise<void> {
  try { await fn(); } catch (e) { console.error("[notify]", e instanceof Error ? e.message : e); }
}

/** Avisa o comprador que o pagamento foi confirmado, com o link do voucher (token recalculado, nunca armazenado). */
export async function notifyOrderApproved(db: Db, orderId: string): Promise<void> {
  const [row] = await db.select({ email: orders.buyerEmail, event: events.name }).from(orders).innerJoin(events, eq(orders.eventId, events.id)).where(eq(orders.id, orderId)).limit(1);
  if (!row) return;
  await sendMail(row.email, `Seu ingresso — ${row.event}`, `Pagamento confirmado! O voucher de ${row.event} está pronto. Guarde este e-mail: o link abre seus ingressos a qualquer momento.`, `${env.origin()}/sucesso/${orderId}?vt=${voucherToken(orderId)}`, "Ver meu voucher");
}

/** E-mail para quem gerencia a produtora (gestoras ativas + contato da candidatura), sem repetir endereços. */
export async function notifyOrgContacts(db: Db, organizationId: string, subject: string, intro: string, path: string, cta: string): Promise<void> {
  const staff = await db.select({ email: staffAccess.email }).from(staffAccess).where(and(eq(staffAccess.organizationId, organizationId), eq(staffAccess.role, "ORGANIZER"), eq(staffAccess.status, "ACTIVE")));
  const [org] = await db.select({ application: organizations.application }).from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  const to = Array.from(new Set([...staff.map(s => s.email.toLowerCase()), ...(org?.application?.email ? [org.application.email.toLowerCase()] : [])]));
  for (const addr of to) await sendMail(addr, subject, intro, `${env.origin()}${path}`, cta);
}
