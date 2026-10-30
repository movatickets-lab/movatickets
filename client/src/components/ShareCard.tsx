import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Cartão de divulgação com QR Code da página pública (URL permanente). Baixa em PNG 1080×1350 (4:5). */
export function ShareCard({ title, url, logoUrl }: { title: string; url: string; logoUrl?: string | null }) {
  const [qr, setQr] = useState("");
  useEffect(() => { void QRCode.toDataURL(url, { width: 220, margin: 1 }).then(setQr); }, [url]);

  const download = async () => {
    try {
      const c = document.createElement("canvas"); c.width = 1080; c.height = 1350;
      const g = c.getContext("2d")!;
      g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, 1080, 1350);
      g.fillStyle = "#402F27"; g.fillRect(0, 0, 1080, 260);
      g.fillStyle = "#FFFFFF"; g.font = "800 64px system-ui, sans-serif"; g.textAlign = "center"; g.fillText("MOVA TICKETS", 540, 150);
      g.fillStyle = "#BF4A15"; g.fillRect(0, 260, 1080, 12);
      g.fillStyle = "#402F27"; g.font = "800 72px system-ui, sans-serif";
      const words = title.split(" "); let line = "", y = 450; 
      for (const w of words) { const t = line ? `${line} ${w}` : w; if (g.measureText(t).width > 900 && line) { g.fillText(line, 540, y); y += 86; line = w; } else line = t; }
      g.fillText(line, 540, y);
      const img = new Image(); img.src = await QRCode.toDataURL(url, { width: 560, margin: 2 }); await img.decode();
      g.drawImage(img, 260, 640, 560, 560);
      g.fillStyle = "#273A40"; g.font = "500 34px system-ui, sans-serif"; g.fillText("Aponte a câmera e veja nossos eventos", 540, 1255);
      g.font = "500 26px ui-monospace, monospace"; g.fillText(url.replace(/^https?:\/\//, ""), 540, 1305);
      const a = Object.assign(document.createElement("a"), { href: c.toDataURL("image/png"), download: "cartao-mova-tickets.png" });
      a.click();
    } catch { toast.error("Não foi possível gerar o cartão."); }
  };
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-line p-4">
      {qr && <img src={qr} alt={`QR Code da página pública de ${title}`} className="h-28 w-28 rounded-lg border border-line" />}
      <div className="space-y-2"><p className="text-sm">Link permanente: <span className="break-all font-mono">{url}</span></p>
        <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => void navigator.clipboard.writeText(url).then(() => toast.success("Link copiado."))}>Copiar link</Button><Button size="sm" onClick={() => void download()}>Baixar cartão (PNG)</Button></div></div>
      {logoUrl && <span className="sr-only">Logo cadastrada</span>}
    </div>
  );
}
