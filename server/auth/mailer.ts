import { env } from "../env";

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Envio transacional via Brevo (POST /v3/smtp/email, chave no header api-key). Sem chave: registra no log (somente dev). */
export async function sendMail(to: string, subject: string, intro: string, link: string, cta: string): Promise<void> {
  const html = `<div style="font-family:system-ui,sans-serif;max-width:480px"><h2 style="color:#BF4A15">MOVA TICKETS</h2><p>${esc(intro)}</p><p><a href="${esc(link)}" style="background:#BF4A15;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;display:inline-block">${esc(cta)}</a></p><p style="color:#666;font-size:13px">Se o botão não funcionar, copie este endereço no navegador:<br>${esc(link)}</p><p style="color:#666;font-size:13px">Se você não pediu isto, ignore este e-mail.</p></div>`;
  const key = env.brevoKey();
  if (!key) {
    if (env.isProd()) throw new Error("BREVO_API_KEY não configurada.");
    console.log(`[mail:dev] para=${to} assunto=${subject} link=${link}`);
    return;
  }
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ sender: { name: env.mailFromName(), email: env.mailFromEmail() }, to: [{ email: to }], subject, htmlContent: html }),
  });
  if (!res.ok) throw new Error(`Brevo respondeu HTTP ${res.status}`);
}
