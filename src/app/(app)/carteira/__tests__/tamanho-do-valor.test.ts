import { describe, expect, it } from "vitest";
import { classeDoValor, dolaresDoCartao } from "../tamanho-do-valor";

describe("valores dos cartões Brasil e Exterior", () => {
  it("valor curto fica com a letra grande; comprido diminui (e mais ainda abaixo de 360 px)", () => {
    expect(classeDoValor("R$ 40.199")).toBe("text-[19px]");
    expect(classeDoValor("R$ 666.051")).toContain("max-[359px]:text-[15px]");
    expect(classeDoValor("R$ 1.234.567")).toContain("text-[16px]");
    expect(classeDoValor("R$ 100.000.549.023")).toContain("text-[14px]");
  });
  it("dólares sem centavos a partir de US$ 10.000", () => {
    expect(dolaresDoCartao(251.47)).toBe("US$ 251,47");
    expect(dolaresDoCartao(7152)).toBe("US$ 7.152,00");
    expect(dolaresDoCartao(123456.78)).toBe("US$ 123.457");
  });
});
