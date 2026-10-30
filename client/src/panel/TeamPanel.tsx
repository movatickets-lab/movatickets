import { useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/Field";
import { Button } from "@/components/ui/button";
import { maskInput } from "@/lib/format";
import { trpc } from "@/lib/trpc";

export function AffiliatesPanel({ organizationId }: { organizationId: string }) {
  const utils = trpc.useUtils();
  const list = trpc.ticketing.producer.affiliates.list.useQuery({ organizationId });
  const refresh = () => void utils.ticketing.producer.affiliates.list.invalidate();
  const create = trpc.ticketing.producer.affiliates.create.useMutation({ onSuccess: r => { toast.success(`Afiliado criado. Código: ${r.code}`); refresh(); }, onError: e => toast.error(e.message) });
  const setStatus = trpc.ticketing.producer.affiliates.setStatus.useMutation({ onSuccess: refresh, onError: e => toast.error(e.message) });
  const [f, setF] = useState({ name: "", cpf: "", rate: "10" });
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-cocoa">Afiliados</h2>
      <p className="text-sm">O afiliado divulga o link <span className="font-mono">/slug-do-evento?ref=CÓDIGO</span> e recebe a comissão sobre cada venda aprovada. A comissão é calculada e congelada no momento da compra.</p>
      <form onSubmit={e => { e.preventDefault(); create.mutate({ organizationId, name: f.name, cpf: f.cpf, commissionRate: Number(f.rate.replace(",", ".")) }); }} className="grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2"><Field label="Nome" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} required minLength={3} /></div>
        <Field label="CPF" inputMode="numeric" value={f.cpf} onChange={e => setF({ ...f, cpf: maskInput.cpf(e.target.value) })} required />
        <Field label="Comissão (%)" inputMode="decimal" value={f.rate} onChange={e => setF({ ...f, rate: e.target.value })} required />
        <div className="sm:col-span-4"><Button type="submit" disabled={create.isPending}>Criar afiliado</Button></div>
      </form>
      <ul className="space-y-2">
        {list.data?.map(a => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3">
            <span><strong>{a.name}</strong> · <span className="font-mono">{a.code}</span> · {a.commissionRate}%</span>
            <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ affiliateId: a.id, status: a.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })}>{a.status === "ACTIVE" ? "Desativar" : "Reativar"}</Button>
          </li>
        ))}
        {list.data?.length === 0 && <li className="text-sm">Nenhum afiliado cadastrado.</li>}
      </ul>
    </div>
  );
}

export function StaffPanel({ organizationId }: { organizationId: string }) {
  const utils = trpc.useUtils();
  const list = trpc.ticketing.producer.staff.list.useQuery({ organizationId });
  const events = trpc.ticketing.producer.events.list.useQuery({ organizationId });
  const refresh = () => void utils.ticketing.producer.staff.list.invalidate();
  const invite = trpc.ticketing.producer.staff.invite.useMutation({ onSuccess: () => { toast.success("Acesso criado. A pessoa deve entrar com este e-mail."); refresh(); }, onError: e => toast.error(e.message) });
  const off = trpc.ticketing.producer.staff.deactivate.useMutation({ onSuccess: refresh, onError: e => toast.error(e.message) });
  const [f, setF] = useState({ email: "", role: "STAFF_PORTARIA" as "ORGANIZER" | "STAFF_PORTARIA", eventId: "" });
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-cocoa">Equipe e portaria</h2>
      <p className="text-sm">O acesso vale quando a pessoa entra com este e-mail (já confirmado). Operadores de portaria só enxergam o evento escolhido.</p>
      <form onSubmit={e => { e.preventDefault(); invite.mutate({ organizationId, email: f.email, role: f.role, eventId: f.role === "STAFF_PORTARIA" ? f.eventId : undefined }); }} className="grid gap-3 sm:grid-cols-3">
        <Field label="E-mail da pessoa" type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} required />
        <div className="space-y-1"><label htmlFor="st-role" className="block text-sm font-medium text-cocoa">Função</label>
          <select id="st-role" value={f.role} onChange={e => setF({ ...f, role: e.target.value as typeof f.role })} className="w-full rounded-lg border border-line bg-white px-3 py-2.5"><option value="STAFF_PORTARIA">Portaria</option><option value="ORGANIZER">Gestora</option></select></div>
        {f.role === "STAFF_PORTARIA" && <div className="space-y-1"><label htmlFor="st-ev" className="block text-sm font-medium text-cocoa">Evento</label>
          <select id="st-ev" value={f.eventId} onChange={e => setF({ ...f, eventId: e.target.value })} required className="w-full rounded-lg border border-line bg-white px-3 py-2.5"><option value="">Escolha…</option>{events.data?.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>}
        <div className="sm:col-span-3"><Button type="submit" disabled={invite.isPending}>Dar acesso</Button></div>
      </form>
      <ul className="space-y-2">
        {list.data?.map(s => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3">
            <span><strong>{s.email}</strong> · {s.role === "ORGANIZER" ? "Gestora" : "Portaria"} · {s.status === "ACTIVE" ? "ativo" : "inativo"}</span>
            {s.status === "ACTIVE" && <Button size="sm" variant="outline" onClick={() => off.mutate({ staffId: s.id })}>Remover acesso</Button>}
          </li>
        ))}
      </ul>
    </div>
  );
}
