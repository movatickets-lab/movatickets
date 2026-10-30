import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Field } from "@/components/Field";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const m = trpc.auth.requestPasswordReset.useMutation({ onSuccess: () => setSent(true), onError: e => toast.error(e.message) });
  const submit = (e: FormEvent) => { e.preventDefault(); m.mutate({ email }); };
  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-extrabold text-cocoa">Redefinir senha</h1>
      {sent ? <p role="status" className="mt-4 rounded-xl border border-leaf-ink bg-mist p-4">Se o e-mail puder receber a mensagem, você receberá o link de redefinição. Ele vale por 1 hora.</p> : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="E-mail da conta" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <Button type="submit" size="lg" className="w-full" disabled={m.isPending}>Enviar link</Button>
        </form>
      )}
    </main>
  );
}
