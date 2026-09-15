import { describe, it, expect } from "vitest";
import {
  totalSpendingInsight,
  biggestMoverInsight,
  concentrationInsight,
  buildMonthInsights,
} from "../month-insights";
import type { CategorySpending } from "@/lib/consolidation/month-analysis";
import { formatMoney } from "@/lib/money";

// Formatador fixo em real: estes testes conferem o TEXTO do insight, não a moeda.
const money = (v: number) => formatMoney(v, "BRL");

function category(partial: Partial<CategorySpending> & { label: string; amount: number }): CategorySpending {
  return {
    key: partial.label.toUpperCase(),
    kind: "parent",
    iconKey: null,
    share: partial.share ?? 0.2,
    previousAmount: partial.previousAmount ?? null,
    changeRatio:
      partial.changeRatio !== undefined
        ? partial.changeRatio
        : partial.previousAmount && partial.previousAmount > 0
          ? partial.amount / partial.previousAmount - 1
          : null,
    ...partial,
  };
}

describe("totalSpendingInsight", () => {
  it("não compara quando não há mês anterior (primeiro mês de uso)", () => {
    expect(totalSpendingInsight(1000, 0)).toBeNull();
  });

  it("gastou menos → elogia", () => {
    const insight = totalSpendingInsight(800, 1000);
    expect(insight?.tone).toBe("positive");
    expect(insight?.text).toContain("20% menos");
  });

  it("gastou mais → alerta", () => {
    const insight = totalSpendingInsight(1300, 1000);
    expect(insight?.tone).toBe("warning");
    expect(insight?.text).toContain("30% acima");
  });

  it("variação pequena vira 'mesmo nível', não alarde", () => {
    const insight = totalSpendingInsight(1040, 1000); // +4%
    expect(insight?.tone).toBe("neutral");
    expect(insight?.text).toContain("mesmo nível");
  });
});

describe("biggestMoverInsight", () => {
  it("escolhe quem mais mexeu em REAIS, não em porcentagem", () => {
    const insight = biggestMoverInsight([
      // +300% mas só R$ 120 a mais — barulho.
      category({ label: "Lazer", amount: 160, previousAmount: 40 }),
      // +20% mas R$ 400 a mais — é isso que pesa no bolso.
      category({ label: "Moradia", amount: 2400, previousAmount: 2000 }),
    ], money);
    expect(insight?.text).toContain("Moradia");
    expect(insight?.text).toContain("20%");
  });

  it("ignora categoria sem mês anterior (evita 'subiu infinito%')", () => {
    expect(biggestMoverInsight([category({ label: "Novo", amount: 500, previousAmount: null })], money)).toBeNull();
  });

  it("ignora valores pequenos demais pra virar alerta", () => {
    expect(biggestMoverInsight([category({ label: "Cafezinho", amount: 30, previousAmount: 10 })], money)).toBeNull();
  });

  it("queda também vira insight, com tom positivo", () => {
    const insight = biggestMoverInsight([category({ label: "Alimentação", amount: 600, previousAmount: 1000 })], money);
    expect(insight?.tone).toBe("positive");
    expect(insight?.text).toContain("caiu 40%");
  });
});

describe("concentrationInsight", () => {
  it("avisa quando uma categoria domina o mês", () => {
    const insight = concentrationInsight([category({ label: "Moradia", amount: 3000, share: 0.52 })]);
    expect(insight?.text).toContain("52%");
  });

  it("fica quieto quando o gasto está bem distribuído", () => {
    expect(concentrationInsight([category({ label: "Moradia", amount: 900, share: 0.25 })])).toBeNull();
  });
});

describe("buildMonthInsights", () => {
  it("limita a quantidade de frases (painel com aviso demais não é clareza)", () => {
    const insights = buildMonthInsights({
      currentExpense: 1300,
      previousExpense: 1000,
      categories: [
        category({ label: "Moradia", amount: 800, previousAmount: 500, share: 0.61 }),
        category({ label: "Alimentação", amount: 500, previousAmount: 500, share: 0.39 }),
      ],
      money,
    });
    expect(insights).toHaveLength(2);
  });

  it("mês sem histórico e sem categorias não inventa insight", () => {
    expect(buildMonthInsights({ currentExpense: 0, previousExpense: 0, categories: [], money })).toEqual([]);
  });
});
