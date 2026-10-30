import { desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { securityAuditLog } from "../../drizzle/schema";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { isSuperAdmin } from "./access";

/** Consulta restrita: somente SUPER_ADMIN. Não existe procedure de escrita exposta ao cliente. */
export const auditRouter = router({
  list: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(50), offset: z.number().int().min(0).default(0) }))
    .query(async ({ ctx, input }) => {
      if (!(await isSuperAdmin(ctx.user))) throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito." });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      return db.select().from(securityAuditLog).orderBy(desc(securityAuditLog.createdAt)).limit(input.limit).offset(input.offset);
    }),
});
