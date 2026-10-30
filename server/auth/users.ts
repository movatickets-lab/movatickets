import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { users } from "../../drizzle/schema";
import { getDb, getUserByOpenId, upsertUser } from "../db";
import { env } from "../env";

/** Cria/atualiza o usuário do app. Chamar SOMENTE após o e-mail estar verificado. */
export async function ensureVerifiedUser(o: { openId?: string; email: string; name: string; loginMethod: "email" | "google" }) {
  const openId = o.openId ?? `${o.loginMethod === "google" ? "g" : "e"}_${randomUUID().replace(/-/g, "")}`;
  const role = env.superAdminEmails().includes(o.email.toLowerCase()) ? ("admin" as const) : undefined;
  await upsertUser({ openId, email: o.email, name: o.name, loginMethod: o.loginMethod, ...(role ? { role } : {}) });
  const user = await getUserByOpenId(openId);
  if (!user) throw new Error("Falha ao criar usuário.");
  return user;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(users).where(eq(users.id, id)).limit(1))[0];
}
