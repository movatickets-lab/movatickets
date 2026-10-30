import type { ReactNode } from "react";
import { Link } from "wouter";
import { LEGAL, TERMS_VERSION } from "@shared/legal";

/** Marca campos ainda não preenchidos em shared/legal.ts para ficarem impossíveis de passar despercebidos. */
export const L = (v: string) => (v.startsWith("[") ? <mark className="rounded bg-yellow-200 px-1 text-black">{v}</mark> : <>{v}</>);

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-extrabold text-cocoa">{title}</h1>
      <p className="mt-1 text-sm text-[#6B5A50]">Versão {TERMS_VERSION} · atualizada em {LEGAL.updatedAt}</p>
      <nav aria-label="Documentos legais" className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
        <Link href="/termos" className="text-brand underline">Termos de uso</Link>
        <Link href="/termos-produtoras" className="text-brand underline">Termos para produtoras</Link>
        <Link href="/privacidade" className="text-brand underline">Política de privacidade</Link>
      </nav>
      <div className="mt-8 space-y-8 leading-relaxed">{children}</div>
    </main>
  );
}

export function S({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`s${n}`}>
      <h2 id={`s${n}`} className="text-xl font-bold text-cocoa">{n}. {title}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}
export const UL = ({ items }: { items: ReactNode[] }) => <ul className="list-disc space-y-1 pl-6">{items.map((i, k) => <li key={k}>{i}</li>)}</ul>;
