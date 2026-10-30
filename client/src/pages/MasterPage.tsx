import { useState } from "react";
import { toast } from "sonner";
import { AuthGate } from "@/components/AuthGate";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { fmtFull } from "@/lib/format";
import { trpc } from "@/lib/trpc";

type Kind = "organization" | "profile" | "event";

function Decision({ kind, id, onDone }: { kind: Kind; id: string; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [asking, setAsking] = useState(false);
  const decide = trpc.ticketing.master.decide.useMutation({ onSuccess: () => { toast.success("Decisão registrada."); onDone(); }, onError: e => toast.error(e.message) });
  return (
    <div className="mt-3 space-y-2">
      {asking && <><label htmlFor={`n-${id}`} className="block text-sm font-medium">O que a produtora deve corrigir?</label><Textarea id={`n-${id}`} value={note} onChange={e => setNote(e.target.value)} maxLength={1000} /></>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ kind, id, approve: true })}>Aprovar</Button>
        {!asking ? <Button size="sm" variant="outline" onClick={() => setAsking(true)}>Devolver</Button>
          : <Button size="sm" variant="danger" disabled={decide.isPending || note.trim().length < 5} onClick={() => decide.mutate({ kind, id, approve: false, note })}>Confirmar devolução</Button>}
      </div>
    </div>
  );
}

function Master() {
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<"fila" | "auditoria">("fila");
  const q = trpc.ticketing.master.queue.useQuery(undefined, { retry: false });
  const audit = trpc.ticketing.auditTrail.list.useQuery({ limit: 50, offset: 0 }, { enabled: tab === "auditoria", retry: false });
  const done = () => void utils.ticketing.master.queue.invalidate();
  if (q.error) return <p role="alert" className="p-10 text-center">Acesso restrito à equipe MOVA.</p>;
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-extrabold text-cocoa">Moderação MOVA</h1>
      <div role="tablist" className="mt-4 flex gap-2">
        {(["fila", "auditoria"] as const).map(t => <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === t ? "bg-brand text-white" : "border border-line"}`}>{t === "fila" ? "Fila de aprovação" : "Auditoria"}</button>)}
      </div>
      {tab === "fila" && (
        <div className="mt-6 space-y-8">
          {q.isLoading && <p>Carregando…</p>}
          <section><h2 className="font-bold text-cocoa">Candidaturas de produtoras ({q.data?.organizations.length ?? 0})</h2>
            {q.data?.organizations.map(o => (
              <article key={o.id} className="mt-3 rounded-2xl border border-line p-4">
                <h3 className="font-bold">{o.name}</h3>
                <p className="text-sm">Documento: <span className="font-mono">{o.document}</span></p>
                {o.application && <ul className="mt-1 text-sm"><li>Responsável: {o.application.responsibleName}</li><li>E-mail: {o.application.email} · Tel.: {o.application.phone}</li><li>Cidade: {o.application.city}</li>{o.application.description && <li>Sobre: {o.application.description}</li>}</ul>}
                <Decision kind="organization" id={o.id} onDone={done} />
              </article>
            ))}</section>
          <section><h2 className="font-bold text-cocoa">Perfis públicos ({q.data?.profiles.length ?? 0})</h2>
            {q.data?.profiles.map(p => (
              <article key={p.id} className="mt-3 rounded-2xl border border-line p-4">
                <h3 className="font-bold">{p.draft?.displayName ?? p.name}</h3><p className="text-sm">{p.draft?.description}</p>
                {p.draft && <p className="mt-1 text-sm">Contato a publicar: {p.draft.contactEmail ?? "—"} · {p.draft.contactPhone ?? "—"}</p>}
                <Decision kind="profile" id={p.id} onDone={done} />
              </article>
            ))}</section>
          <section><h2 className="font-bold text-cocoa">Eventos ({q.data?.events.length ?? 0})</h2>
            {q.data?.events.map(e => (
              <article key={e.id} className="mt-3 rounded-2xl border border-line p-4">
                <h3 className="font-bold">{e.name}</h3><p className="text-sm">{e.organizationName} · {fmtFull(e.eventDate)} · {e.locationName}</p>
                {e.bannerUrl && <img src={e.bannerUrl} alt={`Banner de ${e.name}`} className="mt-2 h-28 rounded-lg object-cover" />}
                <p className="mt-1 text-sm">{e.description}</p>
                <Decision kind="event" id={e.id} onDone={done} />
              </article>
            ))}</section>
        </div>
      )}
      {tab === "auditoria" && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm"><caption className="sr-only">Trilha de auditoria</caption>
            <thead><tr className="border-b border-line"><th className="py-2 pr-3">Quando</th><th className="pr-3">Ação</th><th className="pr-3">Escopo</th><th className="pr-3">Ator</th><th>IP</th></tr></thead>
            <tbody>{audit.data?.map(r => <tr key={r.id} className="border-b border-line align-top"><td className="py-2 pr-3 num">{fmtFull(r.createdAt)}</td><td className="pr-3 font-mono text-xs">{r.action}</td><td className="pr-3 text-xs">{r.scopeType}{r.scopeId ? ` ${r.scopeId.slice(0, 8)}` : ""}</td><td className="pr-3">{r.actorType === "SYSTEM" ? "Sistema" : `Usuário ${r.actorUserId}`}</td><td className="font-mono text-xs">{r.ip ?? "—"}</td></tr>)}</tbody>
          </table>
          {audit.isLoading && <p className="mt-3">Carregando…</p>}
        </div>
      )}
    </main>
  );
}

export default function MasterPage() { return <AuthGate><Master /></AuthGate>; }
