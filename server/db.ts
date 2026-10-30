import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { InsertUser, users } from "../drizzle/schema";
import { env } from "./env";

let _db: ReturnType<typeof drizzle> | null = null;

// Pool criado sob demanda; datas ficam em UTC (a exibição usa America/Fortaleza no cliente).
export async function getDb() {
  if (!_db && env.databaseUrl()) {
    const pool = mysql.createPool({ uri: env.databaseUrl(), connectionLimit: 10, timezone: "Z" });
    _db = drizzle(pool as any);
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const { openId, ...rest } = user;
  const set: Record<string, unknown> = { lastSignedIn: new Date() };
  for (const k of ["name", "email", "loginMethod", "role"] as const) if (rest[k] !== undefined) set[k] = rest[k] ?? null;
  await db.insert(users).values({ openId, ...rest, lastSignedIn: new Date() }).onDuplicateKeyUpdate({ set });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return r[0];
}
