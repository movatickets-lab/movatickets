import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Field } from "@/components/Field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { maskInput } from "@/lib/format";
import { trpc } from "@/lib/trpc";

export default function ProducerApplyPage() {
  const me = trpc.auth.me.useQuery();
  const apply = trpc.ticketing.producer.applyProducer.useMutation({ onError: e => toast.error(e.message) });
  const [f, setF] = useState({ legalName: "", responsibleName: "", document: "", email: "", phone: "", city: "", instagram: "", website: "", description: "" });
  const [accepted, setAccepted] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(p => ({ ...p, [k]: e.target.value }));
  if (me.isLoading) return <p className="p-10 text-center">Carregando…</p>;
  if (!me.data) return (
    <main className="mx-auto max-w-xl px-4 py-14 text-center"><h1 className="text-3xl font-extrabold text-cocoa">Ser produtor parceiro</h1>
      <p className="mt-3">Para enviar a candidatura, entre ou crie sua conta. É rápido e gratuito.</p>
      <Link href="/entrar?returnTo=/cadastro/produtora" className="mt-6 inline-block"><Button size="lg">Entrar ou criar conta</Button></Link></main>
  );
  if (apply.isSuccess) return (
    <main className="mx-auto max-w-xl px-4 py-14 text-center"><h1 className="text-3xl font-extrabold text-cocoa">Candidatura enviada</h1>
      <p className="mt-3">A equipe MOVA vai analisar os dados. Seus dados ficam privados até a aprovação. Acompanhe pela Área da produtora.</p>
      <Link href="/painel" className="mt-6 inline-block"><Button size="lg">Ir para a Área da produtora</Button></Link></main>
  );
  const submit = (e: FormEvent) => { e.preventDefault(); if (!accepted) return toast.error("Aceite os Termos para produtoras para enviar."); apply.mutate({ ...f, acceptTerms: true, instagram: f.instagram || undefined, website: f.website || undefined, description: f.description || undefined }); };
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-extrabold text-cocoa">Ser produtor parceiro</h1>
      <p className="mt-2 text-sm">Conte sobre sua produtora. Estes dados são privados e só são vistos pela equipe MOVA. Nada vai a público sem aprovação.</p>
      <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="Razão social ou nome da produtora" value={f.legalName} onChange={set("legalName")} required minLength={3} /></div>
        <Field label="Responsável" value={f.responsibleName} onChange={set("responsibleName")} required minLength={3} autoComplete="name" />
        <Field label="CPF ou CNPJ" inputMode="numeric" value={f.document} onChange={set("document")} required hint="Somente números ou com pontuação." />
        <Field label="E-mail de contato" type="email" value={f.email} onChange={set("email")} required autoComplete="email" />
        <Field label="Telefone / WhatsApp" inputMode="tel" value={f.phone} onChange={e => setF(p => ({ ...p, phone: maskInput.phone(e.target.value) }))} required placeholder="(86) 99999-9999" />
        <Field label="Cidade" value={f.city} onChange={set("city")} required />
        <Field label="Instagram" value={f.instagram} onChange={set("instagram")} placeholder="@suaprodutora" />
        <div className="sm:col-span-2"><Field label="Site (opcional)" type="url" value={f.website} onChange={set("website")} placeholder="https://" /></div>
        <div className="sm:col-span-2 space-y-1"><label htmlFor="desc" className="block text-sm font-medium text-cocoa">Sobre os eventos que você produz</label><Textarea id="desc" value={f.description} onChange={set("description")} maxLength={1000} /></div>
        <label className="flex items-start gap-3 text-sm sm:col-span-2"><Checkbox checked={accepted} onCheckedChange={setAccepted} /><span>Li e aceito os <Link href="/termos-produtoras" className="font-semibold text-brand underline">Termos para produtoras</Link> e a <Link href="/privacidade" className="font-semibold text-brand underline">Política de Privacidade</Link>.</span></label>
        <div className="sm:col-span-2"><Button type="submit" size="lg" className="w-full" disabled={apply.isPending || !accepted}>{apply.isPending ? "Enviando…" : "Enviar candidatura"}</Button></div>
      </form>
    </main>
  );
}
