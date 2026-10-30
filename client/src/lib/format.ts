const TZ = "America/Fortaleza";
export const brl = (v: string | number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const brlCents = (c: number) => brl(c / 100);
export const fmtDate = (d: Date | string) => new Date(d).toLocaleString("pt-BR", { timeZone: TZ, weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
export const fmtDay = (d: Date | string) => new Date(d).toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "short" });
export const fmtFull = (d: Date | string) => new Date(d).toLocaleString("pt-BR", { timeZone: TZ, dateStyle: "full", timeStyle: "short" });
export const maskInput = {
  cpf: (v: string) => { const d = v.replace(/\D/g, "").slice(0, 11); return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2"); },
  phone: (v: string) => { const d = v.replace(/\D/g, "").slice(0, 11); return d.length > 10 ? d.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3") : d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, ""); },
};
export function isValidCpf(raw: string): boolean {
  const c = raw.replace(/\D/g, "");
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  for (let t = 9; t < 11; t++) { let s = 0; for (let i = 0; i < t; i++) s += Number(c[i]) * (t + 1 - i); if (((s * 10) % 11) % 10 !== Number(c[t])) return false; }
  return true;
}
