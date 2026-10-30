import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { toDataURL } from "qrcode";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadVoucher, type VoucherData } from "@/lib/voucherFile";
import { fmtFull } from "@/lib/format";

export type VoucherTicket = { code: string; status: "VALID" | "USED" | "CANCELLED"; holderName: string; lotTitle: string; cpfMasked: string; cpfForFile: string };
const LABEL = { VALID: "Válido", USED: "Já utilizado", CANCELLED: "Cancelado" } as const;

export function VoucherCard({ t, ev }: { t: VoucherTicket; ev: { eventName: string; eventDate: Date | string; locationName: string | null } }) {
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState<"png" | "pdf" | null>(null);
  useEffect(() => { void toDataURL(t.code, { margin: 1, width: 280 }).then(setQr); }, [t.code]);
  const data: VoucherData = { code: t.code, holderName: t.holderName, lotTitle: t.lotTitle, cpf: t.cpfForFile, eventName: ev.eventName, eventDate: new Date(ev.eventDate).toISOString(), locationName: ev.locationName };
  const dl = async (f: "png" | "pdf") => { setBusy(f); try { await downloadVoucher(data, f); } catch { toast.error("Não foi possível gerar o arquivo. Tente novamente."); } finally { setBusy(null); } };
  return (
    <article className="ticket-notch fade-in overflow-hidden rounded-2xl border border-line bg-white">
      <div className="bg-cocoa p-4 text-white"><p className="text-xs font-extrabold tracking-widest text-[#FF9A63]">MOVA TICKETS</p><h3 className="text-xl font-bold">{ev.eventName}</h3><p className="text-sm text-white/85">{fmtFull(ev.eventDate)}</p></div>
      <div className="grid gap-4 p-4 sm:grid-cols-[1fr_auto]">
        <div className="space-y-1">
          <p className="text-sm font-bold text-brand">{t.lotTitle}</p><p className="text-lg font-bold">{t.holderName}</p>
          <p className="num text-sm">CPF <span className="font-mono">{t.cpfMasked}</span></p>
          <p className="font-mono text-sm">{t.code}</p>
          <p className={`inline-block rounded-md border px-2 py-0.5 text-xs font-bold ${t.status === "VALID" ? "border-leaf-ink text-leaf-ink" : "border-danger text-danger"}`}>{LABEL[t.status]}</p>
        </div>
        {qr && <img src={qr} alt={`QR Code do ingresso ${t.code}`} className="size-36 justify-self-center" />}
      </div>
      <div className="flex flex-wrap gap-2 border-t border-line p-3">
        <Button variant="outline" size="sm" disabled={!!busy} onClick={() => dl("png")}><Download aria-hidden className="size-4" />{busy === "png" ? "Gerando…" : "Baixar PNG"}</Button>
        <Button variant="outline" size="sm" disabled={!!busy} onClick={() => dl("pdf")}><Download aria-hidden className="size-4" />{busy === "pdf" ? "Gerando…" : "Baixar PDF"}</Button>
        <p className="w-full text-xs text-[#6B5A50]">Na tela o CPF aparece mascarado; o arquivo baixado leva o CPF completo para conferência na portaria.</p>
      </div>
    </article>
  );
}
