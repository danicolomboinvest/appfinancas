import { describe, expect, it } from "vitest";
import { computeAccumulation } from "../accumulation";
import { compareCategoryBudget } from "../budget-comparison";
import { computeGoalPlan, computeGoalTrajectory } from "../goal";
import { idealBudgetSplit } from "../ideal-budget";
import { resumoDoMes } from "../month-budget-summary";
import { computeUsufruct } from "../usufruct";

/** Bordas das contas de planejamento: zero, negativo, taxa zero, arredondamento e ano virando. */
const agora = new Date(2026, 8, 30, 12);

describe("computeGoalPlan: bordas", () => {
  it("alvo zero é meta alcançada, sem dividir por zero no progresso", () => {
    const r = computeGoalPlan({ targetAmount: 0, currentAmount: 0, targetDate: new Date(2027, 0, 1), annualRate: 0.1, now: agora });
    expect(r.status).toBe("ACHIEVED");
    expect(r.progress).toBe(0);
    expect(r.requiredMonthlyContribution).toBe(0);
  });

  it("guardado acima do alvo: alcançada, nada a guardar (nunca valor negativo por mês)", () => {
    const r = computeGoalPlan({ targetAmount: 1000, currentAmount: 1500, targetDate: new Date(2027, 0, 1), annualRate: 0.1, now: agora });
    expect(r.status).toBe("ACHIEVED");
    expect(r.requiredMonthlyContribution).toBe(0);
    expect(r.amountMissing).toBe(0);
  });

  it("taxa zero: 12.000 em 12 meses são 1.000 por mês, e a trajetória termina exatamente no alvo", () => {
    const input = { targetAmount: 12000, currentAmount: 0, targetDate: new Date(2027, 8, 30), annualRate: 0, now: agora };
    const plan = computeGoalPlan(input);
    expect(plan.monthsRemaining).toBe(12);
    expect(plan.requiredMonthlyContribution).toBe(1000);
    expect(computeGoalTrajectory(input, plan).at(-1)).toEqual({ month: 12, amount: 12000 });
  });

  it("com rendimento, a trajetória termina no alvo ao centavo (aporte no começo do mês)", () => {
    const input = { targetAmount: 12000, currentAmount: 500, targetDate: new Date(2027, 8, 30), annualRate: 0.12, now: agora };
    const plan = computeGoalPlan(input);
    expect(computeGoalTrajectory(input, plan).at(-1)!.amount).toBeCloseTo(12000, 2);
  });

  it("prazo cruzando o ano (setembro → março) conta 6 meses", () => {
    const r = computeGoalPlan({ targetAmount: 6000, currentAmount: 0, targetDate: new Date(2027, 2, 30), annualRate: 0, now: agora });
    expect(r.monthsRemaining).toBe(6);
    expect(r.requiredMonthlyContribution).toBe(1000);
  });

  it("meta que nasceu no mesmo instante do prazo (duração zero) não divide por zero no ritmo", () => {
    const d = new Date(2027, 0, 1);
    const r = computeGoalPlan({ targetAmount: 1000, currentAmount: 0, targetDate: d, annualRate: 0, now: agora, startedAt: d });
    expect(r.timeElapsed).toBeNull();
  });
});

describe("acúmulo e usufruto: zeros", () => {
  it("idade de aposentar menor que a atual: zero anos, e o final é o que já tem", () => {
    const r = computeAccumulation({ currentAge: 50, retirementAge: 40, currentPatrimony: 10000, monthlyContributionAccumulation: 500, accumulationAnnualRate: 0.1, inflationAnnualRate: 0.04 });
    expect(r).toMatchObject({ years: 0, months: 0, finalValueNominal: 10000, finalValueReal: 10000, totalInvested: 10000, totalReturn: 0, totalReturnReal: 0 });
  });

  it("taxa igual à inflação: taxa real zero, e o real é só a soma do que foi investido", () => {
    const r = computeAccumulation({ currentAge: 30, retirementAge: 31, currentPatrimony: 0, monthlyContributionAccumulation: 100, accumulationAnnualRate: 0.05, inflationAnnualRate: 0.05 });
    expect(r.realAnnualRate).toBe(0);
    expect(r.finalValueReal).toBeCloseTo(1200, 8);
    expect(r.totalReturnReal).toBeCloseTo(0, 8);
  });

  it("usufruto com patrimônio zero: renda passiva só a de fora; déficit negativo", () => {
    expect(computeUsufruct({ finalValueReal: 0, usufructAnnualRate: 0.04, otherPassiveIncome: 1000, desiredPassiveIncome: 5000 })).toEqual({
      monthlyPassiveIncomeFromPortfolio: 0,
      totalPassiveIncome: 1000,
      surplusOrDeficit: -4000,
    });
  });

  it("usufruto: 1.200.000 a 4% ao ano são 4.000 por mês, sem erro de centavo", () => {
    expect(computeUsufruct({ finalValueReal: 1_200_000, usufructAnnualRate: 0.04, otherPassiveIncome: 0, desiredPassiveIncome: 4000 }).surplusOrDeficit).toBe(0);
  });
});

describe("idealBudgetSplit: centavos", () => {
  it("quando encolhe, as categorias somam exatamente o que sobra, mesmo com centavos", () => {
    for (const sobra of [3333.33, 1234.56, 0.01, 7]) {
      const d = idealBudgetSplit(sobra, 20_000);
      const soma = Math.round(Object.values(d).reduce((s, v) => s + v, 0) * 100) / 100;
      expect(soma).toBe(sobra);
      expect(Object.values(d).every((v) => v >= 0)).toBe(true);
    }
  });
});

describe("compareCategoryBudget e resumoDoMes: bordas", () => {
  it("plano zero ou negativo é 'sem plano' (sem dividir por zero)", () => {
    expect(compareCategoryBudget(0, 100)).toEqual({ deviationPercent: null, status: "SEM_PLANO" });
    expect(compareCategoryBudget(-10, 100)).toEqual({ deviationPercent: null, status: "SEM_PLANO" });
  });

  it("estorno (gasto negativo) é 'dentro', com desvio abaixo de -100%", () => {
    const r = compareCategoryBudget(100, -20);
    expect(r.status).toBe("DENTRO");
    expect(r.deviationPercent).toBeCloseTo(-1.2);
  });

  it("31 de dezembro: 1 dia restante, e o valor por dia é o que sobra inteiro", () => {
    const r = resumoDoMes({ planejado: 3100, gasto: 3000, hoje: new Date(2026, 11, 31, 20), ano: 2026, mes: 12, ultimoGasto: new Date(2026, 11, 31, 9) });
    expect(r.diasRestantes).toBe(1);
    expect(r.porDia).toBe(100);
  });

  it("dezembro visto em 1º de janeiro já é mês fechado: sem 'por dia' e sem cobrança de atualização", () => {
    const r = resumoDoMes({ planejado: 3100, gasto: 1000, hoje: new Date(2027, 0, 1, 8), ano: 2026, mes: 12 });
    expect(r.diasRestantes).toBe(0);
    expect(r.porDia).toBeNull();
    expect(r.desatualizado).toBe(false);
  });
});
