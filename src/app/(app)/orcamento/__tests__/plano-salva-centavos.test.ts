import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

/** Montar o plano: renda, quanto guardar e categorias com centavos chegam assim no banco (14/10/2026). */
const salvarPlanoDoAno = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/components/money/MoneyProvider", () => ({ useCurrency: () => "BRL" }));
vi.mock("@/lib/auth/session", () => ({ getRequiredSession: vi.fn(async () => ({ userId: "u1", profileId: "p1" })) }));
vi.mock("@/lib/date/brazil-now", () => ({ nowInBrazil: () => new Date(2026, 9, 14, 12) }));
vi.mock("@/lib/repositories/budget.repo", () => ({ salvarPlanoDoAno: (...a: unknown[]) => salvarPlanoDoAno(...a), definirPlanoDoMes: vi.fn(), listBudgets: vi.fn() }));
vi.mock("@/lib/repositories/custom-category.repo", () => ({ listCustomCategories: vi.fn(async () => [{ id: "c1" }]), createCustomCategory: vi.fn(), deleteOwnCustomCategory: vi.fn() }));

import { applyAllBudgetsAction } from "../actions";
import { fecharExato } from "@/lib/planning/fechar-plano";
import { digitar } from "@/components/ui/__tests__/digitar-no-campo";

describe("plano do orçamento salva o valor digitado", () => {
  it("renda 4.567,89, guardar 456,78, Moradia 1.234,56 e uma categoria dela 0,99", async () => {
    const renda = digitar("4567,89") ?? 0;
    const guardar = digitar("456,78") ?? 0;
    const moradia = digitar("1234,56") ?? 0;
    const minha = digitar("0,99") ?? 0;
    // Como o BudgetWizard manda: os <input type="hidden"> com o número em reais.
    const fd = new FormData();
    fd.set("year", "2026");
    fd.set("profileId", "p1");
    fd.set("plannedIncome", String(renda));
    fd.set("plannedInvestment", String(guardar));
    fd.set("plannedIncomeOriginal", "0");
    fd.set("plannedInvestmentOriginal", "0");
    fd.set("plannedAmount_MORADIA", String(moradia));
    fd.set("plannedOriginal_MORADIA", "0");
    fd.append("customCategoryId", "c1");
    fd.set("plannedAmount_custom_c1", String(minha));
    fd.set("plannedOriginal_custom_c1", "0");

    const r = await applyAllBudgetsAction({}, fd);
    expect(r).toEqual({});
    const [, ano, plano] = salvarPlanoDoAno.mock.calls[0];
    expect(ano).toBe(2026);
    expect(plano.pais).toContainEqual({ parentCategory: "MORADIA", plannedAmount: 1234.56 });
    expect(plano.proprias).toEqual([{ customCategoryId: "c1", plannedAmount: 0.99 }]);
    expect(plano.planoMensal).toEqual({ plannedIncome: 4567.89, plannedInvestment: 456.78 });
  });

  it("a sugestão fecha exato também com centavos (a sobra vai para a variável maior)", () => {
    const { val } = fecharExato(3456.78, { MORADIA: 1500, ALIMENTACAO: 1000, LAZER: 500 }, ["MORADIA"], ["MORADIA"]);
    const soma = Object.values(val).reduce((s, v) => s + v, 0);
    expect(Math.round(soma * 100) / 100).toBe(3456.78);
    expect(val.MORADIA).toBe(1500);
  });

  it("os campos de valor do assistente usam o campo de dinheiro", () => {
    const fonte = readFileSync(join(__dirname, "..", "BudgetWizard.tsx"), "utf8");
    expect(fonte.match(/<CampoDeDinheiro/g)?.length).toBe(3);
    expect(fonte).not.toMatch(/replace\(\/\\D\/g/);
  });
});
