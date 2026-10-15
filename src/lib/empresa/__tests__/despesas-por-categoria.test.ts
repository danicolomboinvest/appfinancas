import { describe, expect, it } from "vitest";
import { categoriasDasDespesas } from "@/app/(app)/empresa/categorias-das-despesas";
import { mesesDaJanela } from "@/app/(app)/empresa/como-vai/Acumulado";
import type { LancamentoDaEmpresa } from "../regras";

let n = 0;
const saida = (amount: number, extra: Partial<LancamentoDaEmpresa> = {}): LancamentoDaEmpresa => ({
  id: `s${n++}`, year: 2026, month: 9, category: "EXPENSE", parentCategory: "ALIMENTACAO", subcategory: null, description: null, amount, entryDate: null, ...extra,
});

describe("despesas por categoria da Empresa (15/10/2026)", () => {
  const lancs: LancamentoDaEmpresa[] = [
    saida(2150, { subcategory: "Matéria-prima" }),
    saida(420, { subcategory: "Embalagens" }),
    saida(240, { parentCategory: "MORADIA", subcategory: "Gás e energia" }),
    saida(86.05, { parentCategory: "IMPOSTOS", subcategory: "DAS (Simples Nacional)" }),
    saida(300, { parentCategory: null, customCategoryId: "cat-aluguel-da-cozinha" }),
    saida(3600, { parentCategory: "SAUDE", subcategory: "Pró-labore" }),
    { ...saida(5000), category: "INCOME", parentCategory: null },
  ];
  const custom = { "cat-aluguel-da-cozinha": { nome: "Aluguel da cozinha", icone: "home" } };
  const r = categoriasDasDespesas(lancs, "EMPRESA", custom);

  it("mostra as fixas, os impostos e a categoria criada por ela, não só as variáveis", () => {
    expect(r.map((c) => c.chave)).toEqual(["ALIMENTACAO", "cat-aluguel-da-cozinha", "MORADIA", "IMPOSTOS"]);
    expect(r.find((c) => c.chave === "cat-aluguel-da-cozinha")).toMatchObject({ nome: "Aluguel da cozinha", valor: 300, tipo: "fixa" });
  });

  it("deixa de fora o salário dela e as entradas", () => {
    expect(r.reduce((s, c) => s + c.valor, 0)).toBeCloseTo(3196.05, 2);
  });

  it("diz o que tem dentro, do maior para o menor, em palavras de dona", () => {
    expect(r[0]).toMatchObject({ valor: 2570, tipo: "variavel", dentro: ["Insumos", "Embalagens"] });
  });
});

describe("janelas do Como vai acumulado", () => {
  const out = { ano: 2026, mes: 10 };
  it("3, 6 e 12 meses são meses fechados; o ano vai de janeiro até o mês de hoje", () => {
    expect(mesesDaJanela("6m", out)).toEqual([4, 5, 6, 7, 8, 9].map((mes) => ({ ano: 2026, mes })));
    expect(mesesDaJanela("12m", out)[0]).toEqual({ ano: 2025, mes: 10 });
    expect(mesesDaJanela("ano", out)).toHaveLength(10);
  });
});
