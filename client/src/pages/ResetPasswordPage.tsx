import { useState, type FormEvent } from "react";
import { Link, useSearch } from "wouter";
import { toast } from "sonner";
import { Field } from "@/components/Field";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

export default function ResetPasswordPage() {
  const token = new URLSearchParams(useSearch()).get("token") ?? "";
  const [password, setPassword] = useState("");
  const m = trpc.auth.resetPassword.useMutation({ onError: e => toast.error(e.message) });
  const submit = (e: FormEvent) => { e.preventDefault(); m.mutate({ token, password }); };
  if (token.length < 20) return <main className="mx-auto max-w-md px-4 py-16 text-center"><h1 className="text-2xl font-bold">Link inválido</h1><Link href="/esqueci-senha" className="mt-3 inline-block font-semibold text-brand underline">Pedir novo link</Link></main>;
  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-extrabold text-cocoa">Nova senha</h1>
      {m.isSuccess ? <p role="status" className="mt-4 rounded-xl border border-leaf-ink bg-mist p-4">Senha alterada. Por segurança, você foi desconectado dos outros aparelhos. <Link href="/entrar" className="font-semibold text-brand underline">Entrar</Link></p> : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="Nova senha" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required minLength={10} hint="Mínimo de 10 caracteres." />
          <Button type="submit" size="lg" className="w-full" disabled={m.isPending}>Salvar senha</Button>
        </form>
      )}
    </main>
  );
}
