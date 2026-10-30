import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { EventCard } from "./EventCard";

export function SearchBox() {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => { const t = setTimeout(() => setQ(text.trim()), 300); return () => clearTimeout(t); }, [text]);
  const res = trpc.ticketing.events.search.useQuery({ q }, { enabled: q.length >= 2 });
  return (
    <div className="px-2">
      <div role="search" className="mx-auto flex w-full items-center gap-2 rounded-full border border-line bg-white px-4 py-2 shadow-sm">
        <Search aria-hidden className="size-5 text-[#6B5A50]" />
        <label htmlFor="busca" className="sr-only">Buscar eventos ou produtoras</label>
        <input id="busca" value={text} onChange={e => setText(e.target.value)} placeholder="Buscar eventos ou produtoras" className="w-full bg-transparent py-1 text-base outline-none" autoComplete="off" />
      </div>
      {q.length >= 2 && (
        <div className="mx-auto mt-4 max-w-6xl" aria-live="polite">
          {res.isLoading && <p className="text-sm text-[#6B5A50]">Buscando…</p>}
          {res.data && !res.data.events.length && !res.data.producers.length && <p className="text-sm">Nada encontrado para “{q}”.</p>}
          {!!res.data?.producers.length && (
            <div className="mb-4"><h3 className="mb-2 text-sm font-bold text-cocoa">Produtoras</h3>
              <ul className="flex flex-wrap gap-2">{res.data.producers.map(p => (
                <li key={p.slugId}><Link href={`/produtora/${p.slugId}`} className="flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-sm font-medium hover:border-brand">
                  {p.logoUrl && <img src={p.logoUrl} alt="" className="size-6 rounded-full object-cover" />}{p.displayName}</Link></li>))}</ul></div>
          )}
          {!!res.data?.events.length && (
            <div><h3 className="mb-2 text-sm font-bold text-cocoa">Eventos</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{res.data.events.map(e => <EventCard key={e.id} e={e} />)}</div></div>
          )}
        </div>
      )}
    </div>
  );
}
