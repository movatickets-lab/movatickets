import { and, eq, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { events, staffAccess } from "../../drizzle/schema";
import { getDb } from "../db";
import type { TrpcContext } from "../_core/context";

type User = NonNullable<TrpcContext["user"]>;
export type EventAccessLevel = "SUPER_ADMIN" | "ORGANIZER" | "STAFF_PORTARIA";
export type EventAccess = { level: EventAccessLevel; staffAccessId: string | null };

const RANK: Record<EventAccessLevel, number> = { STAFF_PORTARIA: 1, ORGANIZER: 2, SUPER_ADMIN: 3 };

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  return db;
}

async function activeStaffRows(user: User) {
  const db = await requireDb();
  const email = user.email?.trim().toLowerCase();
  return db
    .select()
    .from(staffAccess)
    .where(
      and(
        eq(staffAccess.status, "ACTIVE"),
        or(eq(staffAccess.userId, user.openId), email ? eq(sql`lower(${staffAccess.email})`, email) : undefined),
      ),
    );
}

export async function isSuperAdmin(user: User): Promise<boolean> {
  if (user.role === "admin") return true;
  const rows = await activeStaffRows(user);
  return rows.some(r => r.role === "SUPER_ADMIN" && !r.organizationId && !r.eventId);
}

/** Nível de acesso do usuário a um evento, sempre decidido no servidor. null = sem acesso/inexistente. */
export async function resolveEventAccess(user: User, eventId: string): Promise<EventAccess | null> {
  const db = await requireDb();
  const [event] = await db
    .select({ id: events.id, organizationId: events.organizationId })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  if (!event) return null;

  let best: EventAccess | null = user.role === "admin" ? { level: "SUPER_ADMIN", staffAccessId: null } : null;
  for (const row of await activeStaffRows(user)) {
    let level: EventAccessLevel | null = null;
    if (row.role === "SUPER_ADMIN" && !row.organizationId && !row.eventId) level = "SUPER_ADMIN";
    else if (row.role === "ORGANIZER" && row.organizationId === event.organizationId && (!row.eventId || row.eventId === eventId)) level = "ORGANIZER";
    else if (row.role === "STAFF_PORTARIA" && row.eventId === eventId) level = "STAFF_PORTARIA";
    if (level && (!best || RANK[level] > RANK[best.level])) best = { level, staffAccessId: row.id };
  }
  return best;
}

export async function requireEventAccess(user: User, eventId: string, allowed: EventAccessLevel[]): Promise<EventAccess> {
  const access = await resolveEventAccess(user, eventId);
  // Mesma resposta para "não existe" e "sem permissão": não revela eventos de outras produtoras.
  if (!access || !allowed.includes(access.level)) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Evento não encontrado ou sem permissão." });
  }
  return access;
}

export const ADMIN_LEVELS: EventAccessLevel[] = ["SUPER_ADMIN", "ORGANIZER"];
export const GATE_LEVELS: EventAccessLevel[] = ["SUPER_ADMIN", "ORGANIZER", "STAFF_PORTARIA"];

/** Exige que o usuário seja ORGANIZER da produtora (ou SUPER_ADMIN). Resposta idêntica para inexistente/sem permissão. */
export async function requireOrgAccess(user: User, organizationId: string): Promise<void> {
  if (await isSuperAdmin(user)) return;
  const rows = await activeStaffRows(user);
  if (!rows.some(r => r.role === "ORGANIZER" && r.organizationId === organizationId)) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Produtora não encontrada ou sem permissão." });
  }
}

export async function organizerOrgIds(user: User): Promise<string[]> {
  const rows = await activeStaffRows(user);
  return Array.from(new Set(rows.filter(r => r.role === "ORGANIZER" && r.organizationId).map(r => r.organizationId!)));
}
