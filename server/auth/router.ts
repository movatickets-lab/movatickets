import type { Request, Response } from "express";
import { and, eq, gt, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { emailAuthAccounts, emailAuthTokens, users } from "../../drizzle/schema";
import { COOKIE_NAME, SESSION_MAX_AGE_MS } from "../../shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { sdk } from "../_core/sdk";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { env } from "../env";
import { sendMail } from "./mailer";
import { TERMS_VERSION } from "../../shared/legal";
import { consumeRateLimit, generateToken, hashPassword, hashToken, normalizeAuthEmail, passwordSchema, verifyPassword } from "./service";
import { ensureVerifiedUser, getUserById } from "./users";

const HOUR = 3_600_000, DAY = 24 * HOUR;
const NEUTRAL = { ok: true as const, message: "Se o e-mail puder receber este pedido, você receberá as instruções em instantes." };
const emailSchema = z.string().trim().email().max(320);
const tooMany = () => new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Muitas tentativas. Aguarde um pouco e tente novamente." });

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  return db;
}

export async function issueSession(res: Pick<Response, "cookie">, req: Pick<Request, "protocol" | "headers">, user: { openId: string; name: string | null; passwordSessionVersion: number }, authMethod: "email" | "google") {
  const token = await sdk.createSessionToken(user.openId, { name: user.name ?? "", expiresInMs: SESSION_MAX_AGE_MS, authMethod, passwordSessionVersion: authMethod === "email" ? user.passwordSessionVersion : undefined });
  res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(req), maxAge: SESSION_MAX_AGE_MS });
}

async function newToken(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, accountId: number, purpose: "VERIFY_EMAIL" | "RESET_PASSWORD", ttlMs: number) {
  // Só o token mais recente vale: invalida os anteriores ainda não usados.
  await db.update(emailAuthTokens).set({ usedAt: new Date() }).where(and(eq(emailAuthTokens.accountId, accountId), eq(emailAuthTokens.purpose, purpose), isNull(emailAuthTokens.usedAt)));
  const token = generateToken();
  await db.insert(emailAuthTokens).values({ accountId, purpose, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ttlMs) });
  return token;
}

async function consumeToken(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, token: string, purpose: "VERIFY_EMAIL" | "RESET_PASSWORD") {
  const [row] = await db.select().from(emailAuthTokens).where(and(eq(emailAuthTokens.tokenHash, hashToken(token)), eq(emailAuthTokens.purpose, purpose), isNull(emailAuthTokens.usedAt), gt(emailAuthTokens.expiresAt, new Date()))).limit(1);
  if (!row) throw new TRPCError({ code: "BAD_REQUEST", message: "Link inválido ou expirado. Peça um novo." });
  const [res] = await db.update(emailAuthTokens).set({ usedAt: new Date() }).where(and(eq(emailAuthTokens.id, row.id), isNull(emailAuthTokens.usedAt)));
  if (res.affectedRows !== 1) throw new TRPCError({ code: "BAD_REQUEST", message: "Link inválido ou expirado. Peça um novo." });
  const [account] = await db.select().from(emailAuthAccounts).where(eq(emailAuthAccounts.id, row.accountId)).limit(1);
  if (!account) throw new TRPCError({ code: "BAD_REQUEST", message: "Link inválido ou expirado. Peça um novo." });
  return account;
}

