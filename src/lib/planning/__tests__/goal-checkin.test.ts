import { describe, expect, it } from "vitest";
import { aporteDoMesFeito, getGoalCheckinEligibility, monthKeyLabel, proximoAporte } from "../goal-checkin";
import { computeGoalPlan } from "../goal";

describe("getGoalCheckinEligibility", () => {
  it("meio do mês (dia 8 a 24): não pergunta nada, mês ainda não fechou", () => {
    expect(getGoalCheckinEligibility(new Date(2026, 7, 15), null).eligible).toBe(false); // 15/08
    expect(getGoalCheckinEligibility(new Date(2026, 7, 8), null).eligible).toBe(false);
    expect(getGoalCheckinEligibility(new Date(2026, 7, 24), null).eligible).toBe(false);
  });

  it("fim do mês corrente (dia >= 25): pergunta sobre O MÊS CORRENTE (quase fechado)", () => {
    const result = getGoalCheckinEligibility(new Date(2026, 7, 28), null); // 28/08/2026
    expect(result.eligible).toBe(true);
    expect(result.year).toBe(2026);
    expect(result.month).toBe(8);
    expect(result.monthKey).toBe("2026-08");
  });

  it("começo do mês novo (dia <= 7): pergunta sobre o mês ANTERIOR (já fechado)", () => {
    const result = getGoalCheckinEligibility(new Date(2026, 8, 3), null); // 03/09/2026
    expect(result.eligible).toBe(true);
    expect(result.year).toBe(2026);
    expect(result.month).toBe(8);
    expect(result.monthKey).toBe("2026-08");
  });

  it("virada de ano: começo de janeiro pergunta sobre dezembro do ano anterior", () => {
    const result = getGoalCheckinEligibility(new Date(2027, 0, 3), null); // 03/01/2027
    expect(result.year).toBe(2026);
    expect(result.month).toBe(12);
    expect(result.monthKey).toBe("2026-12");
  });

  it("já respondido este mês (checkinDismissedMonth bate) não pergunta de novo", () => {
    const result = getGoalCheckinEligibility(new Date(2026, 7, 28), "2026-08");
    expect(result.eligible).toBe(false);
  });

  it("respondido em outro mês não bloqueia o mês atual", () => {
    const result = getGoalCheckinEligibility(new Date(2026, 7, 28), "2026-07");
    expect(result.eligible).toBe(true);
  });
});

describe("monthKeyLabel", () => {
  it("traduz YYYY-MM pro nome do mês em português", () => {
    expect(monthKeyLabel("2026-08")).toBe("agosto");
    expect(monthKeyLabel("2026-12")).toBe("dezembro");
    expect(monthKeyLabel("2027-01")).toBe("janeiro");
  });
});

describe("aporteDoMesFeito", () => {
  it("vale o botão marcado OU um aporte da meta lançado no mês (Fluxo, extrato)", () => {
    expect(aporteDoMesFeito({ checkinDismissedMonth: "2026-09", monthKey: "2026-09", temAporteNoMes: false })).toBe(true);
    expect(aporteDoMesFeito({ checkinDismissedMonth: null, monthKey: "2026-09", temAporteNoMes: true })).toBe(true);
    expect(aporteDoMesFeito({ checkinDismissedMonth: "2026-08", monthKey: "2026-09", temAporteNoMes: false })).toBe(false);
    expect(aporteDoMesFeito({ checkinDismissedMonth: null, monthKey: "2026-09", temAporteNoMes: false })).toBe(false);
  });
});

describe("proximoAporte", () => {
  const meta = { targetAmount: 10_000, targetDate: new Date(2026, 11, 31, 12), annualRate: 0 };

  it("depois de marcar setembro, pede o aporte de OUTUBRO — não um 'guardar este mês' menor", () => {
    const now = new Date(2026, 8, 10, 12); // 10/09
    const antes = computeGoalPlan({ ...meta, currentAmount: 0, now });
    const guardado = antes.requiredMonthlyContribution;
    // O bug: a mesma conta refeita em setembro com o saldo novo dava um valor menor "este mês".
    const refeitoEmSetembro = computeGoalPlan({ ...meta, currentAmount: guardado, now });
    expect(refeitoEmSetembro.requiredMonthlyContribution).toBeLessThan(guardado);

    const proximo = proximoAporte({ ...meta, currentAmount: guardado, now })!;
    expect(proximo.monthKey).toBe("2026-10");
    // Outubro, novembro e dezembro dividem o que falta.
    expect(proximo.amount).toBeCloseTo((10_000 - guardado) / 3, 0);
  });

  it("null quando o prazo acaba antes do mês que vem ou a meta já está batida", () => {
    const now = new Date(2026, 8, 10, 12);
    expect(proximoAporte({ ...meta, targetDate: new Date(2026, 8, 30, 12), currentAmount: 0, now })).toBeNull();
    expect(proximoAporte({ ...meta, currentAmount: 10_000, now })).toBeNull();
  });

  it("dezembro vira janeiro do ano seguinte", () => {
    const proximo = proximoAporte({ ...meta, targetDate: new Date(2027, 5, 30, 12), currentAmount: 0, now: new Date(2026, 11, 5) })!;
    expect(proximo.monthKey).toBe("2027-01");
  });
});
