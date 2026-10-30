import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadBase64, downloadText } from "@/lib/download";
import { trpc } from "@/lib/trpc";

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const DAY = 86_400_000;
const PERIODS = [["7", "Últimos 7 dias"], ["30", "Últimos 30 dias"], ["all", "Todo o período"]] as const;

function delta(cur: number, prev: number | undefined) {
  if (prev === undefined) return null;
  if (prev === 0) return cur === 0 ? "sem variação" : "novo (período anterior sem vendas)";
  const p = ((cur - prev) / prev) * 100;
  return `${p > 0 ? "▲ +" : p < 0 ? "▼ " : "= "}${p.toFixed(1).replace(".", ",")}% vs período anterior`;
}

export function ReportsPanel({ eventId }: { eventId: string }) {
  const utils = trpc.useUtils();
  const [period, setPeriod] = useState<(typeof PERIODS)[number][0]>("30");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);

  const range = useMemo(() => {
    if (period === "all") return { cur: { eventId }, prev: null, days: 0, from: null as Date | null };
    const n = Number(period), today = new Date(); today.setHours(0, 0, 0, 0);
    const from = new Date(today.getTime() - (n - 1) * DAY);
    return { cur: { eventId, from }, prev: { eventId, from: new Date(from.getTime() - n * DAY), to: new Date(from.getTime() - 1) }, days: n, from };
  }, [period, eventId]);

  const cur = trpc.ticketing.salesReports.summary.useQuery(range.cur);
  const prev = trpc.ticketing.salesReports.summary.useQuery(range.prev ?? { eventId }, { enabled: !!range.prev });
  const line = trpc.ticketing.salesReports.timeline.useQuery(range.cur);
  const occ = trpc.ticketing.salesReports.lotsOccupancy.useQuery({ eventId });
  const aff = trpc.ticketing.salesReports.affiliatesReport.useQuery(range.cur);
  const people = trpc.ticketing.salesReports.participants.useQuery({ eventId, q: q || undefined, offset });
  const refunds = trpc.ticketing.salesReports.refunds.useQuery({ eventId });
  const csv = trpc.ticketing.salesReports.exportCsv.useMutation({ onSuccess: f => downloadText(f.filename, f.mimeType, f.content), onError: e => toast.error(e.message) });
  const xlsx = trpc.ticketing.salesReports.exportXlsx.useMutation({ onSuccess: f => downloadBase64(f.filename, f.mimeType, f.base64), onError: e => toast.error(e.message) });
  const resend = trpc.ticketing.salesReports.resendVoucher.useMutation({ onSuccess: () => toast.success("Voucher reenviado por e-mail."), onError: e => toast.error(e.message) });
  const refunded = trpc.ticketing.salesReports.markRefunded.useMutation({ onSuccess: () => void utils.ticketing.salesReports.refunds.invalidate(), onError: e => toast.error(e.message) });

  const series = useMemo(() => {
    const m = new Map((line.data ?? []).map(d => [d.day, d]));
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" });
    const days = range.from ? Array.from({ length: range.days }, (_, i) => fmt.format(new Date(range.from!.getTime() + i * DAY))) : Array.from(m.keys());
    return days.map(day => ({ dia: `${day.slice(8)}/${day.slice(5, 7)}`, "Receita bruta (R$)": (m.get(day)?.grossCents ?? 0) / 100, Ingressos: m.get(day)?.tickets ?? 0 }));
  }, [line.data, range]);

  const s = cur.data, p = prev.data;
  const cards: Array<[string, number, number | undefined, "money" | "n"]> = s ? [["Receita bruta aprovada", s.grossApprovedCents, p?.grossApprovedCents, "money"], ["Comissão de afiliados", s.affiliateCommissionCents, p?.affiliateCommissionCents, "money"], ["Receita líquida", s.netCents, p?.netCents, "money"], ["Ingressos emitidos", s.tickets.issued, p?.tickets.issued, "n"]] : [];

  return (
    <section aria-labelledby="rel" className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="rel" className="text-lg font-bold text-cocoa">Vendas e relatórios</h2>
        <div className="flex flex-wrap gap-2">
          <div role="group" aria-label="Período" className="flex gap-1">{PERIODS.map(([k, l]) => <button key={k} type="button" aria-pressed={period === k} onClick={() => setPeriod(k)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${period === k ? "bg-brand text-white" : "border border-line"}`}>{l}</button>)}</div>
          <Button size="sm" variant="outline" disabled={csv.isPending} onClick={() => csv.mutate(range.cur)}>CSV</Button>
          <Button size="sm" variant="outline" disabled={xlsx.isPending} onClick={() => xlsx.mutate(range.cur)}>XLSX</Button>
        </div>
      </div>
      {cur.isLoading && <p>Carregando…</p>}
      {s && (
        <>
          <dl className="grid gap-3 sm:grid-cols-2">
            {cards.map(([k, v, pv, t]) => <div key={k} className="rounded-2xl border border-line p-4"><dt className="text-sm text-[#6B5A50]">{k}</dt><dd className="num text-2xl font-extrabold text-cocoa">{t === "money" ? brl(v) : v}</dd>{range.prev && <dd className="text-xs">{delta(v, pv)}</dd>}</div>)}
          </dl>
          <p className="text-sm num">Comissão do lote: {brl(s.lotCommissionCents)} (não configurada) · Pedidos: {s.orders.approved} aprovados, {s.orders.pending} pendentes, {s.orders.cancelled} cancelados · Ingressos usados: {s.tickets.used}</p>
        </>
      )}
      <div>
        <h3 className="font-semibold text-cocoa">Receita bruta por dia</h3>
        <div className="mt-2 h-64 w-full" role="img" aria-label="Gráfico de barras de receita bruta e ingressos por dia">
          <ResponsiveContainer><BarChart data={series} margin={{ left: 8, right: 8 }}><CartesianGrid strokeDasharray="3 3" stroke="#E4D9D1" /><XAxis dataKey="dia" tick={{ fontSize: 12 }} /><YAxis yAxisId="r" tick={{ fontSize: 12 }} tickFormatter={v => `R$ ${v}`} width={64} /><YAxis yAxisId="t" orientation="right" allowDecimals={false} tick={{ fontSize: 12 }} width={32} /><Tooltip /><Legend />
            <Bar yAxisId="r" dataKey="Receita bruta (R$)" fill="#BF4A15" /><Bar yAxisId="t" dataKey="Ingressos" fill="#273A40" /></BarChart></ResponsiveContainer>
        </div>
        <details className="mt-2 text-sm"><summary className="cursor-pointer font-medium">Ver dados em tabela</summary>
          <table className="mt-2 w-full text-left num"><thead><tr><th>Dia</th><th>Receita bruta</th><th>Ingressos</th></tr></thead><tbody>{series.map(r => <tr key={r.dia}><td>{r.dia}</td><td>{r["Receita bruta (R$)"].toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td><td>{r.Ingressos}</td></tr>)}</tbody></table></details>
      </div>
      <div>
        <h3 className="font-semibold text-cocoa">Ocupação por lote</h3>
        <ul className="mt-2 space-y-3">{occ.data?.map(l => (
          <li key={l.lotId}><div className="flex justify-between text-sm"><strong>{l.title}</strong><span className="num">{l.sold} vendidos · {l.reserved} reservados · {l.available} livres (de {l.total})</span></div>
            <div className="mt-1 flex h-3 overflow-hidden rounded-full bg-mist" aria-hidden><span style={{ width: `${(l.sold / l.total) * 100}%` }} className="bg-brand" /><span style={{ width: `${(l.reserved / l.total) * 100}%` }} className="bg-[#159ABF]" /></div></li>))}</ul>
      </div>
      <div>
        <h3 className="font-semibold text-cocoa">Afiliados no período</h3>
        {aff.data?.length ? <div className="overflow-x-auto"><table className="mt-2 w-full text-left text-sm num"><thead><tr className="border-b border-line"><th className="py-1">Afiliado</th><th>Código</th><th>Ingressos</th><th>Vendas</th><th>Comissão</th></tr></thead><tbody>{aff.data.map(a => <tr key={a.code} className="border-b border-line"><td className="py-1">{a.name}</td><td className="font-mono">{a.code}</td><td>{a.tickets}</td><td>{brl(a.grossCents)}</td><td>{brl(a.commissionCents)}</td></tr>)}</tbody></table></div> : <p className="mt-1 text-sm">Nenhuma venda por afiliado no período.</p>}
      </div>
      {!!refunds.data?.length && (
        <div role="alert" className="rounded-2xl border border-brand p-4">
          <h3 className="font-semibold text-cocoa">Reembolsos pendentes</h3>
          <p className="text-sm">Estes pagamentos foram confirmados depois que a reserva expirou e não havia mais estoque. Reembolse na sua conta InfinitePay e marque como feito.</p>
          <ul className="mt-2 space-y-2 text-sm">{refunds.data.map(r => <li key={r.orderId} className="flex flex-wrap items-center justify-between gap-2"><span className="num">{brl(Math.round(Number(r.totalAmount) * 100))} · NSU <span className="font-mono">{r.transactionNsu ?? "—"}</span></span><Button size="sm" variant="outline" onClick={() => refunded.mutate({ eventId, orderId: r.orderId })}>Marcar como reembolsado</Button></li>)}</ul>
        </div>
      )}
      <div>
        <h3 className="font-semibold text-cocoa">Participantes</h3>
        <div className="mt-2 flex gap-2"><Input aria-label="Buscar por nome ou código do ingresso" placeholder="Nome ou código (BL-2026-…)" value={q} onChange={e => { setQ(e.target.value); setOffset(0); }} /></div>
        <ul className="mt-2 divide-y divide-line">{people.data?.rows.map(r => (
          <li key={r.ticketId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span><strong>{r.holderName}</strong> · <span className="num">CPF {r.cpfMasked}</span> · {r.lotTitle} · <span className="font-mono">{r.code}</span> · {r.status === "USED" ? "usado" : r.status === "VALID" ? "válido" : "cancelado"}</span>
            <Button size="sm" variant="ghost" disabled={resend.isPending} onClick={() => resend.mutate({ eventId, orderId: r.orderId })}>Reenviar voucher</Button></li>))}</ul>
        {people.data?.rows.length === 0 && <p className="mt-2 text-sm">Nenhum participante encontrado.</p>}
        <div className="mt-2 flex gap-2"><Button size="sm" variant="outline" disabled={offset === 0} onClick={() => setOffset(o => Math.max(0, o - 50))}>Anteriores</Button><Button size="sm" variant="outline" disabled={!people.data?.hasMore} onClick={() => setOffset(o => o + 50)}>Próximos</Button></div>
      </div>
    </section>
  );
}
