import { randomUUID } from "node:crypto";
import { securityAuditLog } from "../../drizzle/schema";
import type { getDb } from "../db";
import { sanitizeSummary } from "./helpers";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
/** Aceita o db ou uma transação, para gravar a auditoria na MESMA transação da mudança de estado. */
export type AuditExecutor = Pick<Db, "insert">;

/** IP observado pelo servidor. Exige `app.set("trust proxy", ...)` correto atrás do proxy da plataforma. */
export function requestIp(req: { ip?: string; socket?: { remoteAddress?: string } } | undefined): string | null {
  const ip = req?.ip ?? req?.socket?.remoteAddress ?? null;
  return ip ? ip.slice(0, 45) : null;
}

export type AuditEntry = {
  actor: { type: "USER"; userId: number } | { type: "SYSTEM" };
  ip: string | null;
  action: string;
  scopeType: string;
  scopeId: string | null;
  summary?: Record<string, unknown> | null;
};

export async function writeSecurityAudit(executor: AuditExecutor, entry: AuditEntry): Promise<void> {
  await executor.insert(securityAuditLog).values({
    id: randomUUID(),
    actorType: entry.actor.type,
    actorUserId: entry.actor.type === "USER" ? entry.actor.userId : null,
    ip: entry.ip,
    action: entry.action.slice(0, 64),
    scopeType: entry.scopeType.slice(0, 32),
    scopeId: entry.scopeId,
    summary: sanitizeSummary(entry.summary),
  });
}
