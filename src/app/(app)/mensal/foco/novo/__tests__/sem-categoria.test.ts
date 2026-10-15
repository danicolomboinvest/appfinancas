import { describe, expect, it } from "vitest";
import { CHAVE_SEM_CATEGORIA, chaveDoGasto } from "@/lib/categories";
import { paraOndeFoiNoMes } from "../mes-passado";

/**
 * 15/10/2026: o Resumo de outubro dizia "Outros R$ 530 · 2 compras" e o Orçamento e Gastos,
 * "Outros R$ 320" (a compra da fatura sem categoria estava em "Sem categoria" lá e em "Outros" aqui).
 */
describe("gasto sem categoria: a mesma chave no Resumo, no Orçamento e em Gastos", () => {
  const outubro = [
    { customCategoryId: null, parentCategory: "OUTROS", valor: 320 },
    { customCategoryId: null, parentCategory: null, valor: 210 },
  ];

  it("a chave do gasto sem categoria é SEM, não OUTROS", () => {
    expect(chaveDoGasto({ customCategoryId: null, parentCategory: null })).toBe(CHAVE_SEM_CATEGORIA);
    expect(chaveDoGasto({ customCategoryId: "c1", parentCategory: "LAZER" })).toBe("c1");
    expect(chaveDoGasto({ customCategoryId: null, parentCategory: "LAZER" })).toBe("LAZER");
  });

  it("o Para onde foi mostra Outros com R$ 320, como o Orçamento, e o resto em Sem categoria", () => {
    const { linhas } = paraOndeFoiNoMes(outubro.map((g) => ({ valor: g.valor, categoria: chaveDoGasto(g) })), [], new Set());
    expect(linhas.find((l) => l.categoria === "OUTROS")?.atual).toBe(320);
    expect(linhas.find((l) => l.categoria === CHAVE_SEM_CATEGORIA)?.atual).toBe(210);
  });
});
