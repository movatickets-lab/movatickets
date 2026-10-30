import { useState, type FormEvent } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Field } from "@/components/Field";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

export default function VerifyEmailPage() {
  const token = new URLSearchParams(useSearch()).get("token") ?? "";
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const done = trpc.auth.completeSignup.useMutation({ onSuccess: async () => { await utils.auth.me.invalidate(); navigate("/cadastro/produtora"); }, onError: e => toast.error(e.message) });
  const submit = (e: FormEvent) => { e.preventDefault(); done.mutate({ token, name, password, acceptTerms: true }); };
  if (token.length < 20) return <main className="mx-auto max-w-md px-4 py-16 text-center"><h1 className="text-2xl font-bold">Link inválido</h1><p className="mt-2">Peça um novo link em “Criar conta”.</p></main>;
  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-extrabold text-cocoa">Ative sua conta</h1>
      <p className="mt-2 text-sm">Seu e-mail foi confirmado ao abrir este link. Agora informe seu nome e defina uma senha.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="Seu nome" autoComplete="name" value={name} onChange={e => setName(e.target.value)} required minLength={2} />
        <Field label="Senha" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required minLength={10} hint="Mínimo de 10 caracteres." />
        <label className="flex items-start gap-3 text-sm"><Checkbox checked={accepted} onCheckedChange={setAccepted} /><span>Li e aceito os <Link href="/termos" className="font-semibold text-brand underline">Termos de uso</Link> e a <Link href="/privacidade" className="font-semibold text-brand underline">Política de Privacidade</Link>.</span></label>
        <Button type="submit" size="lg" className="w-full" disabled={done.isPending || !accepted}>Ativar conta</Button>
      </form>
    </main>
  );
}
