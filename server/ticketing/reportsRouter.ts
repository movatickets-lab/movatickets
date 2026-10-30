import { and, desc, eq, gte, lte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { lots, orderItems, orders, tickets } from "../../drizzle/schema";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { ADMIN_LEVELS, requireEventAccess } from "./access";
import { requestIp, writeSecurityAudit } from "./audit";
import { csvRow } from "./helpers";
import { buildSalesSummary } from "./reports";
import { reportsExtra } from "./reportsExtra";

const filter = z.object({
  eventId: z.string().min(1).max(36),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const MAX_EXPORT_ROWS = 50_000;

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  return db;
}

const periodWhere = (i: z.infer<typeof filter>) =>
  and(eq(orders.eventId, i.eventId), i.from ? gte(orders.createdAt, i.from) : undefined, i.to ? lte(orders.createdAt, i.to) : undefined);

export const reportsRouter = router({
  summary: protectedProcedure.input(filter).query(async ({ ctx, input }) => {
    await requireEventAccess(ctx.user, input.eventId, ADMIN_LEVELS);
    const db = await requireDb();
    const where = periodWhere(input);
    const [orderRows, itemRows, ticketRows] = await Promise.all([
      db.select({ status: orders.status, totalAmount: orders.totalAmount }).from(orders).where(where),
      db.select({ orderStatus: orders.status, commissionAmount: orderItems.commissionAmount }).from(orderItems).innerJoin(orders, eq(orderItems.orderId, orders.id)).where(where),
      db.select({ status: tickets.status }).from(tickets).innerJoin(orders, eq(tickets.orderId, orders.id)).where(where),
    ]);
    return { ...buildSalesSummary(orderRows, itemRows, ticketRows), period: { from: input.from ?? null, to: input.to ?? null } };
  }),

  /** CSV minimizado para conciliação: sem CPF, e-mail, telefone, nomes, QR/hash/token ou URL de checkout. */
  exportCsv: protectedProcedure.input(filter).mutation(async ({ ctx, input }) => {
    await requireEventAccess(ctx.user, input.eventId, ADMIN_LEVELS);
    const db = await requireDb();
    const rows = await db
      .select({
        orderId: orders.id,
        orderStatus: orders.status,
        orderCreatedAt: orders.createdAt,
        lotTitle: lots.title,
        unitAmount: orderItems.unitAmount,
        commissionAmount: orderItems.commissionAmount,
        ticketStatus: tickets.status,
        usedAt: tickets.usedAt,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(lots, eq(orderItems.lotId, lots.id))
      .leftJoin(tickets, eq(tickets.orderItemId, orderItems.id))
      .where(periodWhere(input))
      .orderBy(desc(orders.createdAt))
      .limit(MAX_EXPORT_ROWS + 1);
    if (rows.length > MAX_EXPORT_ROWS) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Período muito grande. Reduza o intervalo de datas." });
    }

    const header = ["pedido", "status_pedido", "criado_em", "lote", "valor_unitario", "comissao_afiliado", "comissao_lote", "status_ingresso", "usado_em"];
    const lines = [csvRow(header)];
    for (const r of rows) {
      lines.push(csvRow([r.orderId, r.orderStatus, r.orderCreatedAt.toISOString(), r.lotTitle, r.unitAmount, r.commissionAmount, "0.00", r.ticketStatus ?? "", r.usedAt?.toISOString() ?? ""]));
    }

    await writeSecurityAudit(db, {
      actor: { type: "USER", userId: ctx.user.id },
      ip: requestIp(ctx.req as never),
      action: "SALES_REPORT_EXPORTED",
      scopeType: "EVENT",
      scopeId: input.eventId,
      summary: { format: "CSV", rowCount: rows.length },
    });

    return { filename: `vendas-${input.eventId.slice(0, 8)}.csv`, mimeType: "text/csv;charset=utf-8", content: `\uFEFF${lines.join("\r\n")}\r\n` };
  }),
  ...reportsExtra,
});
