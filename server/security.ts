import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "./env";

const key = () => createHash("sha256").update(env.encryptionKey()).digest(); // 32 bytes

/** AES-256-GCM para segredos em repouso (ex.: InfiniteTag da produtora). Formato: v1.iv.tag.ct */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

export function decryptSecret(enc: string): string {
  const [v, iv, tag, ct] = enc.split(".");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Segredo em formato inválido.");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}

import { createHmac } from "node:crypto";
/** Token do voucher derivado do pedido (HMAC). Não é guardado: só o hash fica no banco; o e-mail recalcula o link. */
export const voucherToken = (orderId: string): string => createHmac("sha256", env.sessionSecret()).update(`voucher:${orderId}`).digest("base64url");
