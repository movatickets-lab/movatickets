import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { affiliates, events, lots, organizations, staffAccess, type ProducerProfileContent } from "../../drizzle/schema";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { encryptSecret } from "../security";
import { TERMS_VERSION } from "../../shared/legal";
import { organizerOrgIds, requireOrgAccess } from "./access";
import { notifyOrgContacts, safe } from "./notify";
import { requestIp, writeSecurityAudit } from "./audit";
import { onlyDigits, isValidCpf, isValidDocument, normalizeInfiniteTag, normalizeInstagram, randomCode, slugify, formatCpf } from "./util";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  return db;
}
const orgId = z.string().min(1).max(36);
const https = z.string().trim().url().max(500).refine(u => u.startsWith("https://"), "Use um endereço https.");
const optUrl = z.union([https, z.literal("")]).optional().transform(v => v || null);
const bad = (message: string) => new TRPCError({ code: "BAD_REQUEST", message });

async function activeOrg(db: Awaited<ReturnType<typeof requireDb>>, id: string) {
  const [o] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
  if (!o) throw new TRPCError({ code: "NOT_FOUND", message: "Produtora não encontrada." });
  if (o.status !== "ACTIVE") throw bad("A produtora ainda não foi aprovada pela MOVA.");
  return o;
}

async function eventOfOrg(db: Awaited<ReturnType<typeof requireDb>>, user: Parameters<typeof requireOrgAccess>[0], eventId: string) {
  const [e] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!e) throw new TRPCError({ code: "NOT_FOUND", message: "Evento não encontrado." });
  await requireOrgAccess(user, e.organizationId);
  return e;
}

const applyInput = z.object({
  legalName: z.string().trim().min(3).max(255), responsibleName: z.string().trim().min(3).max(255),
  document: z.string().refine(isValidDocument, "CPF ou CNPJ inválido."), email: z.string().trim().email().max(320),
  phone: z.string().refine(v => [10, 11, 12, 13].includes(onlyDigits(v).length), "Telefone inválido."),
  acceptTerms: z.literal(true, { message: "É preciso aceitar os Termos para produtoras." }), city: z.string().trim().min(2).max(120), instagram: z.string().max(100).optional(), website: optUrl, description: z.string().trim().max(1000).optional(),
});

const profileInput = z.object({
  displayName: z.string().trim().min(2).max(120), description: z.string().trim().min(20).max(2000),
  logoUrl: optUrl, coverUrl: optUrl, websiteUrl: optUrl, instagramUrl: z.string().max(100).optional(),
  contactEmail: z.string().trim().email().max(320).optional().or(z.literal("")), contactPhone: z.string().max(30).optional(),
});

