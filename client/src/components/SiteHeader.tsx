import { ChevronDown, LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

type Item = { href: string; label: string };

function Group({ label, items }: { label: string; items: Item[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-bold tracking-wide text-white hover:bg-white/10">
        {label}<ChevronDown aria-hidden className="size-4" />
      </button>
      {open && (
        <ul className="fade-in absolute left-0 z-30 mt-1 min-w-56 rounded-xl border border-line bg-white p-1 shadow-lg">
          {items.map(i => (
            <li key={i.href}><Link href={i.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm font-medium text-cocoa hover:bg-brand-soft">{i.label}</Link></li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SiteHeader() {
  const utils = trpc.useUtils();
  const me = trpc.auth.me.useQuery();
  const logout = trpc.auth.logout.useMutation({ onSuccess: () => { void utils.auth.me.invalidate(); } });
  return (
    <header className="bg-cocoa text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-3 py-2">
        <Link href="/" className="rounded-lg px-2 py-1 text-lg font-extrabold tracking-wider">MOVA <span className="text-[#FF9A63]">TICKETS</span></Link>
        <nav aria-label="Principal" className="flex flex-wrap items-center gap-1">
          <Group label="EVENTOS" items={[{ href: "/", label: "Eventos" }, { href: "/#agenda", label: "Encontrar ingressos" }]} />
          <Group label="ÁREA DO PRODUTOR" items={[{ href: "/cadastro/produtora", label: "Ser produtor parceiro" }, { href: "/painel", label: "Área da produtora" }]} />
          {me.data?.role === "admin" && <Link href="/master" className="rounded-lg px-3 py-2 text-sm font-bold tracking-wide text-white hover:bg-white/10">MODERAÇÃO</Link>}
          {me.data && (
            <button type="button" onClick={() => logout.mutate()} className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-white/90 hover:bg-white/10" aria-label={`Sair da conta de ${me.data.name ?? me.data.email ?? "usuário"}`}>
              <LogOut aria-hidden className="size-4" />Sair
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
