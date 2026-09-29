import { describe, expect, it } from "vitest";
import { anoFechado, mesDeReferenciaDoPlano, mesesQueOSalvarGrava, mudouDoCarregado } from "../plano-anual";

const setembro2026 = new Date(2026, 8, 28, 10, 0, 0);

describe("mesesQueOSalvarGrava", () => {
  it("ano corrente: do mês atual até dezembro", () => {
    expect(mesesQueOSalvarGrava(2026, setembro2026)).toEqual([9, 10, 11, 12]);
  });

  it("ano futuro: os 12 meses", () => {
    expect(mesesQueOSalvarGrava(2027, setembro2026)).toHaveLength(12);
  });

  it("ano que já fechou: nenhum mês (nem renda nem aporte reescrevem a história)", () => {
    expect(mesesQueOSalvarGrava(2025, setembro2026)).toEqual([]);
    expect(anoFechado(2025, setembro2026)).toBe(true);
    expect(anoFechado(2026, setembro2026)).toBe(false);
  });
});

describe("mesDeReferenciaDoPlano", () => {
  it("é o mês corrente no ano corrente e janeiro nos outros", () => {
    expect(mesDeReferenciaDoPlano(2026, setembro2026)).toBe(9);
    expect(mesDeReferenciaDoPlano(2027, setembro2026)).toBe(1);
  });
});

describe("mudouDoCarregado", () => {
  it("valor igual ao carregado não é gravado (o ajuste só deste mês fica só neste mês)", () => {
    expect(mudouDoCarregado("1500", "1500")).toBe(false);
    expect(mudouDoCarregado("1500.00", "1500")).toBe(false);
  });

  it("valor diferente é gravado", () => {
    expect(mudouDoCarregado("1800", "1500")).toBe(true);
    expect(mudouDoCarregado("0", "1500")).toBe(true);
  });

  it("sem o valor carregado (formulário antigo), grava como antes", () => {
    expect(mudouDoCarregado("1500", null)).toBe(true);
    expect(mudouDoCarregado("1500", "")).toBe(true);
  });

  it("valor inválido segue pra validação", () => {
    expect(mudouDoCarregado("abc", "1500")).toBe(true);
  });
});