export const producerRouter = router({
  /** Candidatura: privada e sem efeito público até a aprovação da MOVA. O solicitante vira ORGANIZER da própria candidatura. */
  applyProducer: protectedProcedure.input(applyInput).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const id = randomUUID(), doc = onlyDigits(input.document);
    const dup = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.document, doc)).limit(1);
    if (dup.length) throw new TRPCError({ code: "CONFLICT", message: "Já existe uma candidatura com este documento. Fale com a MOVA." });
    await db.transaction(async tx => {
      await tx.insert(organizations).values({ id, name: input.legalName, document: doc, application: { ...input, acceptTerms: undefined, termsAcceptedAt: new Date().toISOString(), termsVersion: TERMS_VERSION, document: undefined, instagram: normalizeInstagram(input.instagram), website: input.website, phone: onlyDigits(input.phone), email: input.email.toLowerCase() } as never });
      await tx.insert(staffAccess).values({ id: randomUUID(), userId: ctx.user.openId, email: (ctx.user.email ?? input.email).toLowerCase(), organizationId: id, role: "ORGANIZER" });
      await writeSecurityAudit(tx, { actor: { type: "USER", userId: ctx.user.id }, ip: requestIp(ctx.req), action: "ORG_APPLIED", scopeType: "ORGANIZATION", scopeId: id });
    });
    await safe(() => notifyOrgContacts(db, id, "Candidatura recebida — MOVA TICKETS", "Recebemos a candidatura da sua produtora. A equipe MOVA vai analisar e avisar você por e-mail.", "/painel", "Acompanhar candidatura"));
    return { organizationId: id };
  }),

  myOrganizations: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    const ids = await organizerOrgIds(ctx.user);
    if (!ids.length) return [];
    const rows = await db.select().from(organizations).where(inArray(organizations.id, ids));
    return rows.map(o => ({
      id: o.id, publicSlugId: o.profilePublished ? `${slugify(o.profilePublished.displayName)}-${o.id.slice(0, 8)}` : null, name: o.name, status: o.status, reviewNote: o.reviewNote, profileStatus: o.profileStatus, profileReviewNote: o.profileReviewNote,
      profileDraft: o.profileDraft, profilePublished: o.profilePublished, gatewayConfigured: !!o.gatewayCredentialConfiguredAt,
    }));
  }),

  profile: router({
    save: protectedProcedure.input(z.object({ organizationId: orgId, profile: profileInput })).mutation(async ({ ctx, input }) => {
      await requireOrgAccess(ctx.user, input.organizationId);
      const db = await requireDb();
      await activeOrg(db, input.organizationId);
      const p = input.profile;
      const ig = normalizeInstagram(p.instagramUrl);
      const draft: ProducerProfileContent = { displayName: p.displayName, description: p.description, logoUrl: p.logoUrl, coverUrl: p.coverUrl, websiteUrl: p.websiteUrl, instagramUrl: ig ? `https://instagram.com/${ig}` : null, contactEmail: p.contactEmail || null, contactPhone: p.contactPhone ? onlyDigits(p.contactPhone) : null };
      await db.update(organizations).set({ profileDraft: draft }).where(eq(organizations.id, input.organizationId));
      return { success: true } as const;
    }),
    /** Envia o rascunho à moderação. A versão publicada continua no ar até a aprovação. */
    submit: protectedProcedure.input(z.object({ organizationId: orgId })).mutation(async ({ ctx, input }) => {
      await requireOrgAccess(ctx.user, input.organizationId);
      const db = await requireDb();
      const o = await activeOrg(db, input.organizationId);
      if (!o.profileDraft) throw bad("Salve o perfil antes de enviar para aprovação.");
      await db.update(organizations).set({ profileStatus: "PENDING_REVIEW", profileReviewNote: null }).where(eq(organizations.id, input.organizationId));
      return { success: true } as const;
    }),
  }),

  /** A InfiniteTag da produtora é cifrada em repouso (AES-256-GCM) e nunca devolvida ao navegador. */
  gateway: router({
    set: protectedProcedure.input(z.object({ organizationId: orgId, infiniteTag: z.string().min(2).max(60) })).mutation(async ({ ctx, input }) => {
      await requireOrgAccess(ctx.user, input.organizationId);
      const tag = normalizeInfiniteTag(input.infiniteTag);
      if (!tag) throw bad("InfiniteTag inválida. Use apenas letras, números, ponto, hífen ou sublinhado (sem o $).");
      const db = await requireDb();
      await activeOrg(db, input.organizationId);
      await db.transaction(async tx => {
        await tx.update(organizations).set({ gatewayCredentialCiphertext: encryptSecret(tag), gatewayCredentialConfiguredAt: new Date() }).where(eq(organizations.id, input.organizationId));
        await writeSecurityAudit(tx, { actor: { type: "USER", userId: ctx.user.id }, ip: requestIp(ctx.req), action: "GATEWAY_TAG_CHANGED", scopeType: "ORGANIZATION", scopeId: input.organizationId });
      });
      return { success: true } as const;
    }),
  }),

  events: router({
    list: protectedProcedure.input(z.object({ organizationId: orgId })).query(async ({ ctx, input }) => {
      await requireOrgAccess(ctx.user, input.organizationId);
      const db = await requireDb();
      const evs = await db.select().from(events).where(eq(events.organizationId, input.organizationId)).orderBy(desc(events.eventDate));
      const ls = evs.length ? await db.select().from(lots).where(inArray(lots.eventId, evs.map(e => e.id))) : [];
      return evs.map(e => ({ ...e, lots: ls.filter(l => l.eventId === e.id) }));
    }),
    get: protectedProcedure.input(z.object({ eventId: orgId })).query(async ({ ctx, input }) => {
      const db = await requireDb();
      const e = await eventOfOrg(db, ctx.user, input.eventId);
      const ls = await db.select().from(lots).where(eq(lots.eventId, e.id));
      return { ...e, lots: ls };
    }),
    create: protectedProcedure.input(z.object({ organizationId: orgId, name: z.string().trim().min(3).max(255), eventDate: z.coerce.date(), locationName: z.string().trim().min(2).max(255), description: z.string().trim().max(5000).optional(), bannerUrl: optUrl })).mutation(async ({ ctx, input }) => {
      await requireOrgAccess(ctx.user, input.organizationId);
      const db = await requireDb();
      await activeOrg(db, input.organizationId);
      const id = randomUUID(), slug = `${slugify(input.name)}-${randomCode(4, "abcdefghjkmnpqrstuvwxyz23456789")}`;
      await db.insert(events).values({ id, organizationId: input.organizationId, name: input.name, slug, eventDate: input.eventDate, locationName: input.locationName, description: input.description ?? null, bannerUrl: input.bannerUrl });
      return { id, slug };
    }),
    /** Só rascunhos/devolvidos são editáveis; evento publicado não muda de dados (evita alterar o que já foi aprovado e vendido). */
    update: protectedProcedure.input(z.object({ eventId: orgId, name: z.string().trim().min(3).max(255).optional(), eventDate: z.coerce.date().optional(), locationName: z.string().trim().min(2).max(255).optional(), description: z.string().trim().max(5000).optional(), bannerUrl: optUrl })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const e = await eventOfOrg(db, ctx.user, input.eventId);
      if (!["DRAFT", "REJECTED"].includes(e.status)) throw bad("Só é possível editar eventos em rascunho ou devolvidos para ajuste.");
      const { eventId, ...rest } = input;
      const set = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
      if (Object.keys(set).length) await db.update(events).set(set).where(eq(events.id, eventId));
      return { success: true } as const;
    }),
    /** Checklist de publicação antes de enviar à moderação. */
    submit: protectedProcedure.input(z.object({ eventId: orgId })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const e = await eventOfOrg(db, ctx.user, input.eventId);
      if (!["DRAFT", "REJECTED"].includes(e.status)) throw bad("Este evento já foi enviado.");
      const org = await activeOrg(db, e.organizationId);
      const ls = await db.select().from(lots).where(and(eq(lots.eventId, e.id), eq(lots.status, "ACTIVE")));
      const missing: string[] = [];
      if (!e.bannerUrl) missing.push("banner do evento");
      if ((e.description ?? "").length < 20) missing.push("descrição (mín. 20 caracteres)");
      if (e.eventDate.getTime() < Date.now()) missing.push("data futura");
      if (!ls.length) missing.push("ao menos um lote ativo");
      if (ls.some(l => Number(l.price) > 0) && !org.gatewayCredentialConfiguredAt) missing.push("InfiniteTag para receber pagamentos");
      if (missing.length) throw bad(`Faltam: ${missing.join(", ")}.`);
      await db.update(events).set({ status: "PENDING_REVIEW", reviewNote: null }).where(eq(events.id, e.id));
      return { success: true } as const;
    }),
  }),

  lots: router({
    create: protectedProcedure.input(z.object({ eventId: orgId, title: z.string().trim().min(2).max(100), description: z.string().max(1000).optional(), price: z.number().min(0).max(100000), quantity: z.number().int().min(1).max(100000) })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const e = await eventOfOrg(db, ctx.user, input.eventId);
      if (e.status === "FINISHED") throw bad("Evento encerrado.");
      const id = randomUUID();
      await db.insert(lots).values({ id, eventId: e.id, title: input.title, description: input.description ?? null, price: input.price.toFixed(2), totalQuantity: input.quantity, availableQuantity: input.quantity });
      return { id };
    }),
    /** Preço novo vale só para pedidos futuros (itens guardam o preço congelado). Quantidade nunca fica abaixo do vendido+reservado. */
    update: protectedProcedure.input(z.object({ lotId: orgId, price: z.number().min(0).max(100000).optional(), quantity: z.number().int().min(1).max(100000).optional(), status: z.enum(["ACTIVE", "PAUSED"]).optional() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await db.transaction(async tx => {
        const [lot] = await tx.select().from(lots).where(eq(lots.id, input.lotId)).limit(1).for("update");
        if (!lot) throw new TRPCError({ code: "NOT_FOUND", message: "Lote não encontrado." });
        const e = await eventOfOrg(db, ctx.user, lot.eventId);
        if (e.status === "FINISHED") throw bad("Evento encerrado.");
        const set: Partial<typeof lots.$inferInsert> = {};
        if (input.price !== undefined) set.price = input.price.toFixed(2);
        if (input.status) set.status = input.status;
        if (input.quantity !== undefined) {
          const committed = lot.totalQuantity - lot.availableQuantity;
          if (input.quantity < committed) throw bad(`Já há ${committed} ingressos vendidos ou reservados neste lote.`);
          set.totalQuantity = input.quantity; set.availableQuantity = input.quantity - committed;
        }
        if (Object.keys(set).length) await tx.update(lots).set(set).where(eq(lots.id, lot.id));
      });
      return { success: true } as const;
    }),
  }),

  affiliates: router({
    list: protectedProcedure.input(z.object({ organizationId: orgId })).query(async ({ ctx, input }) => {
      await requireOrgAccess(ctx.user, input.organizationId);
      const db = await requireDb();
      return (await db.select().from(affiliates).where(eq(affiliates.organizationId, input.organizationId))).map(a => ({ id: a.id, name: a.name, code: a.code, commissionRate: a.commissionRate, status: a.status, eventId: a.eventId }));
    }),
    create: protectedProcedure.input(z.object({ organizationId: orgId, eventId: orgId.optional(), name: z.string().trim().min(3).max(255), cpf: z.string().refine(isValidCpf, "CPF inválido."), email: z.string().email().max(320).optional(), phone: z.string().max(30).optional(), commissionRate: z.number().min(0).max(50) })).mutation(async ({ ctx, input }) => {
      await requireOrgAccess(ctx.user, input.organizationId);
      const db = await requireDb();
      if (input.eventId) { const e = await eventOfOrg(db, ctx.user, input.eventId); if (e.organizationId !== input.organizationId) throw bad("Evento de outra produtora."); }
      const code = randomCode(8);
      await db.insert(affiliates).values({ id: randomUUID(), organizationId: input.organizationId, eventId: input.eventId ?? null, name: input.name, cpf: formatCpf(onlyDigits(input.cpf)), email: input.email ?? null, phone: input.phone ?? null, code, commissionRate: input.commissionRate.toFixed(2) });
      return { code };
    }),
    setStatus: protectedProcedure.input(z.object({ affiliateId: orgId, status: z.enum(["ACTIVE", "INACTIVE"]) })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const [a] = await db.select().from(affiliates).where(eq(affiliates.id, input.affiliateId)).limit(1);
      if (!a) throw new TRPCError({ code: "NOT_FOUND", message: "Afiliado não encontrado." });
      await requireOrgAccess(ctx.user, a.organizationId);
      await db.update(affiliates).set({ status: input.status }).where(eq(affiliates.id, a.id));
      return { success: true } as const;
    }),
  }),

  staff: router({
    list: protectedProcedure.input(z.object({ organizationId: orgId })).query(async ({ ctx, input }) => {
      await requireOrgAccess(ctx.user, input.organizationId);
      const db = await requireDb();
      return (await db.select().from(staffAccess).where(eq(staffAccess.organizationId, input.organizationId))).map(s => ({ id: s.id, email: s.email, role: s.role, eventId: s.eventId, status: s.status }));
    }),
    /** Convite por e-mail: o acesso vale quando a pessoa entra com esse e-mail verificado. Portaria exige um evento. */
    invite: protectedProcedure.input(z.object({ organizationId: orgId, email: z.string().trim().email().max(320), role: z.enum(["ORGANIZER", "STAFF_PORTARIA"]), eventId: orgId.optional() })).mutation(async ({ ctx, input }) => {
      await requireOrgAccess(ctx.user, input.organizationId);
      const db = await requireDb();
      if (input.role === "STAFF_PORTARIA") {
        if (!input.eventId) throw bad("Escolha o evento da portaria.");
        const e = await eventOfOrg(db, ctx.user, input.eventId);
        if (e.organizationId !== input.organizationId) throw bad("Evento de outra produtora.");
      }
      await db.insert(staffAccess).values({ id: randomUUID(), userId: `invite:${input.email.toLowerCase()}`, email: input.email.toLowerCase(), organizationId: input.organizationId, eventId: input.role === "STAFF_PORTARIA" ? input.eventId! : null, role: input.role });
      await writeSecurityAudit(db, { actor: { type: "USER", userId: ctx.user.id }, ip: requestIp(ctx.req), action: "STAFF_INVITED", scopeType: "ORGANIZATION", scopeId: input.organizationId, summary: { role: input.role } });
      return { success: true } as const;
    }),
    deactivate: protectedProcedure.input(z.object({ staffId: orgId })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const [s] = await db.select().from(staffAccess).where(eq(staffAccess.id, input.staffId)).limit(1);
      if (!s?.organizationId) throw new TRPCError({ code: "NOT_FOUND", message: "Acesso não encontrado." });
      await requireOrgAccess(ctx.user, s.organizationId);
      await db.update(staffAccess).set({ status: "INACTIVE" }).where(eq(staffAccess.id, s.id));
      await writeSecurityAudit(db, { actor: { type: "USER", userId: ctx.user.id }, ip: requestIp(ctx.req), action: "STAFF_DEACTIVATED", scopeType: "ORGANIZATION", scopeId: s.organizationId });
      return { success: true } as const;
    }),
  }),
});
