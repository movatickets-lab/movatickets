import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";// @ts-nocheck
import type { Request } from "express";
import { parse } from "cookie";
import { COOKIE_NAME } from "../../shared/const";
import { getUserByOpenId } from "../db";
import { sdk } from "./sdk";

/** Resolve o usuário autenticado a partir do cookie de sessão (usado pelo tRPC e por rotas Express). */
export async function resolveUser(req: Pick<Request, "headers">) {
  const session = await sdk.verifySession(parse(req.headers.cookie ?? "")[COOKIE_NAME]);
  let user = session ? ((await getUserByOpenId(session.openId)) ?? null) : null;
  // Reset de senha incrementa a versão e derruba sessões antigas de e-mail/senha (Google independe).
  if (user && session?.authMethod === "email" && user.passwordSessionVersion !== session.passwordSessionVersion) user = null;
  return user;
}

export async function createContext({ req, res }: CreateExpressContextOptions) {
  return { req, res, user: await resolveUser(req) };
}

export type TrpcContext = Awaited<ReturnType<typeof createContext>>;
