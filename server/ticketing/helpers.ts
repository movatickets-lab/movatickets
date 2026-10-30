// Funções puras (sem I/O) usadas pelos roteadores de portaria, relatórios e auditoria.

export function maskCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, "");
  return d.length === 11 ? `***.***.${d.slice(6, 9)}-**` : "***";
}

export type LookupQuery =
  | { kind: "cpf"; values: string[] }
  | { kind: "instagram"; values: string[] }
  | null;

/** Interpreta o texto digitado na portaria. Exige CPF completo ou @instagram com 3+ caracteres. */
export function parseLookup(raw: string): LookupQuery {
  const q = raw.trim();
  const d = q.replace(/\D/g, "");
  if (d.length === 11 && !/[a-z]/i.test(q)) {
    return { kind: "cpf", values: [d, `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`] };
  }
  // Se for numérico mas não tiver 11 dígitos, recusa (não é CPF nem username de Instagram válido)
  if (/^\d+$/.test(q)) return null;

  // Só aceita como Instagram se começar com @ ou contiver letras
  const hasAt = q.startsWith("@");
  const handle = q.replace(/^@/, "").toLowerCase();
  
  if ((hasAt || /[a-z]/i.test(handle)) && /^[a-z0-9._]{3,30}$/.test(handle)) {
    return { kind: "instagram", values: [handle, `@${handle}`] };
  }
  return null;
}

const FORBIDDEN_AUDIT_KEY = /cpf|email|phone|fone|token|hash|voucher|password|senha|secret|name|nome|qr|payload/i;

/** Remove do resumo de auditoria qualquer campo que possa carregar PII, credencial ou token. */
export function sanitizeSummary(
  input: Record<string, unknown> | null | undefined,
): Record<string, string | number | boolean | null> | null {
  if (!input) return null;
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(input)) {
    if (FORBIDDEN_AUDIT_KEY.test(key)) continue;
    if (value === null || typeof value === "number" || typeof value === "boolean") out[key] = value as string | number | boolean | null;
    else if (typeof value === "string") out[key] = value.slice(0, 200);
  }
  return Object.keys(out).length ? out : null;
}

const NUMERIC = /^-?\d+(\.\d+)?$/;

/** Célula CSV segura: escapa aspas/quebras e neutraliza injeção de fórmula (=, +, -, @). */
export function csvCell(value: string | number | null | undefined): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (typeof value === "string" && !NUMERIC.test(s) && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvRow(values: Array<string | number | null | undefined>): string {
  return values.map(csvCell).join(",");
}
