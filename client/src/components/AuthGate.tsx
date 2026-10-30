import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

/** Exige login; volta para a página atual depois de entrar. */
export function AuthGate({ children }: { children: ReactNode }) {
  const me = trpc.auth.me.useQuery();
  const [loc] = useLocation();
  if (me.isLoading) return <p className="p-10 text-center">Carregando…</p>;
  if (!me.data) return (
    <main className="mx-auto max-w-xl px-4 py-14 text-center">
      <h1 className="text-2xl font-extrabold text-cocoa">Entre para continuar</h1>
      <p className="mt-2">Esta área é restrita a contas autorizadas.</p>
      <Link href={`/entrar?returnTo=${encodeURIComponent(loc)}`} className="mt-6 inline-block"><Button size="lg">Entrar ou criar conta</Button></Link>
    </main>
  );
  return <>{children}</>;
}
