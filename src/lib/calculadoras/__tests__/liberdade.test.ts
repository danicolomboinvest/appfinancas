import { describe, expect, it } from "vitest";
import { EXEMPLO_LIBERDADE, contaDaLiberdade, deParametros, paraParametros, patrimonioNecessario, prazoDaLiberdade } from "../liberdade";

/**
 * A Liberdade virou calculadora (11/10/2026) com as MESMAS contas da Aposentadoria. Os números
 * abaixo saíram das fórmulas antigas (computeAccumulation e computeUsufruct) antes da mudança:
 * se algum mudar, a conta mudou.
 */
describe("Liberdade financeira: as contas antigas, travadas", () => {
  it("o exemplo (35 → 60 anos, R$ 1.000 por mês, 10% e 4,5% ao ano, 4% na renda)", () => {
    const r = contaDaLiberdade(EXEMPLO_LIBERDADE);
    expect(r.acumulo.finalValueReal).toBeCloseTo(608143.7262749781, 6);
    expect(r.acumulo.finalValueNominal).toBeCloseTo(1233324.8995390988, 6);
    expect(r.acumulo.totalInvested).toBe(300000);
    expect(r.renda.totalPassiveIncome).toBeCloseTo(2027.145754249927, 6);
    expect(r.renda.surplusOrDeficit).toBeCloseTo(-5972.854245750073, 6);
    expect(r.daPe).toBe(false);
    expect(r.anos).toBe(25);
  });
  it("com patrimônio, outra renda e taxas diferentes", () => {
    const r = contaDaLiberdade({ rendaDesejada: 12000, outraRenda: 1500, idade: 30, idadeParar: 55, patrimonio: 50000, porMes: 2500, rendimento: 0.12, inflacao: 0.04, rendimentoNaRenda: 0.05 });
    expect(r.acumulo.finalValueReal).toBeCloseTo(2488829.0069739427, 6);
    expect(r.acumulo.finalValueNominal).toBeCloseTo(5065519.49225136, 6);
    expect(r.renda.totalPassiveIncome).toBeCloseTo(11870.120862391428, 6);
    expect(r.renda.surplusOrDeficit).toBeCloseTo(-129.87913760857208, 6);
  });
  it("o valor e o prazo da meta 'Liberdade financeira'", () => {
    // R$ 8.000 por mês a 4% ao ano: 8.000 × 12 ÷ 0,04.
    expect(patrimonioNecessario(EXEMPLO_LIBERDADE)).toBe(2400000);
    expect(patrimonioNecessario({ ...EXEMPLO_LIBERDADE, outraRenda: 2000 })).toBe(1800000);
    expect(patrimonioNecessario({ ...EXEMPLO_LIBERDADE, rendimentoNaRenda: 0 })).toBeNull();
    expect(prazoDaLiberdade(EXEMPLO_LIBERDADE, new Date(2026, 9, 11))).toEqual({ ano: 2051, mes: 10 });
  });
  it("vai e volta do que a Estratégia da Carteira lê (PlanningParams)", () => {
    expect(deParametros(paraParametros(EXEMPLO_LIBERDADE))).toEqual(EXEMPLO_LIBERDADE);
  });
});
