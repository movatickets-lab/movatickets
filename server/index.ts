import "dotenv/config";
import express from "express";
import path from "node:path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createContext } from "./_core/context";
import { googleRouter } from "./auth/google";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { pendingLegalFields } from "../shared/legal";
import { expirePendingOrders } from "./ticketing/inventory";
import { infinitePayWebhook } from "./ticketing/webhook";
import { MAX_IMAGE_BYTES, uploadImage } from "./ticketing/upload";
import { robots, seoHandler, sitemap } from "./seo";

const app = express();
app.set("trust proxy", 1); // Railway/Render: IP e protocolo reais para auditoria e cookies Secure
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});
app.use("/api", (_req, res, next) => { res.setHeader("Cache-Control", "private, no-store"); next(); });
app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.use(googleRouter);
app.post("/api/webhooks/infinitepay", express.json({ limit: "100kb" }), infinitePayWebhook);
app.post("/api/upload/:kind", express.raw({ type: ["image/png", "image/jpeg", "image/webp"], limit: MAX_IMAGE_BYTES }), uploadImage);
app.use("/api/trpc", express.json({ limit: "1mb" }), createExpressMiddleware({ router: appRouter, createContext }));

if (process.env.NODE_ENV === "production") {
  const dir = path.resolve(import.meta.dirname, "public");
  app.use("/assets", express.static(path.join(dir, "assets"), { immutable: true, maxAge: "1y" }));
  app.use(express.static(dir, { maxAge: "5m", index: false }));
  app.get("/sitemap.xml", sitemap);
  app.get("/robots.txt", robots);
  app.get("*", seoHandler(dir)); // HTML com Open Graph para evento/produtora; o resto é a SPA
}

const pending = pendingLegalFields();
if (pending.length && process.env.NODE_ENV === "production") console.warn(`[legal] Preencha shared/legal.ts antes de divulgar: ${pending.join(", ")}`);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`MOVA TICKETS em http://localhost:${port}`));

// Libera reservas vencidas (estoque volta à venda) a cada minuto.
setInterval(async () => {
  try { const db = await getDb(); if (db) await expirePendingOrders(db); } catch (e) { console.error("[expire]", e instanceof Error ? e.message : e); }
}, 60_000).unref();
