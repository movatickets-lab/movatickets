import type { Request } from "express";// @ts-nocheck

export function getSessionCookieOptions(req: Pick<Request, "protocol" | "headers">) {
  const proto = String(req.headers["x-forwarded-proto"] ?? "").split(",")[0]?.trim();
  const secure = req.protocol === "https" || proto === "https";
  // Lax: o app é same-origin; Lax protege contra CSRF e ainda permite o retorno do login Google.
  return { httpOnly: true, path: "/", sameSite: "lax" as const, secure };
}
