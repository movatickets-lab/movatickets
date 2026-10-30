import { useState } from "react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";
import { AuthGate } from "@/components/AuthGate";
import { Field } from "@/components/Field";
import { ReportsPanel } from "@/panel/ReportsPanel";
import { Button } from "@/components/ui/button";
import { brl, fmtFull } from "@/lib/format";
import { trpc } from "@/lib/trpc";

function Admin({ eventId }: { eventId: string }) {
  const utils = trpc.useUtils();
  const ev = trpc.ticketing.producer.events.get.useQuery({ eventId }, { retry: false });
  const refresh = () => void utils.ticketing.producer.events.get.invalidate({ eventId });
  const create = trpc.ticketing.producer.lots.create.useMutation({ onSuccess: () => { toast.success("Lote criado."); refresh(); setF({ title: "", price: "", quantity: "" }); }, onError: e => toast.error(e.message) });
  const update = trpc.ticketing.producer.lots.update.useMutation({ onSuccess: () => { toast.success("Lote atualizado."); refresh(); }, onError: e => toast.error(e.message) });
  const [f, setF] = useState({ title: "", price: "", quantity: "" });
  if (ev.isLoading) return <p className="p-10 text-center">Carregando…</p>;
  if (ev.error || !ev.data) return <p role="alert" className="p-10 text-center">Evento não encontrado ou sem permissão.</p>;
  const e = ev.data;
  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <div><Link href="/painel" className="text-sm font-semibold text-brand">← Área da produtora</Link>
        <h1 className="mt-2 text-2xl font-extrabold text-cocoa">{e.name}</h1><p className="text-sm text-[#6B5A50]">{fmtFull(e.eventDate)} · {e.locationName}</p></div>
      <ReportsPanel eventId={eventId} />
      <section aria-labelledby="lotes" className="space-y-4">
        <h2 id="lotes" className="text-lg font-bold text-cocoa">Lotes</h2>
        <form onSubmit={ev2 => { ev2.preventDefault(); create.mutate({ eventId, title: f.title, price: Number(f.price.replace(",", ".")), quantity: Number(f.quantity) }); }} className="grid gap-3 rounded-2xl border border-line p-4 sm:grid-cols-4">
          <div className="sm:col-span-2"><Field label="Nome do lote" value={f.title} onChange={x => setF({ ...f, title: x.target.value })} required minLength={2} /></div>
          <Field label="Preço (R$)" inputMode="decimal" value={f.price} onChange={x => setF({ ...f, price: x.target.value })} required />
          <Field label="Quantidade" inputMode="numeric" value={f.quantity} onChange={x => setF({ ...f, quantity: x.target.value })} required />
          <div className="sm:col-span-4"><Button type="submit" disabled={create.isPending}>Adicionar lote</Button></div>
        </form>
        <ul className="space-y-2">
          {e.lots.map(l => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3">
              <span><strong>{l.title}</strong> · <span className="num">{brl(l.price)}</span> · <span className="num">{l.availableQuantity}/{l.totalQuantity}</span> disponíveis {l.status === "PAUSED" && "· pausado"}</span>
              <Button size="sm" variant="outline" disabled={update.isPending} onClick={() => update.mutate({ lotId: l.id, status: l.status === "ACTIVE" ? "PAUSED" : "ACTIVE" })}>{l.status === "ACTIVE" ? "Pausar vendas" : "Retomar vendas"}</Button>
            </li>
          ))}
          {e.lots.length === 0 && <li className="text-sm">Nenhum lote ainda.</li>}
        </ul>
        <p className="text-xs text-[#6B5A50]">Mudar o preço vale só para novas compras; quem já comprou mantém o valor pago.</p>
      </section>
      <Link href={`/portaria/${eventId}`}><Button variant="outline">Abrir portaria deste evento</Button></Link>
    </main>
  );
}

export default function EventAdminPage() {
  const { eventId } = useParams<{ eventId: string }>();
  return <AuthGate><Admin eventId={eventId} /></AuthGate>;
}
