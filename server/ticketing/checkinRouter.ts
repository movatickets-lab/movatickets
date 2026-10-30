import { randomUUID } from "node:crypto";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { events, lots, orderItems, orders, ticketAuditLog, tickets } from "../../drizzle/schema";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { GATE_LEVELS, requireEventAccess } from "./access";
import { requestIp, writeSecurityAudit } from "./audit";
import { maskCpf, parseLookup } from "./helpers";

const eventId = z.string().min(1).max(36);

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  return db;
}

const candidateColumns = {
  ticketId: tickets.id,
  ticketCode: tickets.ticketCode,
  status: tickets.status,
  usedAt: tickets.usedAt,
  holderName: orderItems.holderName,
  holderCpf: orderItems.holderCpf,
  lotTitle: lots.title,
};

function toCandidate(r: { ticketId: string; ticketCode: string; status: "VALID" | "USED" | "CANCELLED"; usedAt: Date | null; holderName: string; holderCpf: string; lotTitle: string }) {
  // CPF mascarado: o operador confere o CPF completo no voucher + documento original.
  return { ticketId: r.ticketId, ticketCode: r.ticketCode, status: r.status, usedAt: r.usedAt, holderName: r.holderName, holderCpfMasked: maskCpf(r.holderCpf), lotTitle: r.lotTitle };
}

export const checkinRouter = router({
  /** Dados mínimos do evento para o cabeçalho da portaria (qualquer nível com acesso ao evento). */
  eventInfo: protectedProcedure.input(z.object({ eventId })).query(async ({ ctx, input }) => {
    await requireEventAccess(ctx.user, input.eventId, GATE_LEVELS);
    const db = await requireDb();
    const [e] = await db.select({ name: events.name, eventDate: events.eventDate, locationName: events.locationName }).from(events).where(eq(events.id, input.eventId)).limit(1);
    return e ?? null;
  }),

  /** Busca manual por CPF completo ou @Instagram, sempre escopada ao evento da portaria. */
  lookup: protectedProcedure
    .input(z.object({ eventId, query: z.string().min(3).max(60) }))
    .query(async ({ ctx, input }) => {
      await requireEventAccess(ctx.user, input.eventId, GATE_LEVELS);
      const parsed = parseLookup(input.query);
      if (!parsed) return { candidates: [], hint: "Digite o CPF completo (11 dígitos) ou o @ do Instagram." };
      const db = await requireDb();
      const match =
        parsed.kind === "cpf"
          ? inArray(orderItems.holderCpf, parsed.values)
          : inArray(sql`lower(${orderItems.holderInstagram})`, parsed.values);
      const rows = await db
        .select(candidateColumns)
        .from(tickets)
        .innerJoin(orders, eq(tickets.orderId, orders.id))
        .innerJoin(orderItems, eq(tickets.orderItemId, orderItems.id))
        .innerJoin(lots, eq(tickets.lotId, lots.id))
        .where(and(eq(orders.eventId, input.eventId), eq(orders.status, "APPROVED"), match))
        .limit(10);
      return { candidates: rows.map(toCandidate), hint: null as string | null };
    }),

  /** Leitura do QR: identifica o ingresso SEM consumi-lo. Aceita código (BL-/MT-) ou hash de verificação. */
  byCode: protectedProcedure
    .input(z.object({ eventId, code: z.string().min(6).max(80) }))
    .query(async ({ ctx, input }) => {
      await requireEventAccess(ctx.user, input.eventId, GATE_LEVELS);
      const db = await requireDb();
      const code = input.code.trim();
      const [row] = await db
        .select(candidateColumns)
        .from(tickets)
        .innerJoin(orders, eq(tickets.orderId, orders.id))
        .innerJoin(orderItems, eq(tickets.orderItemId, orderItems.id))
        .innerJoin(lots, eq(tickets.lotId, lots.id))
        .where(and(eq(orders.eventId, input.eventId), eq(orders.status, "APPROVED"), or(eq(tickets.ticketCode, code), eq(tickets.verificationHash, code))))
        .limit(1);
      // Ingresso de outro evento é indistinguível de inexistente.
      return { candidate: row ? toCandidate(row) : null };
    }),

  /** Valida a entrada. Exige confirmação explícita; trava a linha, impede reuso e audita na mesma transação. */
  validate: protectedProcedure
    .input(z.object({ eventId, ticketId: z.string().min(1).max(36), confirmedVoucherAndPhotoId: z.literal(true) }))
    .mutation(async ({ ctx, input }) => {
      const access = await requireEventAccess(ctx.user, input.eventId, GATE_LEVELS);
      const db = await requireDb();
      const ip = requestIp(ctx.req as never);
      const actor = { type: "USER", userId: ctx.user.id } as const;

      const outcome = await db.transaction(async tx => {
        const [row] = await tx
          .select({ id: tickets.id, status: tickets.status, eventId: orders.eventId, orderStatus: orders.status })
          .from(tickets)
          .innerJoin(orders, eq(tickets.orderId, orders.id))
          .where(eq(tickets.id, input.ticketId))
          .limit(1)
          .for("update");

        if (!row || row.eventId !== input.eventId) return { ok: false as const, code: "NOT_FOUND" as const };
        if (row.orderStatus !== "APPROVED") return { ok: false as const, code: "NOT_PAID" as const };

        if (row.status !== "VALID") {
          const action = row.status === "USED" ? "CHECKIN_REUSE_BLOCKED" : "CHECKIN_CANCELLED_BLOCKED";
          await tx.insert(ticketAuditLog).values({ id: randomUUID(), eventId: input.eventId, ticketId: row.id, staffAccessId: access.staffAccessId, action, detail: null });
          await writeSecurityAudit(tx, { actor, ip, action, scopeType: "TICKET", scopeId: row.id, summary: { eventId: input.eventId } });
          return { ok: false as const, code: row.status === "USED" ? ("ALREADY_USED" as const) : ("CANCELLED" as const) };
        }

        const now = new Date();
        const [res] = await tx
          .update(tickets)
          .set({ status: "USED", usedAt: now, usedByStaffId: access.staffAccessId })
          .where(and(eq(tickets.id, row.id), eq(tickets.status, "VALID")));
        if (res.affectedRows !== 1) return { ok: false as const, code: "ALREADY_USED" as const };

        await tx.insert(ticketAuditLog).values({ id: randomUUID(), eventId: input.eventId, ticketId: row.id, staffAccessId: access.staffAccessId, action: "CHECKIN_VALIDATED", detail: "voucher_e_documento_com_foto_confirmados" });
        await writeSecurityAudit(tx, { actor, ip, action: "CHECKIN_VALIDATED", scopeType: "TICKET", scopeId: row.id, summary: { eventId: input.eventId, confirmed: true } });
        return { ok: true as const, usedAt: now };
      });

      if (outcome.ok) return { success: true as const, usedAt: outcome.usedAt };
      const messages = {
        NOT_FOUND: ["NOT_FOUND", "Ingresso não encontrado neste evento."],
        NOT_PAID: ["FORBIDDEN", "Pagamento deste ingresso não está aprovado."],
        ALREADY_USED: ["CONFLICT", "Ingresso já utilizado. Entrada bloqueada."],
        CANCELLED: ["CONFLICT", "Ingresso cancelado. Entrada bloqueada."],
      } as const;
      const [code, message] = messages[outcome.code];
      throw new TRPCError({ code, message });
    }),
});
