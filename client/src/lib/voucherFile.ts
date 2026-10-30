import { toDataURL } from "qrcode";

export type VoucherData = { code: string; holderName: string; lotTitle: string; cpf: string; eventName: string; eventDate: string; locationName: string | null };

const st = (el: HTMLElement, css: Partial<CSSStyleDeclaration>) => Object.assign(el.style, css);
const txt = (parent: HTMLElement, text: string, css: Partial<CSSStyleDeclaration>) => { const d = document.createElement("div"); d.textContent = text; st(d, css); parent.appendChild(d); return d; };

/** Monta o voucher 1080x1350 (4:5) com textContent (sem HTML injetado). O arquivo leva o CPF COMPLETO para conferência na portaria. */
async function buildNode(v: VoucherData): Promise<HTMLElement> {
  const root = document.createElement("div");
  st(root, { position: "fixed", left: "-10000px", top: "0", width: "1080px", height: "1350px", background: "#FFFFFF", fontFamily: "system-ui, Segoe UI, Arial, sans-serif", color: "#1C1613", boxSizing: "border-box" });
  const head = document.createElement("div"); st(head, { background: "#402F27", color: "#fff", padding: "56px 64px", height: "300px", boxSizing: "border-box" });
  txt(head, "MOVA TICKETS", { fontSize: "34px", letterSpacing: "8px", fontWeight: "800", color: "#FF9A63" });
  txt(head, v.eventName, { fontSize: "58px", fontWeight: "800", marginTop: "18px", lineHeight: "1.1" });
  root.appendChild(head);
  const body = document.createElement("div"); st(body, { padding: "48px 64px" });
  txt(body, new Date(v.eventDate).toLocaleString("pt-BR", { timeZone: "America/Fortaleza", dateStyle: "full", timeStyle: "short" }), { fontSize: "34px", color: "#0B6F8A", fontWeight: "700" });
  if (v.locationName) txt(body, v.locationName, { fontSize: "30px", marginTop: "8px" });
  txt(body, v.lotTitle, { fontSize: "30px", marginTop: "24px", color: "#BF4A15", fontWeight: "800" });
  txt(body, v.holderName, { fontSize: "46px", fontWeight: "800", marginTop: "14px" });
  txt(body, `CPF ${v.cpf}`, { fontSize: "34px", marginTop: "6px", fontVariantNumeric: "tabular-nums" });
  const qr = document.createElement("img"); qr.src = await toDataURL(v.code, { margin: 1, width: 440 }); st(qr, { width: "440px", height: "440px", display: "block", margin: "36px auto 12px" });
  body.appendChild(qr);
  txt(body, v.code, { fontSize: "40px", fontFamily: "ui-monospace, Menlo, monospace", textAlign: "center", fontWeight: "700" });
  txt(body, "Apresente este voucher e o documento original com foto.", { fontSize: "26px", textAlign: "center", marginTop: "18px", color: "#4A3A30" });
  root.appendChild(body);
  return root;
}

const save = (href: string, name: string) => { const a = Object.assign(document.createElement("a"), { href, download: name }); document.body.appendChild(a); a.click(); a.remove(); };

export async function downloadVoucher(v: VoucherData, format: "png" | "pdf") {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
  const node = await buildNode(v);
  document.body.appendChild(node);
  try {
    await Promise.all(Array.from(node.querySelectorAll("img")).map(i => (i.complete ? null : new Promise(r => { i.onload = i.onerror = () => r(null); }))));
    const canvas = await html2canvas(node, { width: 1080, height: 1350, scale: 1, backgroundColor: "#FFFFFF", useCORS: true });
    if (format === "png") save(canvas.toDataURL("image/png"), `ingresso-${v.code}.png`);
    else { const pdf = new jsPDF({ unit: "px", format: [1080, 1350], orientation: "portrait" }); pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 1080, 1350); pdf.save(`ingresso-${v.code}.pdf`); }
  } finally { node.remove(); }
}
