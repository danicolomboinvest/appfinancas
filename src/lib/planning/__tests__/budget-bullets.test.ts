import { describe, expect, it } from "vitest";
import { buildBudgetBullets, elapsedRatioOfMonth } from "../budget-bullets";
import type { CategoryComparison } from "../budget-comparison";
import { formatMoney, type MoneyOptions } from "@/lib/money";

const cat = (categoryKey: string, planned: number, spent: number): CategoryComparison => ({
  categoryKey,
  planned,
  spent,
  deviationPercent: planned > 0 ? (spent - planned) / planned : null,
  status: planned <= 0 ? "SEM_PLANO" : spent > planned ? "ACIMA" : "DENTRO",
});

const opts = {
  paceRatio: 0.5,
  money: (v: number, o?: MoneyOptions) => formatMoney(v, "BRL", o),
  labelFor: (k: string) => k,
  colorFor: () => "cor",
};

describe("buildBudgetBullets", () => {
  it("põe no topo quem está mais perto de estourar, não a ordem alfabética", () => {
    const rows = buildBudgetBullets(
      [cat("Alimentacao", 1000, 300), cat("Moradia", 1000, 980), cat("Lazer", 1000, 1100)],
      opts,
    );
    expect(rows.map((r) => r.key)).toEqual(["Lazer", "Moradia", "Alimentacao"]);
  });

  it("empurra 'sem plano' para o fim mesmo com gasto alto", () => {
    const rows = buildBudgetBullets([cat("SemPlano", 0, 9999), cat("Moradia", 1000, 100)], opts);
    expect(rows.map((r) => r.key)).toEqual(["Moradia", "SemPlano"]);
  });

  it("não acusa estouro de um limite que não existe", () => {
    const [row] = buildBudgetBullets([cat("SemPlano", 0, 500)], opts);
    expect(row.isOver).toBe(false);
    expect(row.isUnplanned).toBe(true);
    // Sem plano não ganha tracinho: seria uma régua inventada.
    expect(row.targetPercent).toBeNull();
  });

  it("esconde categoria sem plano e sem gasto", () => {
    expect(buildBudgetBullets([cat("Vazia", 0, 0)], opts)).toHaveLength(0);
  });

  // O Intl separa "R$" do número com espaço NÃO-quebrável (U+00A0), invisível no editor e
  // suficiente pra fazer um toBe falhar com as duas strings parecendo idênticas na tela.
  const semNbsp = (s: string) => s.replace(/\u00A0/g, " ");

  it("escreve o lado direito conforme o estilo pedido", () => {
    const [deDentro] = buildBudgetBullets([cat("M", 3000, 2531)], opts);
    expect(semNbsp(deDentro.rightLabel)).toBe("R$ 2.531 de R$ 3.000");

    const [restanteOver] = buildBudgetBullets([cat("A", 1500, 1518)], { ...opts, labelStyle: "restante" });
    expect(semNbsp(restanteOver.rightLabel)).toBe("estourou R$ 18");

    const [restanteFalta] = buildBudgetBullets([cat("M", 3000, 2531)], { ...opts, labelStyle: "restante" });
    expect(semNbsp(restanteFalta.rightLabel)).toBe("falta R$ 469");
  });
});

describe("elapsedRatioOfMonth", () => {
  it("dia 15 de um mês de 30 dias fica na metade", () => {
    expect(elapsedRatioOfMonth(new Date(2026, 8, 15), 2026, 9)).toBeCloseTo(0.5, 2);
  });

  it("mês já fechado marca o fim, mês futuro marca o começo", () => {
    const hoje = new Date(2026, 8, 15);
    expect(elapsedRatioOfMonth(hoje, 2026, 8)).toBe(1);
    expect(elapsedRatioOfMonth(hoje, 2026, 10)).toBe(0);
  });
});
