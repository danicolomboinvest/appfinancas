import { describe, expect, it } from "vitest";
import { computeExecutiveSummary, projetarEconomiaDoAno, type Insight } from "../insights";

function makeInsight(tone: Insight["tone"]): Insight {
  return { id: `${tone}-${Math.random()}`, message: "mensagem", tone, category: "fluxo" };
}

describe("computeExecutiveSummary", () => {
  it("returns an info summary when there are no insights", () => {
    const summary = computeExecutiveSummary([]);
    expect(summary.tone).toBe("info");
  });

  it("prioritizes a danger tone whenever any insight is dangerous, even amid successes", () => {
    const summary = computeExecutiveSummary([makeInsight("success"), makeInsight("success"), makeInsight("danger")]);
    expect(summary.tone).toBe("danger");
  });

  it("returns a warning summary when warnings outnumber successes (and there is no danger)", () => {
    const summary = computeExecutiveSummary([makeInsight("warning"), makeInsight("warning"), makeInsight("success")]);
    expect(summary.tone).toBe("warning");
  });

  it("returns a success summary when successes are the majority signal", () => {
    const summary = computeExecutiveSummary([makeInsight("success"), makeInsight("success"), makeInsight("info")]);
    expect(summary.tone).toBe("success");
  });

  it("returns a neutral summary when only info insights are present", () => {
    const summary = computeExecutiveSummary([makeInsight("info"), makeInsight("info")]);
    expect(summary.tone).toBe("info");
  });
});

describe("projetarEconomiaDoAno", () => {
  it("quem começou em julho: em setembro projeta só set–dez pela frente, não os meses antes de começar", () => {
    // Jul + ago somaram R$ 1.000 de economia (R$ 500/mês); faltam set, out, nov e dez.
    const fechados = [
      { totalPlanned: 3000, totalSpent: 2500 },
      { totalPlanned: 3000, totalSpent: 2500 },
    ];
    expect(projetarEconomiaDoAno(fechados, 9)).toBe(3000);
  });

  it("quem usa desde janeiro continua com a mesma conta de antes", () => {
    const fechados = Array.from({ length: 8 }, () => ({ totalPlanned: 1000, totalSpent: 900 }));
    // 800 acumulados + 100 × 4 meses (set–dez).
    expect(projetarEconomiaDoAno(fechados, 9)).toBe(1200);
  });

  it("sem mês fechado não projeta", () => {
    expect(projetarEconomiaDoAno([], 3)).toBeNull();
  });
});
