import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/money/MoneyProvider", () => ({ useCurrency: () => "BRL" }));

import { campo, digitar } from "./digitar-no-campo";

describe("CampoDeDinheiro", () => {
  it("abre o teclado com vírgula (decimal) e é texto, não number", () => {
    const p = campo(null, () => {});
    expect(p.inputMode).toBe("decimal");
    expect(p.type).toBe("text");
  });

  it("mostra o valor com centavos", () => {
    expect(campo(1234.56, () => {}).value).toBe("1.234,56");
    expect(campo(0.99, () => {}).value).toBe("0,99");
    expect(campo(null, () => {}).value).toBe("");
    expect(campo(1234.56, () => {}, { comSimbolo: true }).value).toMatch(/^R\$\s1\.234,56$/);
  });

  it("digitar 1234,56 salva 1234,56 (antes salvava 123456)", () => {
    expect(digitar("1234,56")).toBe(1234.56);
  });

  it("digitar 0,99 salva 0,99", () => {
    expect(digitar("0,99")).toBe(0.99);
  });

  it("digitar só dígitos: os dois últimos são os centavos", () => {
    expect(digitar("123456")).toBe(1234.56);
  });

  it("apagar tira o último dígito, e apagar tudo esvazia", () => {
    expect(digitar("123456⌫")).toBe(123.45);
    // "0,12" → "0,1" (R$ 0,01) → "0,0" (zero): o campo fica vazio.
    const zerado = digitar("12⌫⌫");
    expect(zerado ?? 0).toBe(0);
    expect(campo(zerado, () => {}).value).toBe("");
  });

  it("colar 1.234,56 ou 1234.56 dá o mesmo valor", () => {
    let v: number | null = null;
    campo(null, (x) => (v = x)).onChange({ target: { value: "1.234,56" } });
    expect(v).toBe(1234.56);
    campo(null, (x) => (v = x)).onChange({ target: { value: "1234.56" } });
    expect(v).toBe(1234.56);
  });

  it("respeita o teto", () => {
    expect(digitar("99999999", null, { max: 1000 })).toBe(1000);
  });
});
