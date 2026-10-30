import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export function SiteFooter() {
  return (
    <footer className="mt-16 bg-petrol text-white">
      {/* Chamada “Para quem produz” — texto provisório: troque pelo texto aprovado, se for diferente. */}
      <section aria-labelledby="produz" className="mx-auto max-w-6xl px-4 py-10 text-center">
        <h2 id="produz" className="text-sm font-extrabold tracking-widest text-[#FF9A63]">PARA QUEM PRODUZ</h2>
        <p className="mx-auto mt-2 max-w-xl text-white/90">Venda ingressos com lotes, pagamento direto na sua conta InfinitePay, voucher nominal e controle de portaria.</p>
        <Link href="/cadastro/produtora" className="mt-4 inline-block"><Button size="lg">Cadastrar produtora</Button></Link>
      </section>
      <nav aria-label="Informações legais" className="border-t border-white/15 px-4 py-4 text-center text-xs text-white/80">
        <Link href="/termos" className="underline">Termos de uso</Link> · <Link href="/termos-produtoras" className="underline">Termos para produtoras</Link> · <Link href="/privacidade" className="underline">Política de privacidade</Link>
      </nav>
      <p className="px-4 pb-4 text-center text-xs text-white/70">© MOVA Produções · MOVA TICKETS</p>
    </footer>
  );
}
