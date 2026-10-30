import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Field } from "@/components/Field";
import { ImageUpload } from "@/components/ImageUpload";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { fmtDate } from "@/lib/format";
import { trpc } from "@/lib/trpc";

const STATUS: Record<string, string> = { DRAFT: "Rascunho", PENDING_REVIEW: "Em análise pela MOVA", PUBLISHED: "Publicado", REJECTED: "Devolvido para ajuste", FINISHED: "Encerrado" };

export function EventsPanel({ organizationId }: { organizationId: string }) {
  const utils = trpc.useUtils();
  const list = trpc.ticketing.producer.events.list.useQuery({ organizationId });
  const done = () => void utils.ticketing.producer.events.list.invalidate();
  const create = trpc.ticketing.producer.events.create.useMutation({ onSuccess: () => { toast.success("Evento criado como rascunho."); done(); setF({ name: "", date: "", place: "", description: "", banner: "" }); }, onError: e => toast.error(e.message) });
  const submit = trpc.ticketing.producer.events.submit.useMutation({ onSuccess: () => { toast.success("Enviado para análise da MOVA."); done(); }, onError: e => toast.error(e.message) });
  const [f, setF] = useState({ name: "", date: "", place: "", description: "", banner: "" });
  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    create.mutate({ organizationId, name: f.name, eventDate: new Date(f.date), locationName: f.place, description: f.description || undefined, bannerUrl: f.banner || undefined });
  };
  return (
    <div className="space-y-8">
      <section aria-labelledby="novo-evento" className="rounded-2xl border border-line p-4">
        <h2 id="novo-evento" className="text-lg font-bold text-cocoa">Novo evento</h2>
        <form onSubmit={onCreate} className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Nome do evento" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} required minLength={3} /></div>
          <Field label="Data e hora" type="datetime-local" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} required />
          <Field label="Local" value={f.place} onChange={e => setF({ ...f, place: e.target.value })} required />
          <div className="sm:col-span-2 space-y-1"><label htmlFor="ev-desc" className="block text-sm font-medium text-cocoa">Descrição</label><Textarea id="ev-desc" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} maxLength={5000} /></div>
          <div className="sm:col-span-2"><ImageUpload organizationId={organizationId} kind="banner" label="Banner do evento (proporção horizontal)" value={f.banner} onChange={url => setF(p => ({ ...p, banner: url }))} /></div>
          <div className="sm:col-span-2"><Button type="submit" disabled={create.isPending}>{create.isPending ? "Criando…" : "Criar evento"}</Button></div>
        </form>
      </section>
      <section aria-labelledby="meus-eventos">
        <h2 id="meus-eventos" className="text-lg font-bold text-cocoa">Meus eventos</h2>
        {list.isLoading && <p className="mt-2">Carregando…</p>}
        {list.data?.length === 0 && <p className="mt-2 text-sm">Você ainda não criou eventos.</p>}
        <ul className="mt-3 space-y-3">
          {list.data?.map(e => (
            <li key={e.id} className="rounded-2xl border border-line p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><h3 className="font-bold text-cocoa">{e.name}</h3><p className="text-sm text-[#6B5A50]">{fmtDate(e.eventDate)} · {e.locationName}</p></div>
                <span className="rounded-md border border-sky-ink px-2 py-0.5 text-xs font-semibold text-sky-ink">{STATUS[e.status] ?? e.status}</span>
              </div>
              {e.reviewNote && <p role="note" className="mt-2 rounded-lg bg-brand-soft p-2 text-sm"><strong>Ajuste pedido pela MOVA:</strong> {e.reviewNote}</p>}
              <p className="mt-2 text-sm">{e.lots.length} lote(s)</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/painel/evento/${e.id}`}><Button size="sm" variant="outline">Gerenciar lotes e vendas</Button></Link>
                {(e.status === "DRAFT" || e.status === "REJECTED") && <Button size="sm" disabled={submit.isPending} onClick={() => submit.mutate({ eventId: e.id })}>Enviar para aprovação</Button>}
                {e.status === "PUBLISHED" && <Link href={`/${e.slug}`}><Button size="sm" variant="ghost">Ver página pública</Button></Link>}
                <Link href={`/portaria/${e.id}`}><Button size="sm" variant="ghost">Portaria</Button></Link>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
