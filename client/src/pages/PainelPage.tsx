import { useState } from "react";
import { Link } from "wouter";
import { AuthGate } from "@/components/AuthGate";
import { Button } from "@/components/ui/button";
import { EventsPanel } from "@/panel/EventsPanel";
import { GatewayPanel, ProfilePanel } from "@/panel/ProfilePanel";
import { AffiliatesPanel, StaffPanel } from "@/panel/TeamPanel";
import { trpc } from "@/lib/trpc";

const TABS = [["eventos", "Eventos"], ["perfil", "Perfil público"], ["recebimento", "Recebimento"], ["afiliados", "Afiliados"], ["equipe", "Equipe e portaria"]] as const;

function Painel() {
  const orgs = trpc.ticketing.producer.myOrganizations.useQuery();
  const [sel, setSel] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("eventos");
  if (orgs.isLoading) return <p className="p-10 text-center">Carregando…</p>;
  if (!orgs.data?.length) return (
    <main className="mx-auto max-w-xl px-4 py-14 text-center">
      <h1 className="text-2xl font-extrabold text-cocoa">Área da produtora</h1>
      <p className="mt-2">Você ainda não tem uma produtora cadastrada.</p>
      <Link href="/cadastro/produtora" className="mt-6 inline-block"><Button size="lg">Ser produtor parceiro</Button></Link>
    </main>
  );
  const org = orgs.data.find(o => o.id === sel) ?? orgs.data[0]!;
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-cocoa">{org.name}</h1>
        {orgs.data.length > 1 && (
          <select aria-label="Trocar de produtora" value={org.id} onChange={e => setSel(e.target.value)} className="rounded-lg border border-line bg-white px-3 py-2">
            {orgs.data.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
      </div>
      {org.status === "PENDING_REVIEW" && <p role="status" className="mt-4 rounded-xl bg-brand-soft p-4"><strong>Candidatura em análise.</strong> A equipe MOVA vai avaliar seus dados. Você será liberada para criar eventos assim que for aprovada.</p>}
      {org.status === "REJECTED" && <p role="alert" className="mt-4 rounded-xl bg-brand-soft p-4"><strong>Candidatura não aprovada.</strong> {org.reviewNote ?? "Fale com a equipe MOVA."}</p>}
      {org.status === "INACTIVE" && <p role="alert" className="mt-4 rounded-xl bg-brand-soft p-4"><strong>Produtora desativada.</strong> Fale com a equipe MOVA.</p>}
      {org.status === "ACTIVE" && (
        <>
          <div role="tablist" aria-label="Seções da produtora" className="mt-6 flex flex-wrap gap-2 border-b border-line pb-3">
            {TABS.map(([k, label]) => (
              <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === k ? "bg-brand text-white" : "border border-line text-cocoa hover:bg-mist"}`}>{label}</button>
            ))}
          </div>
          <div role="tabpanel" className="mt-6">
            {tab === "eventos" && <EventsPanel organizationId={org.id} />}
            {tab === "perfil" && <ProfilePanel key={org.id} org={org} />}
            {tab === "recebimento" && <GatewayPanel org={org} />}
            {tab === "afiliados" && <AffiliatesPanel organizationId={org.id} />}
            {tab === "equipe" && <StaffPanel organizationId={org.id} />}
          </div>
        </>
      )}
    </main>
  );
}

export default function PainelPage() { return <AuthGate><Painel /></AuthGate>; }
