import { Globe, Instagram, Mail, Phone } from "lucide-react";
import { useState } from "react";
import { useParams } from "wouter";
import { EventCard } from "@/components/EventCard";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import NotFound from "./NotFound";

export default function ProducerPublicPage() {
  const { slugId } = useParams<{ slugId: string }>();
  const q = trpc.ticketing.producers.bySlugId.useQuery({ slugId }, { retry: false });
  const [reveal, setReveal] = useState(false);
  if (q.isLoading) return <p className="p-10 text-center">Carregando…</p>;
  if (q.error || !q.data) return <NotFound />;
  const { profile: p, upcoming, past } = q.data;
  const hasContact = !!(p.contactEmail || p.contactPhone);
  return (
    <main>
      <section className="relative bg-gradient-to-br from-cocoa to-petrol">
        {p.coverUrl && <img src={p.coverUrl} alt="" className="absolute inset-0 size-full object-cover opacity-50" />}
        <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-3 px-4 py-14 text-center text-white">
          {p.logoUrl && <img src={p.logoUrl} alt={`Logo de ${p.displayName}`} className="size-24 rounded-2xl border-2 border-white bg-white object-cover" />}
          <h1 className="text-3xl font-extrabold">{p.displayName}</h1>
        </div>
      </section>
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
        <p className="whitespace-pre-line text-lg text-[#3A2D26]">{p.description}</p>
        <div className="flex flex-wrap items-center gap-3">
          {p.websiteUrl && <a href={p.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 font-semibold text-sky-ink underline"><Globe aria-hidden className="size-4" />Site</a>}
          {p.instagramUrl && <a href={p.instagramUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 font-semibold text-sky-ink underline"><Instagram aria-hidden className="size-4" />Instagram</a>}
          {hasContact && !reveal && <Button variant="outline" onClick={() => setReveal(true)} aria-expanded={false}>Ver contato</Button>}
        </div>
        {hasContact && reveal && (
          <ul className="fade-in space-y-2 rounded-xl border border-line bg-mist p-4" aria-label="Contato da produtora">
            {p.contactEmail && <li className="flex items-center gap-2"><Mail aria-hidden className="size-4" /><a className="font-semibold underline" href={`mailto:${p.contactEmail}`}>{p.contactEmail}</a></li>}
            {p.contactPhone && <li className="flex items-center gap-2"><Phone aria-hidden className="size-4" /><a className="num font-semibold underline" href={`tel:+55${p.contactPhone.replace(/\D/g, "")}`}>{p.contactPhone}</a></li>}
          </ul>
        )}
        <section><h2 className="mb-3 text-2xl font-bold text-cocoa">Próximos eventos</h2>
          {!upcoming.length && <p>Nenhum evento agendado no momento.</p>}
          <div className="grid gap-5 sm:grid-cols-2">{upcoming.map(e => <EventCard key={e.id} e={e} />)}</div></section>
        {!!past.length && <section><h2 className="mb-3 text-2xl font-bold text-cocoa">Eventos anteriores</h2><div className="grid gap-5 sm:grid-cols-2">{past.map(e => <EventCard key={e.id} e={e} />)}</div></section>}
      </div>
    </main>
  );
}
