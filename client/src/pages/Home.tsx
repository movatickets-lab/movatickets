import { useState } from "react";
import { EventCard } from "@/components/EventCard";
import { SearchBox } from "@/components/SearchBox";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

export default function Home() {
  const upcoming = trpc.ticketing.events.list.useQuery({ scope: "upcoming" });
  const [showPast, setShowPast] = useState(false);
  const past = trpc.ticketing.events.list.useQuery({ scope: "past" }, { enabled: showPast });
  return (
    <>
      <section className="bg-gradient-to-br from-cocoa via-cocoa to-petrol px-4 pb-14 pt-12 text-center text-white">
        <p className="text-sm font-extrabold tracking-[0.3em] text-[#FF9A63]">MOVA TICKETS</p>
        <h1 className="mx-auto mt-3 text-3xl font-extrabold leading-tight sm:text-5xl md:whitespace-nowrap">Encontros que movem você.</h1>
        <p className="mx-auto mt-3 max-w-xl text-base text-white/85">Escolha seu evento, faça a compra nominal em poucos passos e guarde o ingresso digital no celular.</p>
      </section>
      <div className="-mt-6"><SearchBox /></div>
      <main id="agenda" className="mx-auto mt-10 max-w-6xl px-4">
        <h2 className="mb-4 text-2xl font-bold text-cocoa">Próximos eventos</h2>
        {upcoming.isLoading && <p>Carregando eventos…</p>}
        {upcoming.error && <p role="alert" className="text-danger">Não foi possível carregar os eventos. Tente novamente.</p>}
        {upcoming.data && !upcoming.data.length && <p className="rounded-xl border border-line bg-mist p-6 text-center">Ainda não há eventos publicados. Volte em breve!</p>}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{upcoming.data?.map(e => <EventCard key={e.id} e={e} />)}</div>
        <div className="mt-10">
          {!showPast ? <Button variant="outline" onClick={() => setShowPast(true)}>Ver eventos anteriores</Button> : (
            <><h2 className="mb-4 text-2xl font-bold text-cocoa">Eventos anteriores</h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{past.data?.map(e => <EventCard key={e.id} e={e} />)}</div>
              {past.data && !past.data.length && <p>Nenhum evento anterior.</p>}</>
          )}
        </div>
      </main>
    </>
  );
}
