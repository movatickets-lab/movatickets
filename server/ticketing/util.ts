import { randomBytes } from "node:crypto";

export const onlyDigits = (s: string) => s.replace(/\D/g, "");
export const formatCpf = (d: string) => `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;

export function isValidCpf(raw: string): boolean {
  const c = onlyDigits(raw);
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  for (let t = 9; t < 11; t++) {
    let s = 0;
    for (let i = 0; i < t; i++) s += Number(c[i]) * (t + 1 - i);
    if (((s * 10) % 11) % 10 !== Number(c[t])) return false;
  }
  return true;
}

export function isValidCnpj(raw: string): boolean {
  const c = onlyDigits(raw);
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calc = (len: number) => {
    let sum = 0, pos = len - 7;
    for (let i = len; i >= 1; i--) { sum += Number(c[len - i]) * pos--; if (pos < 2) pos = 9; }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(c[12]) && calc(13) === Number(c[13]);
}

export const isValidDocument = (raw: string) => (onlyDigits(raw).length === 14 ? isValidCnpj(raw) : isValidCpf(raw));

export const slugify = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "item";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function randomCode(len: number, alphabet = ALPHABET): string {
  const b = randomBytes(len);
  return Array.from(b, x => alphabet[x % alphabet.length]).join("");
}

export const normalizeInstagram = (s?: string | null) => {
  const h = (s ?? "").trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/\/.*$/, "").toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(h) ? h : null;
};

/** InfiniteTag sem o "$" inicial; só caracteres seguros. */
export function normalizeInfiniteTag(raw: string): string | null {
  const t = raw.trim().replace(/^\$/, "").toLowerCase();
  return /^[a-z0-9._-]{2,40}$/.test(t) ? t : null;
}

/** Comissão do afiliado em centavos, a partir da taxa percentual (ex.: "10.00" = 10%). Arredonda ao centavo. */
export function commissionCents(unitCents: number, ratePercent: string): number {
  const [i, f = ""] = ratePercent.split(".");
  const basisPoints = Number(i) * 100 + Number(f.padEnd(2, "0").slice(0, 2));
  return Math.round((unitCents * basisPoints) / 10_000);
}

export const centsToDecimal = (c: number) => (c / 100).toFixed(2);

export function brPhoneE164(raw: string): string | undefined {
  const d = onlyDigits(raw);
  if (d.length === 10 || d.length === 11) return `+55${d}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return `+${d}`;
  return undefined;
}
