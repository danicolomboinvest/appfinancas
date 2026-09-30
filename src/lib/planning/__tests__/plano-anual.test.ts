import { describe, expect, it } from "vitest";
import { anoFechado, mesDeReferenciaDasDicas, mesDeReferenciaDoPlano, mesesQueFaltamNoAno, mesesQueOSalvarGrava, mudouDoCarregado } from "../plano-anual";

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

describe("mesDeReferenciaDasDicas", () => {
  it("ano corrente: o último mês fechado", () => {
    expect(mesDeReferenciaDasDicas(2026, setembro2026)).toEqual({ year: 2026, month: 8 });
  });

  it("janeiro olha pra dezembro do ano anterior", () => {
    expect(mesDeReferenciaDasDicas(2027, new Date(2027, 0, 10))).toEqual({ year: 2026, month: 12 });
  });

  it("ano futuro: também o último mês fechado, não dezembro do ano novo (que ainda está vazio)", () => {
    const dezembro2026 = new Date(2026, 11, 15);
    expect(mesDeReferenciaDasDicas(2027, dezembro2026)).toEqual({ year: 2026, month: 11 });
  });

  it("ano que já fechou: o dezembro dele", () => {
    expect(mesDeReferenciaDasDicas(2025, setembro2026)).toEqual({ year: 2025, month: 12 });
  });
});

describe("mesesQueFaltamNoAno", () => {
  it("bate com o que o Salvar grava no ano corrente", () => {
    expect(mesesQueFaltamNoAno(2026, setembro2026)).toBe(mesesQueOSalvarGrava(2026, setembro2026).length);
    expect(mesesQueFaltamNoAno(2026, setembro2026)).toBe(4);
    expect(mesesQueFaltamNoAno(2026, new Date(2026, 11, 31, 22, 0))).toBe(1);
  });

  it("nos outros anos são os 12", () => {
    expect(mesesQueFaltamNoAno(2027, setembro2026)).toBe(12);
  });
});
