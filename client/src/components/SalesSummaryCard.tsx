import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Resumo financeiro do evento (MOV-01) com exportação CSV minimizada. */
export function SalesSummaryCard({ eventId }: { eventId: string }) {
  const utils = trpc.useUtils();
  const q = trpc.ticketing.salesReports.summary.useQuery({ eventId });
  const exporter = trpc.ticketing.salesReports.exportCsv.useMutation({
    onSuccess: file => {
      const url = URL.createObjectURL(new Blob([file.content], { type: file.mimeType }));
      const a = Object.assign(document.createElement("a"), { href: url, download: file.filename });
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      toast.success("Exportação gerada.");
    },
    onError: e => toast.error(e.message),
  });
  void utils;

  if (q.isLoading) return <p className="text-sm">Carregando resumo…</p>;
  if (q.error || !q.data) return <p role="alert" className="text-sm">Não foi possível carregar o resumo. Tente novamente.</p>;
  const s = q.data;

  const rows: Array<[string, string]> = [
    ["Receita bruta aprovada", brl(s.grossApprovedCents)],
    ["Comissão de afiliados", `− ${brl(s.affiliateCommissionCents)}`],
    ["Comissão do lote", `− ${brl(s.lotCommissionCents)} (não configurada)`],
    ["Receita líquida", brl(s.netCents)],
  ];

  return (
    <section className="space-y-4 rounded-lg border p-4" aria-label="Resumo do evento">
      <h2 className="text-lg font-semibold">Resumo do evento</h2>
      <dl className="grid gap-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4"><dt>{k}</dt><dd className="font-medium tabular-nums">{v}</dd></div>
        ))}
      </dl>
      <p className="text-sm tabular-nums">Pedidos: {s.orders.approved} aprovados · {s.orders.pending} pendentes · {s.orders.cancelled} cancelados</p>
      <p className="text-sm tabular-nums">Ingressos: {s.tickets.issued} emitidos · {s.tickets.used} usados</p>
      <Button variant="outline" disabled={exporter.isPending} onClick={() => exporter.mutate({ eventId })}>
        {exporter.isPending ? "Gerando…" : "Exportar CSV para conciliação"}
      </Button>
    </section>
  );
}
