import { describe, expect, it } from "vitest";
import { chaveDaContaFixa, contasFixasQueFaltam, sugerirAno } from "../virada-ano";

const money = (v: number) => `R$ ${Math.round(v)}`;
const cat = (key: string, planejado: number, realMedio: number) => ({ key, label: key, planejado, realMedio, mae: true });

describe("sugerirAno", () => {
  it("mantém o plano que funcionou e sobe o que ficou baixo", () => {
    const s = sugerirAno({ ano: 2026, renda: { planejada: 10000, mediana: 9800 }, guardarPlanejado: 1500, categorias: [cat("MORADIA", 3000, 3000), cat("ALIMENTACAO", 1200, 1650), cat("LAZER", 600, 500)] }, money);
    expect(s.categorias.map((c) => [c.key, c.sugerido, c.motivo])).toEqual([
      ["MORADIA", 3000, "plano"],
      ["ALIMENTACAO", 1650, "real"],
      ["LAZER", 600, "plano"],
    ]);
    expect(s.renda).toBe(10000);
    expect(s.guardar).toBe(1500);
    expect(s.avisos).toEqual([]);
  });

  it("guardar nunca fica abaixo de 10% da renda; sem plano de renda, usa a mediana", () => {
    const s = sugerirAno({ ano: 2026, renda: { planejada: null, mediana: 8000 }, guardarPlanejado: 300, categorias: [cat("A", 5000, 5000)] }, money);
    expect(s.renda).toBe(8000);
    expect(s.guardar).toBe(800);
    expect(s.avisos.join(" ")).toContain("10%");
  });

  it("categoria que ela gastou sem planejar entra com o gasto real; avisa se passar de 90%", () => {
    const s = sugerirAno({ ano: 2026, renda: { planejada: 6000, mediana: null }, guardarPlanejado: 600, categorias: [cat("A", 4000, 4000), cat("B", 0, 1500)] }, money);
    expect(s.categorias.find((c) => c.key === "B")?.motivo).toBe("novo");
    expect(s.avisos.some((a) => a.includes("90%"))).toBe(true);
  });
});

describe("contasFixasQueFaltam", () => {
  const aluguel = { descricao: "Aluguel", valor: 2000, parentCategory: "MORADIA", customCategoryId: null };
  const escola = { descricao: "Escola", valor: 900, parentCategory: "EDUCACAO", customCategoryId: null };

  it("aluguel reajustado já lançado no ano novo não é criado de novo (mesmo com outro valor)", () => {
    const jaNoAno = [1, 2, 3].map((month) => ({ descricao: "aluguel ", parentCategory: "MORADIA", customCategoryId: null, month }));
    expect(contasFixasQueFaltam([aluguel, escola], jaNoAno)).toEqual([escola]);
  });

  it("vale pra série que começa num mês seguinte, e ignora acento e maiúscula", () => {
    const jaNoAno = [{ descricao: "ÁLUGUEL", parentCategory: "MORADIA", customCategoryId: null, month: 3 }];
    expect(contasFixasQueFaltam([aluguel], jaNoAno)).toEqual([]);
  });

  it("mesma descrição em outra categoria é outra conta", () => {
    const jaNoAno = [{ descricao: "Aluguel", parentCategory: "IMPOSTOS", customCategoryId: null, month: 1 }];
    expect(contasFixasQueFaltam([aluguel], jaNoAno)).toEqual([aluguel]);
  });

  it("duas contas com o mesmo nome no mês contam duas vezes", () => {
    const escola2 = { ...escola, valor: 1100 };
    const umaSo = [{ descricao: "Escola", parentCategory: "EDUCACAO", customCategoryId: null, month: 1 }];
    expect(contasFixasQueFaltam([escola, escola2], umaSo)).toEqual([escola2]);
  });

  it("a chave da tela separa valores diferentes", () => {
    expect(chaveDaContaFixa(escola)).not.toBe(chaveDaContaFixa({ ...escola, valor: 1100 }));
  });
});
