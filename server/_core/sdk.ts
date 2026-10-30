import { jwtVerify, SignJWT } from "jose";
import { env } from "../env";

export type SessionPayload = { openId: string; name: string; authMethod?: "email" | "google"; passwordSessionVersion?: number };
const APP_ID = "mova-tickets";
const key = () => new TextEncoder().encode(env.sessionSecret());

export const sdk = {
  async createSessionToken(
    openId: string,
    o: { name?: string; expiresInMs: number; authMethod?: "email" | "google"; passwordSessionVersion?: number },
  ): Promise<string> {
    const claims: Record<string, unknown> = { openId, appId: APP_ID, name: o.name ?? "" };
    if (o.authMethod) claims.authMethod = o.authMethod;
    if (o.passwordSessionVersion !== undefined) claims.psv = o.passwordSessionVersion;
    return new SignJWT(claims)
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt()
      .setExpirationTime(Math.floor((Date.now() + o.expiresInMs) / 1000))
      .sign(key());
  },

  async verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
      if (payload.appId !== APP_ID || typeof payload.openId !== "string" || !payload.openId) return null;
      const authMethod = payload.authMethod === "email" || payload.authMethod === "google" ? payload.authMethod : undefined;
      // Sessões de e-mail sem versão de senha são malformadas e rejeitadas.
      if (authMethod === "email" && typeof payload.psv !== "number") return null;
      return { openId: payload.openId, name: typeof payload.name === "string" ? payload.name : "", authMethod, passwordSessionVersion: typeof payload.psv === "number" ? payload.psv : undefined };
    } catch {
      return null;
    }
  },
};
