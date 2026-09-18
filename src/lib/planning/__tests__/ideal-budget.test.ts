import { describe, expect, it } from "vitest";
import { idealBudgetSplit, courseShareOf, COURSE_SAVINGS_PERCENT, COURSE_SPENDING_SHARE } from "../ideal-budget";
import { PARENT_CATEGORIES } from "@/lib/categories";

const soma = (d: Record<string, number>) => Object.values(d).reduce((a, b) => a + b, 0);

describe("distribuição do orçamento do curso", () => {
  it("guardando os 18% da aula, dá exatamente os números dela", () => {
    // Renda 16.000, guarda 18% (10% liberdade + 8% sonhos) → sobram 13.120 pra gastar.
    const d = idealBudgetSplit(13_120, 16_000);
    expect(d).toEqual({
      MORADIA: 4800, // 30% da renda
      ALIMENTACAO: 2400, // 15%
      SAUDE: 1600, // 10%
      TRANSPORTE: 1280, // 8%
      LAZER: 1440, // 5% lazer + 4% despesas pessoais
      EDUCACAO: 800, // 5%
      FINANCEIRO: 800, // "Outros" 5%
    });
    expect(soma(d)).toBe(13_120);
  });

  it("os percentuais da aula somam 82% da renda (os outros 18% são o que se guarda)", () => {
    expect(COURSE_SPENDING_SHARE).toBeCloseTo(0.82, 10);
    expect(COURSE_SAVINGS_PERCENT).toBe(18);
    expect(Math.round(courseShareOf("MORADIA") * 100)).toBe(30);
    expect(Math.round(courseShareOf("ALIMENTACAO") * 100)).toBe(15);
  });

  it("guardando MAIS que a aula, tudo encolhe junto e a soma fecha no que sobra", () => {
    for (const [renda, guarda] of [
      [16_000, 0.3],
      [8_000, 0.4],
      [5_500, 0.25],
    ] as const) {
      const sobra = Math.round(renda * (1 - guarda));
      const d = idealBudgetSplit(sobra, renda);
      expect(soma(d)).toBe(sobra);
      // Encolheu, mas a ordem de prioridade da aula se mantém.
      expect(d.MORADIA).toBeGreaterThan(d.ALIMENTACAO);
      expect(d.ALIMENTACAO).toBeGreaterThan(d.SAUDE);
    }
  });

  it("guardando MENOS que a aula, sobra folga em vez de inchar as categorias", () => {
    // Renda 10.000 guardando 10% → sobram 9.000, mas a régua do curso gasta 8.200.
    const d = idealBudgetSplit(9_000, 10_000);
    expect(d.MORADIA).toBe(3000); // continua 30% da RENDA, não 30% da sobra
    expect(soma(d)).toBe(8_200);
    expect(9_000 - soma(d)).toBe(800);
  });

  it("categoria criada pela pessoa sai do bolo antes", () => {
    const d = idealBudgetSplit(13_120, 16_000, { reserved: 1_000 });
    expect(soma(d)).toBeLessThanOrEqual(12_120);
  });

  it("sem renda ou sem sobra, não inventa valores", () => {
    expect(soma(idealBudgetSplit(0, 16_000))).toBe(0);
    expect(soma(idealBudgetSplit(5_000, 0))).toBe(0);
    expect(soma(idealBudgetSplit(-100, 16_000))).toBe(0);
  });

  it("toda categoria do app tem fatia na referência", () => {
    for (const c of PARENT_CATEGORIES) expect(courseShareOf(c)).toBeGreaterThan(0);
  });
});
