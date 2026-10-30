import { describe, expect, it } from "vitest";
import { buildSalesSummary, toCents } from "./reports";

describe("buildSalesSummary", () => {
  it("calcula líquida = bruta aprovada − comissão afiliado − comissão de lote (0)", () => {
    const s = buildSalesSummary(
      [{ status: "APPROVED", totalAmount: "100.50" }, { status: "PENDING", totalAmount: "50.00" }, { status: "CANCELLED", totalAmount: "20.00" }],
      [{ orderStatus: "APPROVED", commissionAmount: "10.05" }, { orderStatus: "PENDING", commissionAmount: "5.00" }],
      [{ status: "VALID" }, { status: "USED" }, { status: "CANCELLED" }],
    );
    expect(s.grossApprovedCents).toBe(10050);
    expect(s.affiliateCommissionCents).toBe(1005);
    expect(s.lotCommissionCents).toBe(0);
    expect(s.netCents).toBe(9045);
    expect(s.orders).toEqual({ approved: 1, pending: 1, cancelled: 1 });
    expect(s.tickets).toEqual({ issued: 2, used: 1 });
  });
  it("converte decimais sem erro de ponto flutuante e rejeita lixo", () => {
    expect(toCents("0.10")).toBe(10);
    expect(toCents("19.9")).toBe(1990);
    expect(() => toCents("abc")).toThrow();
  });
});
