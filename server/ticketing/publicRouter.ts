import { and, asc, desc, eq, gte, inArray, isNotNull, like, lt, or, sql } from "drizzle-orm";// @ts-nocheck
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { affiliates, events, lots, orderItems, orders, organizations, tickets } from "../../drizzle/schema";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { env } from "../env";
import { consumeRateLimit, hashToken } from "../auth/service";
import { randomUUID } from "node:crypto";
import { decryptSecret, voucherToken } from "../security";
import { createCheckoutLink } from "./infinitepay";
import { approveOrder, createPendingOrder, expirePendingOrders, releaseOrder, type NewItem } from "./inventory";
import { verifyAndApprove } from "./payments";
import { notifyOrderApproved, safe } from "./notify";
import { maskCpf } from "./helpers";
import { toCents } from "./reports";
import { formatCpf, isValidCpf, normalizeInstagram, onlyDigits, slugify } from "./util";

const HOUR = 3_600_000;
async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  return db;
}

export const producerSlugId = (org: { id: string; name: string; profilePublished: { displayName: string } | null }) =>
  `${slugify(org.profilePublished?.displayName ?? org.name)}-${org.id.slice(0, 8)}`;

const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, m => `\\${m}`)}%`;
const publicCard = (e: typeof events.$inferSelect, org: { id: string; name: string; profilePublished: { displayName: string } | null }) => ({
  id: e.id, slug: e.slug, name: e.name, bannerUrl: e.bannerUrl, locationName: e.locationName, eventDate: e.eventDate,
  producerName: org.profilePublished?.displayName ?? org.name, producerSlugId: org.profilePublished ? producerSlugId(org) : null,
});

type Priced<T> = T & { fromPriceCents: number | null; soldOut: boolean };
async function withPrices<T extends { id: string }>(db: Awaited<ReturnType<typeof requireDb>>, list: T[]): Promise<Priced<T>[]> {
  if (!list.length) return [];
  const ls = await db.select().from(lots).where(and(inArray(lots.eventId, list.map(e => e.id)), eq(lots.status, "ACTIVE")));
  return list.map(e => {
    const mine = ls.filter(l => l.eventId === e.id);
    const open = mine.filter(l => l.availableQuantity > 0);
    return { ...e, fromPriceCents: open.length ? Math.min(...open.map(l => toCents(l.price))) : null, soldOut: mine.length > 0 && open.length === 0 };
  });
}

const holder = z.object({
  name: z.string().trim().min(3).max(255), cpf: z.string().refine(isValidCpf, "CPF inválido."),
  email: z.string().trim().email().max(320), phone: z.string().refine(v => [10, 11, 12, 13].includes(onlyDigits(v).length), "Telefone inválido."),
  instagram: z.string().max(100).optional(),
});

export const eventsRouter = router({
  list: publicProcedure.input(z.object({ scope: z.enum(["upcoming", "past"]).default("upcoming") }).default({ scope: "upcoming" })).query(async ({ input }) => {
    const db = await requireDb();
    const edge = new Date(Date.now() - 6 * HOUR);
    const upcoming = input.scope === "upcoming";
    const rows = await db.select({ e: events, org: { id: organizations.id, name: organizations.name, profilePublished: organizations.profilePublished } })
      .from(events).innerJoin(organizations, eq(events.organizationId, organizations.id))
      .where(and(inArray(events.status, upcoming ? ["PUBLISHED"] : ["PUBLISHED", "FINISHED"]), upcoming ? gte(events.eventDate, edge) : lt(events.eventDate, edge), eq(organizations.status, "ACTIVE")))
      .orderBy(upcoming ? asc(events.eventDate) : desc(events.eventDate)).limit(60);
    return withPrices(db, rows.map(r => publicCard(r.e, r.org)));
  }),

  bySlug: publicProcedure.input(z.object({ slug: z.string().min(1).max(255) })).query(async ({ input }) => {
    const db = await requireDb();
    const [row] = await db.select({ e: events, org: { id: organizations.id, name: organizations.name, profilePublished: organizations.profilePublished } })
      .from(events).innerJoin(organizations, eq(events.organizationId, organizations.id))
      .where(and(eq(events.slug, input.slug), inArray(events.status, ["PUBLISHED", "FINISHED"]))).limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Evento não encontrado." });
    const ls = await db.select().from(lots).where(and(eq(lots.eventId, row.e.id), eq(lots.status, "ACTIVE"))).orderBy(asc(lots.price));
    return {
      ...publicCard(row.e, row.org), description: row.e.description, finished: row.e.status === "FINISHED",
      lots: ls.map(l => ({ id: l.id, title: l.title, description: l.description, price: l.price, available: Math.max(0, Math.min(l.availableQuantity, 10)), soldOut: l.availableQuantity <= 0 })),
    };
  }),

  /** Busca pública: SOMENTE eventos publicados e produtoras com perfil publicado. */
  search: publicProcedure.input(z.object({ q: z.string().trim().min(2).max(60) })).query(async ({ input }) => {
    const db = await requireDb();
    const p = likePattern(input.q);
    const evs = await db.select({ e: events, org: { id: organizations.id, name: organizations.name, profilePublished: organizations.profilePublished } })
      .from(events).innerJoin(organizations, eq(events.organizationId, organizations.id))
      .where(and(eq(events.status, "PUBLISHED"), eq(organizations.status, "ACTIVE"), or(like(events.name, p), like(events.locationName, p)))).orderBy(asc(events.eventDate)).limit(20);
    const orgs = await db.select({ id: organizations.id, name: organizations.name, profilePublished: organizations.profilePublished }).from(organizations)
      .where(and(eq(organizations.status, "ACTIVE"), isNotNull(organizations.profilePublished), sql`JSON_UNQUOTE(JSON_EXTRACT(${organizations.profilePublished}, '$.displayName')) LIKE ${p}`)).limit(10);
    return {
      events: await withPrices(db, evs.map(r => publicCard(r.e, r.org))),
      producers: orgs.map(o => ({ slugId: producerSlugId(o), displayName: o.profilePublished!.displayName, logoUrl: o.profilePublished!.logoUrl })),
    };
  }),
});

export const producersRouter = router({
  bySlugId: publicProcedure.input(z.object({ slugId: z.string().min(9).max(80) })).query(async ({ input }) => {
    const db = await requireDb();
    const id8 = input.slugId.slice(-8);
    if (!/^[0-9a-f]{8}$/.test(id8)) throw new TRPCError({ code: "NOT_FOUND", message: "Produtora não encontrada." });
    const [org] = await db.select().from(organizations).where(and(like(organizations.id, `${id8}%`), eq(organizations.status, "ACTIVE"), isNotNull(organizations.profilePublished))).limit(1);
    if (!org?.profilePublished) throw new TRPCError({ code: "NOT_FOUND", message: "Produtora não encontrada." });
    const edge = new Date(Date.now() - 6 * HOUR);
    const evs = await db.select().from(events).where(and(eq(events.organizationId, org.id), inArray(events.status, ["PUBLISHED", "FINISHED"]))).orderBy(desc(events.eventDate)).limit(60);
    const cards = await withPrices(db, evs.map(e => publicCard(e, org)));
    // Contato só existe no payload PUBLICADO (aprovado pela MOVA); nunca vem do rascunho nem da candidatura.
    return { slugId: producerSlugId(org), profile: org.profilePublished, upcoming: cards.filter(c => c.eventDate >= edge).reverse(), past: cards.filter(c => c.eventDate < edge) };
  }),
});

const createInput = z.object({
  eventSlug: z.string().min(1).max(255),
  items: z.array(z.object({ lotId: z.string().min(1).max(36), holders: z.array(holder).min(1).max(10) })).min(1).max(5),
  buyer: holder, affiliateCode: z.string().trim().max(32).optional(),
  acceptTerms: z.literal(true, { message: "Aceite os Termos de uso e a Política de Privacidade para continuar." }),
});

const MESSAGES: Record<string, [("CONFLICT" | "BAD_REQUEST"), string]> = {
  SOLD_OUT: ["CONFLICT", "Ingressos esgotados ou em reserva por outros compradores. Tente outra quantidade."],
  LOT_UNAVAILABLE: ["BAD_REQUEST", "Este lote não está disponível para venda."],
  LOT_NOT_FOUND: ["BAD_REQUEST", "Lote inválido para este evento."],
};

export const ordersRouter = router({
  create: publicProcedure.input(createInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    if (!(await consumeRateLimit(db, `order:${ctx.req.ip ?? "?"}`, 20, HOUR))) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Muitas tentativas. Aguarde um pouco." });
    await expirePendingOrders(db); // libera reservas vencidas antes de checar estoque
    const total = input.items.reduce((a, i) => a + i.holders.length, 0);
    if (total > 10) throw new TRPCError({ code: "BAD_REQUEST", message: "Máximo de 10 ingressos por compra." });

    const [row] = await db.select({ e: events, org: organizations }).from(events).innerJoin(organizations, eq(events.organizationId, organizations.id))
      .where(and(eq(events.slug, input.eventSlug), eq(events.status, "PUBLISHED"), eq(organizations.status, "ACTIVE"))).limit(1);
    if (!row || row.e.eventDate.getTime() < Date.now() - 6 * HOUR) throw new TRPCError({ code: "NOT_FOUND", message: "Evento indisponível para venda." });

    let affiliate: typeof affiliates.$inferSelect | undefined;
    if (input.affiliateCode) {
      [affiliate] = await db.select().from(affiliates).where(and(eq(affiliates.code, input.affiliateCode.toUpperCase()), eq(affiliates.status, "ACTIVE"), eq(affiliates.organizationId, row.org.id))).limit(1);
      if (affiliate?.eventId && affiliate.eventId !== row.e.id) affiliate = undefined; // código de outro evento: ignora
    }
    const mk = (h: z.infer<typeof holder>) => ({ name: h.name, cpf: formatCpf(onlyDigits(h.cpf)), email: h.email.toLowerCase(), phone: onlyDigits(h.phone), instagram: normalizeInstagram(h.instagram) });
    const items: NewItem[] = input.items.flatMap(i => i.holders.map(h => { const m = mk(h); return { lotId: i.lotId, holderName: m.name, holderCpf: m.cpf, holderEmail: m.email, holderPhone: m.phone, holderInstagram: m.instagram, commissionRate: affiliate?.commissionRate ?? null }; }));
    const newOrderId = randomUUID(), token = voucherToken(newOrderId);

    let created;
    try {
      created = await createPendingOrder(db, { eventId: row.e.id, affiliateId: affiliate?.id ?? null, buyer: mk(input.buyer), items, voucherTokenHash: hashToken(token), orderId: newOrderId, termsAcceptedAt: new Date() });
    } catch (e) {
      const m = MESSAGES[(e as Error).message];
      if (m) throw new TRPCError({ code: m[0], message: m[1] });
      throw e;
    }
    if (created.totalCents === 0) { await approveOrder(db, created.orderId, null); await safe(() => notifyOrderApproved(db, created.orderId)); return { orderId: created.orderId, voucherToken: token, checkoutUrl: null }; }

    if (!row.org.gatewayCredentialCiphertext) {
      await releaseOrder(db, created.orderId, "produtora_sem_infinitetag");
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A produtora ainda não configurou o recebimento. Tente mais tarde." });
    }
    try {
      const lotRows = await db.select().from(lots).where(inArray(lots.id, Array.from(new Set(items.map(i => i.lotId)))));
      const checkoutItems = lotRows.map(l => ({ quantity: items.filter(i => i.lotId === l.id).length, price: toCents(l.price), description: `${row.e.name} — ${l.title}`.slice(0, 120) }));
      const b = mk(input.buyer);
      const url = await createCheckoutLink({ handle: decryptSecret(row.org.gatewayCredentialCiphertext), orderNsu: created.orderNsu, items: checkoutItems, redirectUrl: `${env.origin()}/sucesso/${created.orderId}?vt=${token}`, webhookUrl: `${env.origin()}/api/webhooks/infinitepay`, customer: { name: b.name, email: b.email, phone: b.phone } });
      await db.update(orders).set({ infinitepayCheckoutUrl: url }).where(eq(orders.id, created.orderId));
      return { orderId: created.orderId, voucherToken: token, checkoutUrl: url };
    } catch (e) {
      console.error("[checkout]", e instanceof Error ? e.message : e);
      await releaseOrder(db, created.orderId, "falha_ao_criar_checkout");
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível iniciar o pagamento. Tente novamente." });
    }
  }),

  /** Voucher: exige o token secreto entregue na compra. Mostra CPF mascarado; cpfForFile (completo) só serve para PNG/PDF baixado. */
  voucher: publicProcedure.input(z.object({ orderId: z.string().min(1).max(36), vt: z.string().min(20).max(200) })).query(async ({ input }) => {
    const db = await requireDb();
    const [o] = await db.select({ o: orders, ev: events }).from(orders).innerJoin(events, eq(orders.eventId, events.id)).where(eq(orders.id, input.orderId)).limit(1);
    if (!o || o.o.voucherTokenHash !== hashToken(input.vt)) throw new TRPCError({ code: "NOT_FOUND", message: "Voucher não encontrado." });
    const base = { status: o.o.status, eventName: o.ev.name, eventDate: o.ev.eventDate, locationName: o.ev.locationName, expiresAt: o.o.expiresAt, checkoutUrl: o.o.status === "PENDING" ? o.o.infinitepayCheckoutUrl : null };
    if (o.o.status !== "APPROVED") return { ...base, tickets: [] };
    const ts = await db.select({ code: tickets.ticketCode, status: tickets.status, holderName: orderItems.holderName, holderCpf: orderItems.holderCpf, lotTitle: lots.title })
      .from(tickets).innerJoin(orderItems, eq(tickets.orderItemId, orderItems.id)).innerJoin(lots, eq(tickets.lotId, lots.id)).where(eq(tickets.orderId, input.orderId));
    return { ...base, tickets: ts.map(t => ({ code: t.code, status: t.status, holderName: t.holderName, lotTitle: t.lotTitle, cpfMasked: maskCpf(t.holderCpf), cpfForFile: t.holderCpf })) };
  }),

  /** Chamado pela página de retorno com os parâmetros do redirect. Eles são só referência: a aprovação exige payment_check. */
  confirm: publicProcedure.input(z.object({ orderId: z.string().min(1).max(36), vt: z.string().min(20).max(200), transactionNsu: z.string().min(1).max(120), slug: z.string().min(1).max(120) })).mutation(async ({ input }) => {
    const db = await requireDb();
    const [o] = await db.select({ h: orders.voucherTokenHash }).from(orders).where(eq(orders.id, input.orderId)).limit(1);
    if (!o || o.h !== hashToken(input.vt)) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado." });
    try { return { outcome: await verifyAndApprove(db, input.orderId, { transactionNsu: input.transactionNsu, slug: input.slug }) }; }
    catch (e) { console.error("[confirm]", e instanceof Error ? e.message : e); return { outcome: "NOT_PAID" as const }; }
  }),
});
