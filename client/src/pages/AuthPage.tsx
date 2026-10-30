import { useState, type FormEvent } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { toast } from "sonner";
import { Field } from "@/components/Field";
import { Button } from "@/components/ui/button";
import { safeReturn } from "@/lib/auth";
import { trpc } from "@/lib/trpc";

export default function AuthPage() {
  const params = new URLSearchParams(useSearch());
  const returnTo = safeReturn(params.get("returnTo"));
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<"entrar" | "criar">("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const login = trpc.auth.login.useMutation({ onSuccess: async () => { await utils.auth.me.invalidate(); navigate(returnTo); }, onError: e => toast.error(e.message) });
  const signup = trpc.auth.startSignup.useMutation({ onSuccess: () => setSent(true), onError: e => toast.error(e.message) });

  const submit = (e: FormEvent) => { e.preventDefault(); if (mode === "entrar") login.mutate({ email, password }); else signup.mutate({ email }); };
  const googleHref = `/api/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-extrabold text-cocoa">{mode === "entrar" ? "Entrar" : "Criar conta"}</h1>
      <div role="tablist" aria-label="Acesso" className="mt-4 grid grid-cols-2 rounded-lg border border-line p-1">
        {(["entrar", "criar"] as const).map(m => (
          <button key={m} role="tab" type="button" aria-selected={mode === m} onClick={() => { setMode(m); setSent(false); }} className={`rounded-md py-2 text-sm font-semibold ${mode === m ? "bg-brand text-white" : "text-cocoa"}`}>{m === "entrar" ? "Entrar" : "Criar conta"}</button>
        ))}
      </div>
      {params.get("erro") === "google" && <p role="alert" className="mt-4 rounded-lg border border-danger p-3 text-sm text-danger">Não foi possível entrar com o Google. Tente novamente.</p>}
      <a href={googleHref} className="mt-5 flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 font-semibold text-cocoa hover:bg-mist">Continuar com Google</a>
      <p className="my-4 text-center text-sm text-[#6B5A50]">ou com e-mail</p>
      {sent ? (
        <p role="status" className="rounded-xl border border-leaf-ink bg-mist p-4">Se o e-mail puder receber a mensagem, você receberá um link para confirmar o endereço e definir sua senha. Verifique também a caixa de spam.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="E-mail" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
          {mode === "entrar" && <Field label="Senha" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />}
          <Button type="submit" size="lg" className="w-full" disabled={login.isPending || signup.isPending}>{mode === "entrar" ? "Entrar" : "Enviar link de confirmação"}</Button>
          {mode === "entrar" && <p className="text-center text-sm"><Link href="/esqueci-senha" className="font-semibold text-brand underline">Esqueci minha senha</Link></p>}
        </form>
      )}
      <p className="mt-6 text-center text-xs text-[#6B5A50]">Ao continuar, você concorda com os <Link href="/termos" className="underline">Termos de uso</Link> e a <Link href="/privacidade" className="underline">Política de Privacidade</Link>.</p>
    </main>
  );
}
