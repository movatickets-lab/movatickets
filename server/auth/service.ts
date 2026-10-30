import { createHash, randomBytes, scrypt, timingSafeEqual, type BinaryLike, type ScryptOptions } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { authRateLimits } from "../../drizzle/schema";
import type { getDb } from "../db";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
const N = 16384, R = 8, P = 1, KEYLEN = 64;

const scryptAsync = (pw: BinaryLike, salt: BinaryLike, len: number, o: ScryptOptions) =>
  new Promise<Buffer>((res, rej) => scrypt(pw, salt, len, o, (e, k) => (e ? rej(e) : res(k))));

export const normalizeAuthEmail = (e: string) => e.trim().toLowerCase();

export const passwordSchema = z.string().min(10, "A senha deve ter ao menos 10 caracteres.").max(128);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [n, r, p] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  if (![n, r, p].every(Number.isInteger) || n > 1 << 17 || r > 16 || p > 4) return false;
  try {
    const expected = Buffer.from(parts[5]!, "base64url");
    const actual = await scryptAsync(password, Buffer.from(parts[4]!, "base64url"), expected.length, { N: n, r, p });
    return expected.length > 0 && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export const generateToken = () => randomBytes(32).toString("base64url");
export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

/** Janela fixa por chave. Retorna false quando o limite foi atingido. */
export async function consumeRateLimit(db: Db, key: string, limit: number, windowMs: number): Promise<boolean> {
  const keyHash = hashToken(key);
  await db.insert(authRateLimits).values({ keyHash, windowStartedAt: new Date(), attempts: 0 }).onDuplicateKeyUpdate({ set: { keyHash } });
  return db.transaction(async tx => {
    const [row] = await tx.select().from(authRateLimits).where(eq(authRateLimits.keyHash, keyHash)).limit(1).for("update");
    const now = Date.now();
    if (!row || now - row.windowStartedAt.getTime() > windowMs) {
      await tx.update(authRateLimits).set({ windowStartedAt: new Date(now), attempts: 1 }).where(eq(authRateLimits.keyHash, keyHash));
      return true;
    }
    if (row.attempts >= limit) return false;
    await tx.update(authRateLimits).set({ attempts: row.attempts + 1 }).where(eq(authRateLimits.keyHash, keyHash));
    return true;
  });
}