export const authRouter = router({
  me: publicProcedure.query(({ ctx }) => (ctx.user ? { id: ctx.user.id, name: ctx.user.name, email: ctx.user.email, role: ctx.user.role, loginMethod: ctx.user.loginMethod } : null)),

  logout: publicProcedure.mutation(({ ctx }) => {
    ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
    return { success: true } as const;
  }),

  /** Passo 1: só o e-mail. Nome e senha são definidos no link, para impedir pré-cadastro malicioso com o e-mail alheio. */
  startSignup: publicProcedure.input(z.object({ email: emailSchema })).mutation(async ({ input }) => {
    const db = await requireDb();
    const email = normalizeAuthEmail(input.email);
    if (!(await consumeRateLimit(db, `signup:${email}`, 4, DAY)) || !(await consumeRateLimit(db, "mail:verify", 300, HOUR))) throw tooMany();
    let [account] = await db.select().from(emailAuthAccounts).where(eq(emailAuthAccounts.email, email)).limit(1);
    if (account?.verifiedAt) return NEUTRAL; // resposta idêntica: não revela contas existentes
    if (!account) {
      await db.insert(emailAuthAccounts).values({ email, passwordHash: await hashPassword(generateToken()) }); // senha provisória inutilizável
      [account] = await db.select().from(emailAuthAccounts).where(eq(emailAuthAccounts.email, email)).limit(1);
    }
    const token = await newToken(db, account!.id, "VERIFY_EMAIL", DAY);
    await sendMail(email, "Confirme seu e-mail — MOVA TICKETS", "Confirme seu e-mail e defina sua senha para ativar a conta.", `${env.origin()}/verificar-email?token=${token}`, "Confirmar e-mail");
    return NEUTRAL;
  }),

  /** Passo 2: link do e-mail. Define nome e senha, confirma a posse do e-mail e inicia a sessão. */
  completeSignup: publicProcedure.input(z.object({ token: z.string().min(20).max(200), name: z.string().trim().min(2).max(120), password: passwordSchema, acceptTerms: z.literal(true, { message: "É preciso aceitar os Termos de uso e a Política de Privacidade." }) })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const account = await consumeToken(db, input.token, "VERIFY_EMAIL");
    const user = await ensureVerifiedUser({ openId: account.userId ? (await getUserById(account.userId))?.openId : undefined, email: account.email, name: input.name, loginMethod: "email" });
    await db.update(emailAuthAccounts).set({ passwordHash: await hashPassword(input.password), verifiedAt: new Date(), userId: user.id }).where(eq(emailAuthAccounts.id, account.id));
    await db.update(users).set({ termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION }).where(eq(users.id, user.id));
    await issueSession(ctx.res, ctx.req, user, "email");
    return { success: true } as const;
  }),

  login: publicProcedure.input(z.object({ email: emailSchema, password: z.string().min(1).max(128) })).mutation(async ({ ctx, input }) => {
    const db = await requireDb();
    const email = normalizeAuthEmail(input.email);
    if (!(await consumeRateLimit(db, `login:${email}`, 10, 15 * 60_000)) || !(await consumeRateLimit(db, `login-ip:${ctx.req.ip ?? "?"}`, 40, 15 * 60_000))) throw tooMany();
    const [account] = await db.select().from(emailAuthAccounts).where(eq(emailAuthAccounts.email, email)).limit(1);
    // Sempre calcula o hash (mesmo sem conta) para igualar o tempo de resposta.
    const ok = await verifyPassword(input.password, account?.passwordHash ?? "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAA");
    const user = account?.userId ? await getUserById(account.userId) : undefined;
    if (!ok || !account?.verifiedAt || !user) throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha incorretos, ou e-mail ainda não confirmado." });
    await issueSession(ctx.res, ctx.req, user, "email");
    return { success: true } as const;
  }),

  requestPasswordReset: publicProcedure.input(z.object({ email: emailSchema })).mutation(async ({ input }) => {
    const db = await requireDb();
    const email = normalizeAuthEmail(input.email);
    if (!(await consumeRateLimit(db, `reset:${email}`, 3, HOUR)) || !(await consumeRateLimit(db, "mail:reset", 300, HOUR))) throw tooMany();
    const [account] = await db.select().from(emailAuthAccounts).where(eq(emailAuthAccounts.email, email)).limit(1);
    if (account?.verifiedAt) {
      const token = await newToken(db, account.id, "RESET_PASSWORD", HOUR);
      await sendMail(email, "Redefinir senha — MOVA TICKETS", "Recebemos um pedido para redefinir sua senha. O link vale por 1 hora.", `${env.origin()}/redefinir-senha?token=${token}`, "Redefinir senha");
    }
    return NEUTRAL;
  }),

  resetPassword: publicProcedure.input(z.object({ token: z.string().min(20).max(200), password: passwordSchema })).mutation(async ({ input }) => {
    const db = await requireDb();
    const account = await consumeToken(db, input.token, "RESET_PASSWORD");
    if (!account.verifiedAt || !account.userId) throw new TRPCError({ code: "BAD_REQUEST", message: "Link inválido ou expirado. Peça um novo." });
    await db.update(emailAuthAccounts).set({ passwordHash: await hashPassword(input.password) }).where(eq(emailAuthAccounts.id, account.id));
    const user = await getUserById(account.userId);
    // Incrementa a versão: invalida todas as sessões antigas de e-mail/senha (sessões Google/Manus seguem válidas).
    if (user) await db.update(users).set({ passwordSessionVersion: user.passwordSessionVersion + 1 }).where(eq(users.id, user.id));
    return { success: true } as const;
  }),
});
