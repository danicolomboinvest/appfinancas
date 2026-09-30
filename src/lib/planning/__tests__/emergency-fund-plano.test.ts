import { describe, expect, it } from "vitest";
import { computeEmergencyFundPlan } from "@/lib/planning/emergency-fund";

/**
 * Bordas da conta da Reserva de Emergência: zero, negativo, taxa zero e o arredondamento do
 * "em quantos meses completa". O número de meses e a última linha da projeção precisam contar a
 * mesma história (a tela mostra os dois lado a lado).
 */
describe("computeEmergencyFundPlan: bordas", () => {
  it("reserva já completa (ou alvo zero): 0 meses e projeção vazia", () => {
    const completa = computeEmergencyFundPlan({ targetAmount: 6000, currentAmount: 6000, monthlyContribution: 500, annualRate: 0.1 });
    expect(completa.monthsToTarget).toBe(0);
    expect(completa.projection).toEqual([]);

    const alvoZero = computeEmergencyFundPlan({ targetAmount: 0, currentAmount: 0, monthlyContribution: 0, annualRate: 0.1 });
    expect(alvoZero.monthsToTarget).toBe(0);
    expect(alvoZero.projection).toEqual([]);
  });

  it("sem guardar nada e sem saldo: não completa nunca (null), e a projeção para em 600 meses sem NaN", () => {
    const r = computeEmergencyFundPlan({ targetAmount: 6000, currentAmount: 0, monthlyContribution: 0, annualRate: 0.1 });
    expect(r.monthsToTarget).toBeNull();
    expect(r.projection).toHaveLength(600);
    expect(r.projection.every((p) => p.balance === 0)).toBe(true);
  });

  it("taxa zero: a conta é só divisão (6.000 / 500 = 12 meses) e a última linha bate o alvo exato", () => {
    const r = computeEmergencyFundPlan({ targetAmount: 6000, currentAmount: 0, monthlyContribution: 500, annualRate: 0 });
    expect(r.monthlyRate).toBe(0);
    expect(r.monthsToTarget).toBe(12);
    expect(r.projection).toHaveLength(12);
    expect(r.projection.at(-1)?.balance).toBe(6000);
  });

  it("taxa zero com divisão quebrada arredonda PRA CIMA (6.000 / 700 = 8,57 → 9 meses)", () => {
    const r = computeEmergencyFundPlan({ targetAmount: 6000, currentAmount: 0, monthlyContribution: 700, annualRate: 0 });
    expect(r.monthsToTarget).toBe(9);
    expect(r.projection.at(-1)!.balance).toBeGreaterThanOrEqual(6000);
    expect(r.projection.at(-2)!.balance).toBeLessThan(6000);
  });

  it("sem guardar por mês, mas com saldo rendendo: completa só com o rendimento (sem NaN)", () => {
    const r = computeEmergencyFundPlan({ targetAmount: 11000, currentAmount: 10000, monthlyContribution: 0, annualRate: 0.12 });
    expect(r.monthsToTarget).not.toBeNull();
    expect(Number.isFinite(r.monthsToTarget!)).toBe(true);
    expect(r.projection.at(-1)!.balance).toBeGreaterThanOrEqual(11000);
  });

  it("valor por mês NEGATIVO (tirando da reserva): não inventa prazo", () => {
    const r = computeEmergencyFundPlan({ targetAmount: 10000, currentAmount: 5000, monthlyContribution: -100, annualRate: 0.1 });
    expect(r.monthsToTarget).toBeNull();
    expect(r.projection.every((p) => Number.isFinite(p.balance))).toBe(true);
  });

  it("o número de meses é o mesmo da projeção, com alvo quebrado e com alvo que cai exato num mês", () => {
    const casos = [
      { targetAmount: 10000, currentAmount: 0, monthlyContribution: 1000, annualRate: 0.1 },
      { targetAmount: 12000, currentAmount: 1000, monthlyContribution: 500, annualRate: 0.12 },
      { targetAmount: 30000, currentAmount: 5000, monthlyContribution: 800, annualRate: 0.1065 },
    ];
    for (const c of casos) {
      const r = computeEmergencyFundPlan(c);
      expect(r.projection).toHaveLength(r.monthsToTarget!);
      expect(r.projection.at(-1)!.balance).toBeGreaterThanOrEqual(c.targetAmount);
      expect(r.projection.at(-2)!.balance).toBeLessThan(c.targetAmount);
    }
    // Alvo igual ao saldo exato do mês N: o NPER dá N "com casas" e o ceil não pode empurrar pra N+1.
    const longe = computeEmergencyFundPlan({ targetAmount: 1e12, currentAmount: 1000, monthlyContribution: 500, annualRate: 0.12 });
    for (const n of [6, 12, 24, 36]) {
      const exato = computeEmergencyFundPlan({ targetAmount: longe.projection[n - 1].balance, currentAmount: 1000, monthlyContribution: 500, annualRate: 0.12 });
      expect(exato.monthsToTarget).toBe(n);
      expect(exato.projection).toHaveLength(n);
    }
  });
});
