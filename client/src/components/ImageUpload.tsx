import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Props = { organizationId: string; kind: "logo" | "cover" | "banner"; label: string; value?: string | null; onChange: (url: string) => void };

/** Envia a imagem ao servidor (PNG/JPG/WEBP até 5 MB). O servidor confere o tipo pelos bytes. */
export function ImageUpload({ organizationId, kind, label, value, onChange }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("A imagem deve ter até 5 MB.");
    setBusy(true);
    try {
      const res = await fetch(`/api/upload/${kind}?organizationId=${encodeURIComponent(organizationId)}`, { method: "POST", headers: { "content-type": file.type }, body: file, credentials: "same-origin" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Falha no envio.");
      onChange(data.url);
      toast.success("Imagem enviada.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha no envio."); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  };
  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-cocoa">{label}</span>
      {value ? <img src={value} alt={`Pré-visualização: ${label}`} className="h-28 w-full max-w-sm rounded-lg border border-line object-cover" /> : <p className="text-xs text-[#6B5A50]">Nenhuma imagem enviada.</p>}
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" id={`up-${kind}`} onChange={e => void pick(e.target.files?.[0])} />
      <Button variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Enviando…" : value ? "Trocar imagem" : "Enviar imagem"}</Button>
    </div>
  );
}
