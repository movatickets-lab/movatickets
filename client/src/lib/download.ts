function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
export const downloadText = (filename: string, mime: string, content: string) => save(new Blob([content], { type: mime }), filename);
export function downloadBase64(filename: string, mime: string, b64: string) {
  const bin = atob(b64), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  save(new Blob([bytes], { type: mime }), filename);
}
