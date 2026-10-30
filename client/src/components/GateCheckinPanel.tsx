import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

type Props = { eventId: string; scannedCode?: string };

const STATUS_LABEL = { VALID: "Válido", USED: "Já utilizado", CANCELLED: "Cancelado" } as const;

/** Painel de check-in para /portaria/:eventId. O sucesso só aparece após a resposta do servidor. */
export function GateCheckinPanel({ eventId, scannedCode }: Props) {
  const utils = trpc.useUtils();
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const lookup = trpc.ticketing.checkin.lookup.useQuery({ eventId, query: submitted }, { enabled: submitted.length >= 3, retry: false });
  const byCode = trpc.ticketing.checkin.byCode.useQuery({ eventId, code: scannedCode ?? "" }, { enabled: (scannedCode?.length ?? 0) >= 6, retry: false });

  const candidates = [...(byCode.data?.candidate ? [byCode.data.candidate] : []), ...(lookup.data?.candidates ?? [])];
  const selected = candidates.find(c => c.ticketId === selectedId) ?? null;

  const validate = trpc.ticketing.checkin.validate.useMutation({
    onSuccess: () => {
      toast.success("Entrada validada.");
      setConfirmed(false);
      setSelectedId(null);
      void utils.ticketing.checkin.lookup.invalidate();
      void utils.ticketing.checkin.byCode.invalidate();
    },
    onError: err => toast.error(err.message),
  });

  return (
    <section className="space-y-4" aria-label="Check-in na portaria">
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); setSelectedId(null); setSubmitted(text.trim()); }}>
        <Input value={text} onChange={e => setText(e.target.value)} placeholder="CPF completo ou @instagram" inputMode="search" aria-label="Buscar participante" />
        <Button type="submit" disabled={text.trim().length < 3}>Buscar</Button>
      </form>

      {lookup.data?.hint && <p className="text-sm text-muted-foreground">{lookup.data.hint}</p>}
      {submitted && !lookup.isLoading && lookup.data && lookup.data.candidates.length === 0 && !lookup.data.hint && (
        <p className="text-sm">Nenhum ingresso aprovado encontrado para este evento.</p>
      )}

      <ul className="space-y-2">
        {candidates.map(c => (
          <li key={c.ticketId}>
            <button type="button" onClick={() => { setSelectedId(c.ticketId); setConfirmed(false); }} aria-pressed={c.ticketId === selectedId}
              className={`w-full rounded-lg border p-3 text-left ${c.ticketId === selectedId ? "border-[#BF4A15] ring-2 ring-[#BF4A15]/40" : ""}`}>
              <span className="block font-medium">{c.holderName}</span>
              <span className="block text-sm tabular-nums">CPF {c.holderCpfMasked} · {c.lotTitle}</span>
              <span className="block font-mono text-xs">{c.ticketCode} — {STATUS_LABEL[c.status]}</span>
            </button>
          </li>
        ))}
      </ul>

      {selected && (
        <div className="space-y-3 rounded-lg border p-4">
          {selected.status !== "VALID" ? (
            <p role="alert" className="font-medium">Entrada bloqueada: ingresso {STATUS_LABEL[selected.status].toLowerCase()}.</p>
          ) : (
            <>
              <label className="flex items-start gap-3 text-sm">
                <Checkbox checked={confirmed} onCheckedChange={v => setConfirmed(v === true)} />
                <span>Conferi o voucher e o documento original com foto</span>
              </label>
              <Button className="w-full" disabled={!confirmed || validate.isPending}
                onClick={() => validate.mutate({ eventId, ticketId: selected.ticketId, confirmedVoucherAndPhotoId: true })}>
                {validate.isPending ? "Validando…" : "Validar entrada"}
              </Button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
