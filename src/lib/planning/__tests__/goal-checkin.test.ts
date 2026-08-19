import { describe, expect, it } from "vitest";
import { getGoalCheckinEligibility, monthKeyLabel } from "../goal-checkin";

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
