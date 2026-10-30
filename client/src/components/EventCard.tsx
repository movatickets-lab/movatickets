import { CalendarDays, MapPin } from "lucide-react";
import { Link } from "wouter";
import { brlCents, fmtDate } from "@/lib/format";

export type CardEvent = { slug: string; name: string; bannerUrl: string | null; locationName: string | null; eventDate: Date | string; producerName: string; fromPriceCents: number | null; soldOut: boolean };

export function EventCard({ e }: { e: CardEvent }) {
  return (
    <Link href={`/${e.slug}`} className="group block overflow-hidden rounded-2xl border border-line bg-white transition-shadow hover:shadow-lg">
      <div className="aspect-[16/9] bg-gradient-to-br from-cocoa to-petrol">
        {e.bannerUrl && <img src={e.bannerUrl} alt="" loading="lazy" className="size-full object-cover" />}
      </div>
      <div className="space-y-1.5 p-4">
        <h3 className="line-clamp-2 text-lg font-bold leading-snug text-cocoa group-hover:text-brand">{e.name}</h3>
        <p className="text-xs text-[#6B5A50]">{e.producerName}</p>
        <p className="flex items-center gap-1.5 text-sm text-sky-ink"><CalendarDays aria-hidden className="size-4" />{fmtDate(e.eventDate)}</p>
        {e.locationName && <p className="flex items-center gap-1.5 text-sm text-[#4A3A30]"><MapPin aria-hidden className="size-4" />{e.locationName}</p>}
        <p className="num pt-1 text-sm font-bold">
          {e.soldOut ? <span className="rounded-md border border-danger px-2 py-0.5 text-danger">Esgotado</span> : e.fromPriceCents === null ? "Em breve" : e.fromPriceCents === 0 ? "Gratuito" : `a partir de ${brlCents(e.fromPriceCents)}`}
        </p>
      </div>
    </Link>
  );
}
