import { CalendarDays, MapPin, Minus, Plus } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useParams, useSearch } from "wouter";
import { buildIcs } from "@/lib/ics";
import { downloadText } from "@/lib/download";
import { toast } from "sonner";
import { Field } from "@/components/Field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { brl, fmtFull, isValidCpf, maskInput } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import NotFound from "./NotFound";

type Holder = { name: string; cpf: string; email: string; phone: string; instagram: string };
const blank: Holder = { name: "", cpf: "", email: "", phone: "", instagram: "" };

function validate(h: Holder) {
  const e: Partial<Record<keyof Holder, string>> = {};
  if (h.name.trim().length < 3) e.name = "Informe o nome completo.";
  if (!isValidCpf(h.cpf)) e.cpf = "CPF inválido.";
  if (!/^\S+@\S+\.\S+$/.test(h.email)) e.email = "E-mail inválido.";
  if (![10, 11].includes(h.phone.replace(/\D/g, "").length)) e.phone = "Telefone com DDD.";
  return e;
}

export default function EventPage() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const search = useSearch();
  const q = trpc.ticketing.events.bySlug.useQuery({ slug }, { retry: false });
  const create = trpc.ticketing.orders.create.useMutation();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [H, setH] = useState<Holder[]>([]);
  const [errors, setErrors] = useState<Record<number, ReturnType<typeof validate>>>({});
  const [same, setSame] = useState(true);
  const [accepted, setAccepted] = useState(false);

  if (q.isLoading) return <p className="p-8 text-center">Carregando…</p>;
  if (q.error || !q.data) return <NotFound />;
  const ev = q.data;
  const slots = ev.lots.flatMap(l => Array.from({ length: qty[l.id] ?? 0 }, () => l.id));
  const total = slots.reduce((a, id) => a + Number(ev.lots.find(l => l.id === id)!.price), 0);
  const holder = (i: number): Holder => H[i] ?? blank;
  const patch = (i: number, p: Partial<Holder>) => setH(prev => { const n = [...prev]; while (n.length <= i) n.push({ ...blank }); n[i] = { ...n[i]!, ...p }; return n; });
  const step = (id: string, d: number, max: number) => setQty(p => ({ ...p, [id]: Math.max(0, Math.min(max, (p[id] ?? 0) + d)) }));

  async function submit() {
    if (!slots.length) return toast.error("Escolha ao menos um ingresso.");
    const errs: typeof errors = {};
    slots.forEach((_, i) => { const e = validate(holder(i)); if (Object.keys(e).length) errs[i] = e; });
    setErrors(errs);
    if (Object.keys(errs).length) return toast.error("Confira os dados destacados.");
    const ref = new URLSearchParams(search).get("ref") ?? sessionStorage.getItem(`ref:${slug}`) ?? undefined;
    if (ref) sessionStorage.setItem(`ref:${slug}`, ref);
    const pack = (i: number) => { const h = holder(i); return { name: h.name.trim(), cpf: h.cpf, email: h.email.trim(), phone: h.phone, instagram: h.instagram || undefined }; };
    const items = ev.lots.filter(l => (qty[l.id] ?? 0) > 0).map(l => ({ lotId: l.id, holders: slots.flatMap((id, i) => (id === l.id ? [pack(i)] : [])) }));
    try {
      const r = await create.mutateAsync({ eventSlug: slug, items, buyer: pack(0), affiliateCode: ref, acceptTerms: true });
      if (r.checkoutUrl) window.location.assign(r.checkoutUrl);
      else navigate(`/sucesso/${r.orderId}?vt=${r.voucherToken}`);
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      {ev.bannerUrl && <img src={ev.bannerUrl} alt={`Banner de ${ev.name}`} className="mb-5 aspect-[16/9] w-full rounded-2xl object-cover" />}
      <h1 className="text-3xl font-extrabold text-cocoa">{ev.name}</h1>
      <button type="button" className="mt-1 text-sm font-semibold text-brand underline" onClick={() => downloadText(`${ev.slug}.ics`, "text/calendar;charset=utf-8", buildIcs({ name: ev.name, date: new Date(ev.eventDate), place: ev.locationName, url: window.location.href }))}>Adicionar ao calendário</button>
      <p className="mt-1 text-sm">por {ev.producerSlugId ? <Link href={`/produtora/${ev.producerSlugId}`} className="font-semibold text-brand underline">{ev.producerName}</Link> : ev.producerName}</p>
      <p className="mt-3 flex items-center gap-2 text-sky-ink"><CalendarDays aria-hidden className="size-5" />{fmtFull(ev.eventDate)}</p>
      {ev.locationName && <p className="mt-1 flex items-center gap-2"><MapPin aria-hidden className="size-5" />{ev.locationName}</p>}
      {ev.description && <p className="mt-4 whitespace-pre-line text-[#3A2D26]">{ev.description}</p>}

      <h2 className="mb-3 mt-8 text-xl font-bold text-cocoa">Ingressos</h2>
      {ev.finished && <p className="rounded-lg border border-line bg-mist p-4">Este evento já aconteceu.</p>}
      {!ev.finished && !ev.lots.length && <p className="rounded-lg border border-line bg-mist p-4">Os ingressos ainda não foram liberados.</p>}
      <ul className="space-y-3">
        {!ev.finished && ev.lots.map(l => (
          <li key={l.id} className="ticket-notch flex items-center justify-between gap-3 rounded-xl border border-line bg-white p-4">
            <div><p className="font-bold">{l.title}</p>{l.description && <p className="text-sm text-[#6B5A50]">{l.description}</p>}
              <p className="num font-semibold text-brand">{Number(l.price) === 0 ? "Gratuito" : brl(l.price)}</p></div>
            {l.soldOut ? <span className="rounded-md border border-danger px-2 py-1 text-sm font-semibold text-danger">Esgotado</span> : (
              <div className="flex items-center gap-2" role="group" aria-label={`Quantidade de ${l.title}`}>
                <Button variant="outline" size="sm" aria-label="Diminuir" onClick={() => step(l.id, -1, l.available)}><Minus aria-hidden className="size-4" /></Button>
                <span className="num w-6 text-center font-bold" aria-live="polite">{qty[l.id] ?? 0}</span>
                <Button variant="outline" size="sm" aria-label="Aumentar" onClick={() => step(l.id, 1, l.available)}><Plus aria-hidden className="size-4" /></Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {slots.length > 0 && (
        <section className="fade-in mt-8" aria-labelledby="dados">
          <h2 id="dados" className="text-xl font-bold text-cocoa">Dados dos titulares</h2>
          <p className="mb-4 text-sm text-[#6B5A50]">Cada ingresso é nominal. Na portaria apresente o voucher e o documento original com foto. Os ingressos ficam reservados por 15 minutos.</p>
          {slots.map((id, i) => {
            const lot = ev.lots.find(l => l.id === id)!, e = errors[i] ?? {}, h = holder(i);
            return (
              <fieldset key={i} className="mb-4 space-y-3 rounded-xl border border-line p-4">
                <legend className="px-1 text-sm font-bold text-cocoa">Ingresso {i + 1} — {lot.title}</legend>
                <Field label="Nome completo" value={h.name} onChange={x => patch(i, { name: x.target.value })} error={e.name} autoComplete={i === 0 ? "name" : "off"} />
                <Field label="CPF" inputMode="numeric" value={h.cpf} onChange={x => patch(i, { cpf: maskInput.cpf(x.target.value) })} error={e.cpf} placeholder="000.000.000-00" />
                <Field label="E-mail" type="email" value={h.email} onChange={x => patch(i, { email: x.target.value })} error={e.email} autoComplete={i === 0 ? "email" : "off"} />
                <Field label="Telefone (WhatsApp)" inputMode="tel" value={h.phone} onChange={x => patch(i, { phone: maskInput.phone(x.target.value) })} error={e.phone} placeholder="(86) 99999-9999" />
                <Field label="Instagram (opcional)" value={h.instagram} onChange={x => patch(i, { instagram: x.target.value })} placeholder="@seuinstagram" hint="Ajuda a localizar você na portaria." />
              </fieldset>
            );
          })}
          <label className="mb-4 flex items-start gap-3 text-sm"><Checkbox checked={same} onCheckedChange={setSame} /><span>Os dados de contato do ingresso 1 também serão usados para o recibo da compra.</span></label>
          <label className="mb-4 flex items-start gap-3 text-sm"><Checkbox checked={accepted} onCheckedChange={setAccepted} /><span>Li e aceito os <Link href="/termos" className="font-semibold text-brand underline">Termos de uso</Link> e a <Link href="/privacidade" className="font-semibold text-brand underline">Política de Privacidade</Link>, e confirmo que os dados dos titulares estão corretos.</span></label>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-mist p-4">
            <p className="num text-lg font-bold">Total: {total === 0 ? "Gratuito" : brl(total)}</p>
            <Button size="lg" disabled={create.isPending || !same || !accepted} onClick={submit}>{create.isPending ? "Reservando…" : total === 0 ? "Garantir ingresso" : "Ir para o pagamento"}</Button>
          </div>
          <p className="mt-2 text-xs text-[#6B5A50]">O pagamento é feito no ambiente seguro da InfinitePay. O voucher só é liberado após a confirmação real do pagamento.</p>
        </section>
      )}
    </main>
  );
}
