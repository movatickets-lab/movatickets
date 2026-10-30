import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { toast } from "sonner";
import { AuthGate } from "@/components/AuthGate";
import { GateCheckinPanel } from "@/components/GateCheckinPanel";
import { Button } from "@/components/ui/button";
import { fmtFull } from "@/lib/format";
import { trpc } from "@/lib/trpc";

function Gate({ eventId }: { eventId: string }) {
  const info = trpc.ticketing.checkin.eventInfo.useQuery({ eventId }, { retry: false });
  const [scan, setScan] = useState(false);
  const [code, setCode] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!scan || !video.current) return;
    let controls: IScannerControls | undefined, stopped = false;
    new BrowserQRCodeReader().decodeFromVideoDevice(undefined, video.current, r => { if (r) { setCode(r.getText()); setScan(false); } })
      .then(c => { if (stopped) c.stop(); else controls = c; })
      .catch(() => { toast.error("Câmera indisponível. Use a busca manual."); setScan(false); });
    return () => { stopped = true; controls?.stop(); };
  }, [scan]);
  if (info.isLoading) return <p className="p-10 text-center">Carregando…</p>;
  if (info.error || !info.data) return <p role="alert" className="p-10 text-center">Evento não encontrado ou sem permissão para a portaria.</p>;
  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 py-6">
      <div><h1 className="text-xl font-extrabold text-cocoa">Portaria · {info.data.name}</h1><p className="text-sm text-[#6B5A50]">{fmtFull(info.data.eventDate)} · {info.data.locationName}</p></div>
      <div className="space-y-3">
        <Button variant={scan ? "outline" : "primary"} onClick={() => setScan(s => !s)}>{scan ? "Parar leitura" : "Ler QR Code"}</Button>
        {scan && <video ref={video} className="w-full rounded-xl bg-black" muted playsInline aria-label="Câmera para ler o QR Code do ingresso" />}
        {code && <p className="text-sm">QR lido: <span className="font-mono">{code}</span></p>}
      </div>
      <GateCheckinPanel eventId={eventId} scannedCode={code} />
    </main>
  );
}

export default function GatePage() {
  const { eventId } = useParams<{ eventId: string }>();
  return <AuthGate><Gate eventId={eventId} /></AuthGate>;
}
