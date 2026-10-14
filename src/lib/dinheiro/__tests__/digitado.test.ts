import { describe, expect, it } from "vitest";
import { centavosDoTexto, reaisDoCampo, reaisDoTexto } from "../digitado";

/**
 * O bug dos centavos (14/10/2026): uma cliente pediu reembolso porque "na hora de registrar certas
 * dívidas não dava pra colocar os centavos". O campo lia "1234,56" como R$ 123.456.
 */
describe("reaisDoTexto: dígitos como centavos, igual ao CurrencyField", () => {
  it.each([
    ["1234,56", 1234.56],
    ["1.234,56", 1234.56],
    ["1234.56", 1234.56],
    ["R$ 1.234,56", 1234.56],
    ["0,99", 0.99],
    ["0,05", 0.05],
    ["1234", 12.34],
    ["123456", 1234.56],
    ["00012", 0.12],
  ])("%s vira %s", (texto, reais) => {
    expect(reaisDoTexto(texto)).toBe(reais);
  });

  it("vazio (ou sem nenhum dígito) é null, não zero", () => {
    expect(reaisDoTexto("")).toBeNull();
    expect(reaisDoTexto("R$ ")).toBeNull();
    expect(centavosDoTexto(",")).toBeNull();
  });

  it("centavos sempre inteiros", () => {
    expect(centavosDoTexto("1.234,56")).toBe(123456);
    expect(Number.isInteger(centavosDoTexto("0,99"))).toBe(true);
  });

  it("digitando na máscara: cada dígito entra pela direita e apagar tira o último", () => {
    // O campo mostra "1.234,5" depois do backspace em "1.234,56": vira 123,45, como na maquininha.
    expect(reaisDoTexto("1.234,5")).toBe(123.45);
    expect(reaisDoTexto("1.234,567")).toBe(12345.67);
  });

  it("número gigante não perde a conta", () => {
    expect(centavosDoTexto("9".repeat(30))).toBe(9_999_999_999_999);
  });
});

describe("reaisDoCampo: texto livre que chega no servidor", () => {
  it.each([
    ["1234,56", 1234.56],
    ["1.234,56", 1234.56],
    ["1234.56", 1234.56],
    ["1234.5", 1234.5],
    ["0,99", 0.99],
    ["1234", 1234],
    ["1.234", 1234],
    ["1.500", 1500],
    ["1.234.567", 1234567],
  ])("%s vira %s", (texto, reais) => {
    expect(reaisDoCampo(texto)).toBe(reais);
  });

  it("vazio ou sem número é null", () => {
    expect(reaisDoCampo("")).toBeNull();
    expect(reaisDoCampo("abc")).toBeNull();
  });
});
