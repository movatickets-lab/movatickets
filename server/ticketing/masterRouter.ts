import { and, asc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { events, organizations } from "../../drizzle/schema";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { isSuperAdmin } from "./access";
import { requestIp, writeSecurityAudit } from "./audit";
import { notifyOrgContacts, safe } from "./notify";

const masterProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!(await isSuperAdmin(ctx.user))) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito à equipe MOVA." });
  return next();
});
async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  return db;
}

/** Moderação MOVA: nada de produtora, perfil ou evento vai a público sem passar por aqui. Devolução exige motivo. */
export const masterRouter = router({
  queue: masterProcedure.query(async () => {
    const db = await requireDb();
    const [orgs, profiles, evs] = await Promise.all([
      db.select({ id: organizations.id, name: organizations.name, document: organizations.document, application: organizations.application, createdAt: organizations.createdAt }).from(organizations).where(eq(organizations.status, "PENDING_REVIEW")).orderBy(asc(organizations.createdAt)),
      db.select({ id: organizations.id, name: organizations.name, draft: organizations.profileDraft, published: organizations.profilePublished }).from(organizations).where(and(eq(organizations.status, "ACTIVE"), eq(organizations.profileStatus, "PENDING_REVIEW"))),
      db.select({ id: events.id, name: events.name, eventDate: events.eventDate, locationName: events.locationName, bannerUrl: events.bannerUrl, description: events.description, organizationName: organizations.name }).from(events).innerJoin(organizations, eq(events.organizationId, organizations.id)).where(eq(events.status, "PENDING_REVIEW")).orderBy(asc(events.createdAt)),
    ]);
    return { organizations: orgs, profiles, events: evs };
  }),

  decide: masterProcedure.input(z.object({ kind: z.enum(["organization", "profile", "event"]), id: z.string().min(1).max(36), approve: z.boolean(), note: z.string().trim().max(1000).optional() })).mutation(async ({ ctx, input }) => {
    if (!input.approve && !input.note) throw new TRPCError({ code: "BAD_REQUEST", message: "Explique o que a produtora deve corrigir." });
    const db = await requireDb();
    const note = input.approve ? null : input.note!;
    await db.transaction(async tx => {
      if (input.kind === "organization") {
        const [res] = await tx.update(organizations).set({ status: input.approve ? "ACTIVE" : "REJECTED", reviewNote: note }).where(and(eq(organizations.id, input.id), eq(organizations.status, "PENDING_REVIEW")));
        if (res.affectedRows !== 1) throw new TRPCError({ code: "CONFLICT", message: "Esta solicitação já foi decidida." });
      } else if (input.kind === "profile") {
        const [o] = await tx.select().from(organizations).where(and(eq(organizations.id, input.id), eq(organizations.profileStatus, "PENDING_REVIEW"))).limit(1).for("update");
        if (!o) throw new TRPCError({ code: "CONFLICT", message: "Este perfil já foi decidido." });
        // Aprovar publica o conteúdo REVISADO (rascunho -> publicado, incluindo contato); devolver mantém a versão vigente.
        await tx.update(organizations).set(input.approve ? { profilePublished: o.profileDraft, profileStatus: "PUBLISHED", profilePublishedAt: new Date(), profileReviewNote: null } : { profileStatus: "REJECTED", profileReviewNote: note }).where(eq(organizations.id, o.id));
      } else {
        const [res] = await tx.update(events).set({ status: input.approve ? "PUBLISHED" : "REJECTED", reviewNote: note }).where(and(eq(events.id, input.id), eq(events.status, "PENDING_REVIEW")));
        if (res.affectedRows !== 1) throw new TRPCError({ code: "CONFLICT", message: "Este evento já foi decidido." });
      }
      await writeSecurityAudit(tx, { actor: { type: "USER", userId: ctx.user.id }, ip: requestIp(ctx.req), action: `MODERATION_${input.kind.toUpperCase()}_${input.approve ? "APPROVED" : "REJECTED"}`, scopeType: input.kind.toUpperCase(), scopeId: input.id, summary: { approved: input.approve } });
    });
    const orgIdOf = input.kind === "event" ? (await db.select({ o: events.organizationId }).from(events).where(eq(events.id, input.id)).limit(1))[0]?.o : input.id;
    const label = { organization: { n: "candidatura de produtora", art: "sua", ok: "aprovada" }, profile: { n: "perfil público", art: "seu", ok: "aprovado" }, event: { n: "evento", art: "seu", ok: "aprovado" } }[input.kind];
    if (orgIdOf) await safe(() => notifyOrgContacts(db, orgIdOf,
      input.approve ? `Sua aprovação: ${label.n} — MOVA TICKETS` : `Ajustes pedidos: ${label.n} — MOVA TICKETS`,
      input.approve ? `Boa notícia: ${label.art} ${label.n} foi ${label.ok} pela equipe MOVA.` : `A equipe MOVA pediu ajustes em ${label.art} ${label.n}: ${note}`,
      "/painel", "Abrir Área da produtora"));
    return { success: true } as const;
  }),
});
