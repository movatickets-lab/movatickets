import { describe, expect, it } from "vitest";
import { commissionCents, isValidCnpj, isValidCpf, normalizeInfiniteTag, normalizeInstagram, slugify } from "./util";

describe("documentos", () => {
  it("valida CPF e CNPJ pelos dígitos verificadores", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-82")).toBe(false);
  });
});
describe("normalizações", () => {
  it("InfiniteTag sem $ e só com caracteres seguros", () => {
    expect(normalizeInfiniteTag("$MinhaTag")).toBe("minhatag");
    expect(normalizeInfiniteTag("a b")).toBeNull();
    expect(normalizeInfiniteTag("x")).toBeNull();
  });
  it("Instagram aceita @handle e URL", () => {
    expect(normalizeInstagram("@Maria.Silva")).toBe("maria.silva");
    expect(normalizeInstagram("https://instagram.com/maria.silva/")).toBe("maria.silva");
    expect(normalizeInstagram("<script>")).toBeNull();
  });
  it("slug sem acentos", () => expect(slugify("São João do Piauí!")).toBe("sao-joao-do-piaui"));
});
describe("comissão", () => {
  it("arredonda ao centavo e congela por taxa percentual", () => {
    expect(commissionCents(10000, "10.00")).toBe(1000);
    expect(commissionCents(3333, "7.50")).toBe(250);
    expect(commissionCents(5000, "0.00")).toBe(0);
  });
});
