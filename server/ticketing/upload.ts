import type { Request, Response } from "express";// @ts-nocheck
import { z } from "zod";
import { resolveUser } from "../_core/context";
import { putPublicImage, detectImage } from "../storage";
import { requireOrgAccess } from "./access";
import { env } from "../env";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const kinds = z.enum(["logo", "cover", "banner"]);

/** POST /api/upload/:kind?organizationId=... (corpo = imagem). Autenticado, escopado à produtora, tipo validado pelos bytes. */
export async function uploadImage(req: Request, res: Response) {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ error: "Faça login para enviar imagens." });
    const kind = kinds.safeParse(req.params.kind), orgId = z.string().min(1).max(36).safeParse(req.query.organizationId);
    if (!kind.success || !orgId.success) return res.status(400).json({ error: "Requisição inválida." });
    await requireOrgAccess(user, orgId.data);
    if (!env.s3Bucket()) return res.status(503).json({ error: "Armazenamento de imagens não configurado." });
    const buf = req.body;
    if (!Buffer.isBuffer(buf) || buf.length === 0) return res.status(400).json({ error: "Envie um arquivo PNG, JPG ou WEBP de até 5 MB." });
    const img = detectImage(buf);
    if (!img) return res.status(415).json({ error: "Formato não suportado. Use PNG, JPG ou WEBP." });
    const url = await putPublicImage(`orgs/${orgId.data}/${kind.data}`, buf, img.ext, img.type);
    res.json({ url });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "NOT_FOUND") return res.status(403).json({ error: "Sem permissão para esta produtora." });
    console.error("[upload]", e instanceof Error ? e.message : e);
    res.status(500).json({ error: "Não foi possível enviar a imagem." });
  }
}
