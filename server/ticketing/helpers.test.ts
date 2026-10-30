import { describe, expect, it } from "vitest";
import { csvCell, csvRow, maskCpf, parseLookup, sanitizeSummary } from "./helpers";

describe("portaria", () => {
  it("mascara o CPF no formato do voucher", () => {
    expect(maskCpf("123.456.789-09")).toBe("***.***.789-**");
    expect(maskCpf("123")).toBe("***");
  });
  it("interpreta CPF completo e Instagram; recusa buscas curtas", () => {
    expect(parseLookup("12345678909")).toEqual({ kind: "cpf", values: ["12345678909", "123.456.789-09"] });
    expect(parseLookup("@Maria.Silva")).toEqual({ kind: "instagram", values: ["maria.silva", "@maria.silva"] });
    expect(parseLookup("12345")).toBeNull();
    expect(parseLookup("ab")).toBeNull();
  });
});

describe("auditoria", () => {
  it("descarta campos que possam carregar PII ou segredos", () => {
    expect(sanitizeSummary({ eventId: "e1", cpf: "123", buyerEmail: "a@b.c", voucherToken: "x", rowCount: 3, confirmed: true })).toEqual({ eventId: "e1", rowCount: 3, confirmed: true });
    expect(sanitizeSummary({ cpf: "1" })).toBeNull();
  });
});

describe("CSV", () => {
  it("neutraliza injeção de fórmula e escapa aspas", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+55")).toBe("'+55");
    expect(csvCell(-1)).toBe("-1");
    expect(csvCell("10.50")).toBe("10.50");
    expect(csvRow(["a,b", null, 3])).toBe("\"a,b\",,3");
  });
});
