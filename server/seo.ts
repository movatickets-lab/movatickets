import { readFileSync } from "node:fs";
import path from "node:path";
import type { Request, RequestHandler, Response } from "express";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { events, organizations } from "../drizzle/schema";
import { getDb } from "./db";
import { env } from "./env";
import { producerSlugId } from "./ticketing/publicRouter";

const RESERVED = new Set(["entrar", "esqueci-senha", "verificar-email", "redefinir-senha", "cadastro", "produtora", "sucesso", "painel", "portaria", "master", "assets", "api", "privacidade", "termos", "termos-produtoras"]);
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

type Meta = { title: string; description: string; image?: string | null; path: string };

function inject(html: string, m: Meta): string {
  const url = `${env.origin()}${m.path}`;
  const tags = [
    `<meta property="og:title" content="${esc(m.title)}" />`, `<meta property="og:description" content="${esc(m.description)}" />`,
    `<meta property="og:type" content="website" />`, `<meta property="og:url" content="${esc(url)}" />`,
    ...(m.image ? [`<meta property="og:image" content="${esc(m.image)}" />`] : []),
    `<meta name="twitter:card" content="${m.image ? "summary_large_image" : "summary"}" />`, `<meta name="twitter:title" content="${esc(m.title)}" />`, `<meta name="twitter:description" content="${esc(m.description)}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
  ].join("\n    ");
  return html
    .replace(/<meta property="og:(title|description|type)"[^>]*>\s*/g, "")
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(m.description)}" />`)
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(m.title)}</title>`)
    .replace("</head>", `    ${tags}\n  </head>`);
}

async function metaFor(p: string): Promise<Meta | null> {
  const db = await getDb();
  if (!db) return null;
  const seg = p.split("/").filter(Boolean);
  if (seg[0] === "produtora" && seg[1]) {
    const id8 = seg[1].slice(-8);
    if (!/^[0-9a-f]{8}$/.test(id8)) return null;
    const rows = await db.select().from(organizations).where(and(eq(organizations.status, "ACTIVE"), isNotNull(organizations.profilePublished)));
    const o = rows.find(r => r.id.startsWith(id8));
    if (!o?.profilePublished) return null;
    const pr = o.profilePublished;
    return { title: `${pr.displayName} — MOVA TICKETS`, description: cut(pr.description, 180), image: pr.coverUrl ?? pr.logoUrl, path: `/produtora/${producerSlugId(o)}` };
  }
  if (seg.length === 1 && !RESERVED.has(seg[0]!)) {
    const [e] = await db.select().from(events).where(and(eq(events.slug, seg[0]!), inArray(events.status, ["PUBLISHED", "FINISHED"]))).limit(1);
    if (!e) return null;
    const when = e.eventDate.toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Fortaleza" });
    return { title: `${e.name} — MOVA TICKETS`, description: cut(`${when} · ${e.locationName ?? ""}. ${e.description ?? "Garanta seu ingresso nominal."}`, 180), image: e.bannerUrl, path: `/${e.slug}` };
  }
  return null;
}

/** HTML inicial com título, descrição e imagem sociais reais (WhatsApp, Instagram, Google) para eventos e produtoras. */
export function seoHandler(dir: string): RequestHandler {
  const base = readFileSync(path.join(dir, "index.html"), "utf8");
  return async (req: Request, res: Response) => {
    let html = base;
    try { const m = await metaFor(req.path); if (m) html = inject(base, m); } catch (e) { console.error("[seo]", e instanceof Error ? e.message : e); }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60");
    res.send(html);
  };
}

export async function sitemap(_req: Request, res: Response) {
  const db = await getDb();
  const urls: Array<{ loc: string; lastmod?: Date }> = [{ loc: env.origin() + "/" }];
  if (db) {
    for (const e of await db.select({ slug: events.slug, u: events.updatedAt }).from(events).innerJoin(organizations, eq(events.organizationId, organizations.id)).where(and(eq(events.status, "PUBLISHED"), eq(organizations.status, "ACTIVE"))).limit(5000)) urls.push({ loc: `${env.origin()}/${e.slug}`, lastmod: e.u });
    for (const o of await db.select().from(organizations).where(and(eq(organizations.status, "ACTIVE"), isNotNull(organizations.profilePublished))).limit(5000)) urls.push({ loc: `${env.origin()}/produtora/${producerSlugId(o)}`, lastmod: o.profilePublishedAt ?? undefined });
  }
  res.type("application/xml").setHeader("Cache-Control", "public, max-age=3600");
  res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod.toISOString()}</lastmod>` : ""}</url>`).join("\n")}\n</urlset>`);
}

export const robots: RequestHandler = (_req, res) => {
  res.type("text/plain").send(`User-agent: *\nAllow: /\nDisallow: /painel\nDisallow: /master\nDisallow: /portaria\nDisallow: /sucesso\nDisallow: /api\n\nSitemap: ${env.origin()}/sitemap.xml\n`);
};
