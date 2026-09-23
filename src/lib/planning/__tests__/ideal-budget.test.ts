import { describe, expect, it } from "vitest";
import {
  idealBudgetSplit,
  courseShareOf,
  savingsPercentFor,
  spendingShareFor,
  COURSE_SAVINGS_PERCENT,
  COURSE_SPENDING_SHARE,
  EMPRESA_RETENTION_PERCENT,
  EMPRESA_SPENDING_SHARE,
} from "../ideal-budget";
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
      OUTROS: 800, // "Outros" 5%
      IMPOSTOS: 0, // a aula não separa imposto
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

  it("toda categoria do app está na referência; só Impostos vem zerado, porque a aula não separa", () => {
    for (const c of PARENT_CATEGORIES) {
      expect(courseShareOf(c)).toBeGreaterThanOrEqual(0);
      if (c !== "IMPOSTOS") expect(courseShareOf(c)).toBeGreaterThan(0);
    }
    expect(courseShareOf("IMPOSTOS")).toBe(0);
  });
});

describe("distribuição do orçamento da empresa", () => {
  it("os pesos somam 90% do faturamento; os 10% que faltam são a retenção", () => {
    expect(EMPRESA_SPENDING_SHARE).toBeCloseTo(0.9, 10);
    expect(EMPRESA_RETENTION_PERCENT).toBe(10);
    expect(EMPRESA_SPENDING_SHARE + EMPRESA_RETENTION_PERCENT / 100).toBeCloseTo(1, 10);
    expect(savingsPercentFor("EMPRESA")).toBe(10);
    expect(spendingShareFor("EMPRESA")).toBeCloseTo(0.9, 10);
    // Imposto e equipe na frente: é a ordem em que uma pequena empresa paga as contas.
    expect(Math.round(courseShareOf("IMPOSTOS", "EMPRESA") * 100)).toBe(10);
    expect(Math.round(courseShareOf("SAUDE", "EMPRESA") * 100)).toBe(25);
    expect(Math.round(courseShareOf("ALIMENTACAO", "EMPRESA") * 100)).toBe(25);
    expect(Math.round(courseShareOf("MORADIA", "EMPRESA") * 100)).toBe(10);
  });

  it("toda categoria recebe fatia na empresa, inclusive Impostos (o DAS não espera)", () => {
    for (const c of PARENT_CATEGORIES) expect(courseShareOf(c, "EMPRESA")).toBeGreaterThan(0);
  });

  it("retendo os 10% da referência, dá exatamente os pesos sobre o faturamento", () => {
    // Faturamento 20.000, retém 10% → sobram 18.000 pra custos e despesas.
    const d = idealBudgetSplit(18_000, 20_000, { kind: "EMPRESA" });
    expect(d).toEqual({
      IMPOSTOS: 2000, // 10%
      SAUDE: 5000, // equipe e pró-labore 25%
      ALIMENTACAO: 5000, // mercadorias e insumos 25%
      MORADIA: 2000, // estrutura 10%
      EDUCACAO: 1600, // marketing e vendas 8%
      LAZER: 1000, // serviços e terceiros 5%
      TRANSPORTE: 800, // logística 4%
      OUTROS: 600, // 3%
    });
    expect(soma(d)).toBe(18_000);
  });

  it("retendo MAIS que a referência, tudo encolhe junto e a soma fecha no que sobra", () => {
    for (const [fatura, retem] of [
      [20_000, 0.2],
      [8_000, 0.3],
      [55_000, 0.15],
    ] as const) {
      const sobra = Math.round(fatura * (1 - retem));
      const d = idealBudgetSplit(sobra, fatura, { kind: "EMPRESA" });
      expect(soma(d)).toBe(sobra);
      expect(d.SAUDE).toBeGreaterThan(d.MORADIA);
      expect(d.IMPOSTOS).toBeGreaterThan(d.OUTROS);
    }
  });

  it("retendo MENOS que a referência, sobra folga em vez de inchar as frentes", () => {
    // Faturamento 10.000 retendo 5% → sobram 9.500, mas a régua gasta 9.000.
    const d = idealBudgetSplit(9_500, 10_000, { kind: "EMPRESA" });
    expect(d.SAUDE).toBe(2500); // continua 25% do FATURAMENTO, não da sobra
    expect(soma(d)).toBe(9_000);
  });

  it("sem o kind (ou PESSOAL), continua a régua do curso, sem mudar nada pra pessoa física", () => {
    expect(idealBudgetSplit(13_120, 16_000, { kind: "PESSOAL" })).toEqual(idealBudgetSplit(13_120, 16_000));
    expect(idealBudgetSplit(13_120, 16_000, { kind: null })).toEqual(idealBudgetSplit(13_120, 16_000));
    expect(savingsPercentFor("PESSOAL")).toBe(COURSE_SAVINGS_PERCENT);
    expect(savingsPercentFor(undefined)).toBe(COURSE_SAVINGS_PERCENT);
    expect(spendingShareFor("PESSOAL")).toBe(COURSE_SPENDING_SHARE);
    expect(courseShareOf("MORADIA", "PESSOAL")).toBe(courseShareOf("MORADIA"));
  });
});
