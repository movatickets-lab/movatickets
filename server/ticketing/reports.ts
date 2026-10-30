// MOV-01: cálculo puro (sem I/O) do resumo de vendas. Valores em centavos inteiros.
export type ReportOrder = { status: "PENDING" | "APPROVED" | "CANCELLED"; totalAmount: string };
export type ReportItem = { orderStatus: ReportOrder["status"]; commissionAmount: string };
export type ReportTicket = { status: "VALID" | "USED" | "CANCELLED" };

export function toCents(value: string): number {
  const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!m) throw new Error(`Valor monetário inválido: ${value}`);
  const cents = Number(m[2]) * 100 + Number((m[3] ?? "").padEnd(2, "0") || 0);
  return m[1] ? -cents : cents;
}

export const LOT_COMMISSION_CENTS = 0; // Decisão da usuária: sem taxa por lote (R$ 0,00 / não configurada).

export function buildSalesSummary(orders: ReportOrder[], items: ReportItem[], tickets: ReportTicket[]) {
  const count = (s: ReportOrder["status"]) => orders.filter(o => o.status === s).length;
  const grossApprovedCents = orders.filter(o => o.status === "APPROVED").reduce((a, o) => a + toCents(o.totalAmount), 0);
  const affiliateCommissionCents = items.filter(i => i.orderStatus === "APPROVED").reduce((a, i) => a + toCents(i.commissionAmount), 0);
  const netCents = grossApprovedCents - affiliateCommissionCents - LOT_COMMISSION_CENTS;
  const live = tickets.filter(t => t.status !== "CANCELLED");
  return {
    grossApprovedCents,
    affiliateCommissionCents,
    lotCommissionCents: LOT_COMMISSION_CENTS,
    lotCommissionConfigured: false,
    netCents,
    orders: { approved: count("APPROVED"), pending: count("PENDING"), cancelled: count("CANCELLED") },
    tickets: { issued: live.length, used: live.filter(t => t.status === "USED").length },
  };
}

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
