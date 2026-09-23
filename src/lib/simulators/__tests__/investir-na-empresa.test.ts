import { describe, expect, it } from "vitest";
import { simularInvestimentoNaEmpresa } from "../investir-na-empresa";

describe("vale a pena investir na empresa?", () => {
  const base = { investimento: 30000, receitaMensal: 8000, margem: 0.5, custoMensal: 1000, horizonteMeses: 24, taxaAnualAlternativa: 0.1 };

  it("o ganho mensal é a margem da receita nova menos o custo fixo novo", () => {
    const r = simularInvestimentoNaEmpresa(base);
    expect(r.ganhoMensal).toBe(3000);
    // 30.000 / 3.000 = 10 meses pra se pagar.
    expect(r.paybackMeses).toBe(10);
    expect(r.resultadoNoHorizonte).toBe(3000 * 24 - 30000);
    expect(r.retorno).toBeCloseTo(42000 / 30000);
  });

  it("compara com deixar o dinheiro rendendo e diz em que mês a empresa passa a aplicação", () => {
    const r = simularInvestimentoNaEmpresa(base);
    // 10% ao ano por 24 meses sobre 30 mil: ~6.300 de juros.
    expect(r.rendimentoDaAplicacao).toBeCloseTo(30000 * (Math.pow(1.1, 2) - 1), 2);
    expect(r.vantagemSobreAplicacao).toBeGreaterThan(0);
    expect(r.mesEmQueSupera).not.toBeNull();
    expect(r.veredito).toBe("vale");
    expect(r.curva).toHaveLength(25);
    expect(r.curva[0]).toEqual({ mes: 0, naEmpresa: -30000, naAplicacao: 0 });
  });

  it("investimento que não se paga no horizonte não vale; que nunca se paga é 'nunca'", () => {
    expect(simularInvestimentoNaEmpresa({ ...base, receitaMensal: 2500 }).veredito).toBe("nao-vale"); // ganha 250/mês → 120 meses
    const nunca = simularInvestimentoNaEmpresa({ ...base, receitaMensal: 1500 }); // 750 − 1.000 < 0
    expect(nunca.ganhoMensal).toBeLessThan(0);
    expect(nunca.paybackMeses).toBeNull();
    expect(nunca.veredito).toBe("nunca-se-paga");
  });

  it("diz quanto precisa faturar a mais por mês pra se pagar dentro do horizonte", () => {
    const r = simularInvestimentoNaEmpresa(base);
    // (30.000 / 24 + 1.000) / 0,5 = 4.500 por mês.
    expect(r.receitaNecessariaParaSePagar).toBeCloseTo(4500);
    expect(simularInvestimentoNaEmpresa({ ...base, margem: 0 }).receitaNecessariaParaSePagar).toBeNull();
  });

  it("empata quando a vantagem sobre a aplicação é menor que 5% do investimento", () => {
    // Ganha 1.100/mês: em 24 meses, 26.400 − 30.000 = −3.600... ajusta pra ficar perto do CDI.
    const r = simularInvestimentoNaEmpresa({ ...base, receitaMensal: 3020, custoMensal: 0, horizonteMeses: 24 });
    // ganho 1.510/mês → 36.240 − 30.000 = 6.240; CDI ≈ 6.300 → diferença ~60, bem abaixo de 1.500.
    expect(r.veredito).toBe("empata");
  });
});
