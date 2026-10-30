import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Field } from "@/components/Field";
import { ImageUpload } from "@/components/ImageUpload";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { ShareCard } from "@/components/ShareCard";
import { trpc } from "@/lib/trpc";

type Org = { id: string; publicSlugId?: string | null; profileStatus: string; profileReviewNote: string | null; profileDraft: { displayName: string; description: string; logoUrl: string | null; coverUrl?: string | null; websiteUrl: string | null; instagramUrl: string | null; contactEmail?: string | null; contactPhone?: string | null } | null; profilePublished: unknown; gatewayConfigured: boolean };
const PROFILE_STATUS: Record<string, string> = { DRAFT: "Rascunho", PENDING_REVIEW: "Em análise pela MOVA", REJECTED: "Devolvido para ajuste", PUBLISHED: "Publicado" };

export function ProfilePanel({ org }: { org: Org }) {
  const utils = trpc.useUtils();
  const d = org.profileDraft;
  const [f, setF] = useState({ displayName: d?.displayName ?? "", description: d?.description ?? "", logoUrl: d?.logoUrl ?? "", coverUrl: d?.coverUrl ?? "", websiteUrl: d?.websiteUrl ?? "", instagramUrl: d?.instagramUrl ?? "", contactEmail: d?.contactEmail ?? "", contactPhone: d?.contactPhone ?? "" });
  useEffect(() => { setF(p => p); }, [org.id]);
  const refresh = () => void utils.ticketing.producer.myOrganizations.invalidate();
  const save = trpc.ticketing.producer.profile.save.useMutation({ onSuccess: () => { toast.success("Rascunho salvo."); refresh(); }, onError: e => toast.error(e.message) });
  const send = trpc.ticketing.producer.profile.submit.useMutation({ onSuccess: () => { toast.success("Enviado para análise da MOVA."); refresh(); }, onError: e => toast.error(e.message) });
  const onSave = (e: FormEvent) => { e.preventDefault(); save.mutate({ organizationId: org.id, profile: { ...f, instagramUrl: f.instagramUrl || undefined, contactEmail: f.contactEmail || undefined, contactPhone: f.contactPhone || undefined } }); };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold text-cocoa">Perfil público</h2><span className="rounded-md border border-sky-ink px-2 py-0.5 text-xs font-semibold text-sky-ink">{PROFILE_STATUS[org.profileStatus] ?? org.profileStatus}</span></div>
      {org.profileReviewNote && <p role="note" className="rounded-lg bg-brand-soft p-3 text-sm"><strong>Ajuste pedido pela MOVA:</strong> {org.profileReviewNote}</p>}
      <p className="text-sm">O que você salva aqui é um rascunho. A versão pública só muda depois que a MOVA aprovar; até lá, a versão atual continua no ar. O contato abaixo só aparece no perfil depois da aprovação.</p>
      {Boolean(org.publicSlugId && org.profilePublished) && (
        <section aria-label="Divulgação">
          <h3 className="mb-2 font-semibold text-cocoa">Divulgue sua página</h3>
          <ShareCard 
            title={String(org.profileDraft?.displayName ?? "Minha produtora")} 
            url={`${window.location.origin}/produtora/${org.publicSlugId}`} 
            logoUrl={org.profileDraft?.logoUrl} 
          />
        </section>
      )}
      <form onSubmit={onSave} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="Nome público" value={f.displayName} onChange={e => setF({ ...f, displayName: e.target.value })} required minLength={2} /></div>
        <div className="sm:col-span-2 space-y-1"><label htmlFor="pf-desc" className="block text-sm font-medium text-cocoa">Apresentação (mín. 20 caracteres)</label><Textarea id="pf-desc" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} required minLength={20} maxLength={2000} /></div>
        <ImageUpload organizationId={org.id} kind="logo" label="Logo" value={f.logoUrl} onChange={url => setF(p => ({ ...p, logoUrl: url }))} />
        <ImageUpload organizationId={org.id} kind="cover" label="Capa (opcional)" value={f.coverUrl} onChange={url => setF(p => ({ ...p, coverUrl: url }))} />
        <Field label="Site" type="url" value={f.websiteUrl} onChange={e => setF({ ...f, websiteUrl: e.target.value })} placeholder="https://" />
        <Field label="Instagram" value={f.instagramUrl} onChange={e => setF({ ...f, instagramUrl: e.target.value })} placeholder="@suaprodutora" />
        <Field label="E-mail de contato público" type="email" value={f.contactEmail} onChange={e => setF({ ...f, contactEmail: e.target.value })} hint="Aparece só depois da aprovação, atrás do botão “Ver contato”." />
        <Field label="Telefone de contato público" inputMode="tel" value={f.contactPhone} onChange={e => setF({ ...f, contactPhone: e.target.value })} />
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="submit" variant="outline" disabled={save.isPending}>{save.isPending ? "Salvando…" : "Salvar rascunho"}</Button>
          <Button disabled={send.isPending || !org.profileDraft || org.profileStatus === "PENDING_REVIEW"} onClick={() => send.mutate({ organizationId: org.id })}>Enviar para aprovação</Button>
        </div>
      </form>
    </div>
  );
}

export function GatewayPanel({ org }: { org: Org }) {
  const utils = trpc.useUtils();
  const [tag, setTag] = useState("");
  const set = trpc.ticketing.producer.gateway.set.useMutation({ onSuccess: () => { toast.success("InfiniteTag salva com segurança."); setTag(""); void utils.ticketing.producer.myOrganizations.invalidate(); }, onError: e => toast.error(e.message) });
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-cocoa">Recebimento (InfinitePay)</h2>
      <p className="text-sm">Os pagamentos dos ingressos caem direto na sua conta InfinitePay, identificada pela sua InfiniteTag. A MOVA só gera o link de pagamento.</p>
      <p role="status" className={`rounded-lg p-3 text-sm font-medium ${org.gatewayConfigured ? "bg-[#E6F7EF] text-leaf-ink" : "bg-brand-soft text-brand-dark"}`}>{org.gatewayConfigured ? "✔ InfiniteTag configurada. Por segurança, ela não é exibida novamente." : "Nenhuma InfiniteTag configurada: ainda não é possível vender ingressos pagos."}</p>
      <form onSubmit={e => { e.preventDefault(); set.mutate({ organizationId: org.id, infiniteTag: tag }); }} className="max-w-md space-y-3">
        <Field label={org.gatewayConfigured ? "Trocar InfiniteTag" : "Sua InfiniteTag"} value={tag} onChange={e => setTag(e.target.value)} required placeholder="suatag (sem o $)" autoComplete="off" />
        <Button type="submit" disabled={set.isPending}>{set.isPending ? "Salvando…" : "Salvar InfiniteTag"}</Button>
      </form>
    </div>
  );
}
