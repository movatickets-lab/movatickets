import { randomBytes, createHash } from "node:crypto";
import { Router } from "express";
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import { parse } from "cookie";
import { and, eq } from "drizzle-orm";
import { emailAuthAccounts, googleAuthIdentities, users } from "../../drizzle/schema";
import { getSessionCookieOptions } from "../_core/cookies";
import { getDb } from "../db";
import { env } from "../env";
import { hashPassword, generateToken, normalizeAuthEmail } from "./service";
import { ensureVerifiedUser, getUserById } from "./users";
import { issueSession } from "./router";

const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const FLOW_COOKIE = "mova_oauth";
const b64 = (b: Buffer) => b.toString("base64url");
const flowKey = () => new TextEncoder().encode(env.sessionSecret());
const safeReturn = (p: unknown) => (typeof p === "string" && /^\/(?![/\\])/.test(p) ? p : "/");

export const googleRouter = Router();

googleRouter.get("/api/auth/google/start", async (req, res) => {
  if (!env.googleClientId()) return res.status(503).send("Login Google não configurado.");
  const state = b64(randomBytes(24)), nonce = b64(randomBytes(24)), verifier = b64(randomBytes(48));
  const flow = await new SignJWT({ state, nonce, verifier, returnTo: safeReturn(req.query.returnTo) }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("10m").sign(flowKey());
  res.cookie(FLOW_COOKIE, flow, { ...getSessionCookieOptions(req), maxAge: 10 * 60_000 });
  const q = new URLSearchParams({
    client_id: env.googleClientId(), redirect_uri: `${env.origin()}/api/auth/google/callback`, response_type: "code",
    scope: "openid email profile", state, nonce, code_challenge: b64(createHash("sha256").update(verifier).digest()), code_challenge_method: "S256", prompt: "select_account",
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${q}`);
});

googleRouter.get("/api/auth/google/callback", async (req, res) => {
  const fail = () => res.redirect("/entrar?erro=google");
  try {
    const raw = parse(req.headers.cookie ?? "")[FLOW_COOKIE];
    res.clearCookie(FLOW_COOKIE, { ...getSessionCookieOptions(req), maxAge: -1 });
    if (!raw || typeof req.query.code !== "string" || typeof req.query.state !== "string") return fail();
    const { payload: f } = await jwtVerify(raw, flowKey(), { algorithms: ["HS256"] });
    if (f.state !== req.query.state) return fail();

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code: req.query.code, client_id: env.googleClientId(), client_secret: env.googleClientSecret(), redirect_uri: `${env.origin()}/api/auth/google/callback`, grant_type: "authorization_code", code_verifier: String(f.verifier) }),
    });
    if (!tokenRes.ok) return fail();
    const { id_token } = (await tokenRes.json()) as { id_token?: string };
    if (!id_token) return fail();
    const { payload: g } = await jwtVerify(id_token, JWKS, { issuer: ["https://accounts.google.com", "accounts.google.com"], audience: env.googleClientId() });
    if (g.nonce !== f.nonce || g.email_verified !== true || typeof g.sub !== "string" || typeof g.email !== "string") return fail();

    const db = await getDb();
    if (!db) return fail();
    const email = normalizeAuthEmail(g.email), name = typeof g.name === "string" ? g.name : email;
    let user;
    const [identity] = await db.select().from(googleAuthIdentities).where(eq(googleAuthIdentities.googleSub, g.sub)).limit(1);
    if (identity) user = await getUserById(identity.userId);
    if (!user) {
      const [account] = await db.select().from(emailAuthAccounts).where(eq(emailAuthAccounts.email, email)).limit(1);
      if (account) {
        // Mesmo e-mail verificado nos dois lados: é a mesma pessoa. Se a conta de e-mail ainda NÃO estava verificada,
        // neutraliza a senha (pode ter sido definida por terceiro) e derruba sessões antigas.
        const existing = account.userId ? await getUserById(account.userId) : undefined;
        user = await ensureVerifiedUser({ openId: existing?.openId, email, name: existing?.name ?? name, loginMethod: existing ? (existing.loginMethod === "google" ? "google" : "email") : "google" });
        if (!account.verifiedAt) {
          await db.update(emailAuthAccounts).set({ passwordHash: await hashPassword(generateToken()), verifiedAt: new Date(), userId: user.id }).where(eq(emailAuthAccounts.id, account.id));
          await db.update(users).set({ passwordSessionVersion: user.passwordSessionVersion + 1 }).where(eq(users.id, user.id));
        }
      } else {
        user = await ensureVerifiedUser({ email, name, loginMethod: "google" });
      }
      await db.insert(googleAuthIdentities).values({ googleSub: g.sub, email, userId: user.id });
    }
    if (!user) return fail();
    await issueSession(res, req, user, "google");
    res.redirect(safeReturn(f.returnTo));
  } catch (e) {
    console.error("[google-oauth]", e instanceof Error ? e.message : e);
    fail();
  }
});
