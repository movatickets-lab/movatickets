const pad = (n: number) => String(n).padStart(2, "0");
const stamp = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Arquivo .ics (calendário) do evento; duração padrão de 4 h. */
export function buildIcs(e: { name: string; date: Date; place?: string | null; url: string }): string {
  const end = new Date(e.date.getTime() + 4 * 3_600_000);
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MOVA TICKETS//PT-BR", "BEGIN:VEVENT", `UID:${stamp(e.date)}-${esc(e.url)}@movatickets`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(e.date)}`, `DTEND:${stamp(end)}`, `SUMMARY:${esc(e.name)}`, ...(e.place ? [`LOCATION:${esc(e.place)}`] : []), `URL:${e.url}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
}
