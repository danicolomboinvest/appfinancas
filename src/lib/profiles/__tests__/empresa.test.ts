import { describe, expect, it } from "vitest";
import { CATEGORIAS_EMPRESA, calcularDRE, ehEmpresa, saudeDoCaixa } from "../empresa";
import { PARENT_CATEGORIES } from "@/lib/categories";

describe("perfil Empresa: DRE", () => {
  it("fecha a conta na ordem certa: receita → impostos → custos variáveis → despesas fixas → lucro", () => {
    const dre = calcularDRE({
      receita: 10000,
      gastoPorCategoria: { IMPOSTOS: 600, ALIMENTACAO: 3000, EDUCACAO: 400, MORADIA: 1500, SAUDE: 2500 },
      gastoPersonalizado: 200,
      retido: 500,
    });
    expect(dre.receitaBruta).toBe(10000);
    expect(dre.impostos).toBe(600);
    expect(dre.receitaLiquida).toBe(9400);
    expect(dre.custosVariaveis).toBe(3400);
    expect(dre.margemContribuicao).toBe(6000);
    expect(dre.margemContribuicaoPct).toBeCloseTo(0.6);
    // Estrutura + equipe + a categoria personalizada.
    expect(dre.despesasFixas).toBe(4200);
    expect(dre.lucroOperacional).toBe(1800);
    expect(dre.margemLiquidaPct).toBeCloseTo(0.18);
    expect(dre.sobraNoCaixa).toBe(1300);
    // Ponto de equilíbrio: despesas fixas / margem de contribuição = 4200 / 0,6 = 7.000.
    expect(dre.pontoDeEquilibrio).toBeCloseTo(7000);
  });

  it("sem receita não inventa margem nem ponto de equilíbrio", () => {
    const dre = calcularDRE({ receita: 0, gastoPorCategoria: { MORADIA: 1000 } });
    expect(dre.margemContribuicaoPct).toBeNull();
    expect(dre.margemLiquidaPct).toBeNull();
    expect(dre.pontoDeEquilibrio).toBeNull();
    expect(dre.lucroOperacional).toBe(-1000);
  });

  it("quando cada venda perde dinheiro, não existe ponto de equilíbrio", () => {
    const dre = calcularDRE({ receita: 1000, gastoPorCategoria: { ALIMENTACAO: 1200, MORADIA: 100 } });
    expect(dre.margemContribuicaoPct).toBeLessThan(0);
    expect(dre.pontoDeEquilibrio).toBeNull();
  });

  it("toda categoria-mãe tem um papel na DRE e uma cara de empresa", () => {
    for (const c of PARENT_CATEGORIES) {
      const cat = CATEGORIAS_EMPRESA[c];
      expect(cat.label.length).toBeGreaterThan(2);
      expect(["variavel", "fixa", "imposto"]).toContain(cat.natureza);
      expect(cat.subcategorias.length).toBeGreaterThan(2);
    }
    expect(CATEGORIAS_EMPRESA.SAUDE.subcategorias).toContain("Pró-labore");
    expect(CATEGORIAS_EMPRESA.IMPOSTOS.natureza).toBe("imposto");
  });
});

describe("perfil Empresa: caixa", () => {
  it("mede o caixa em meses de despesas fixas, com a régua do Sebrae (3 a 6)", () => {
    expect(saudeDoCaixa(6000, 3000)).toMatchObject({ mesesDeCaixa: 2, situacao: "curto" });
    expect(saudeDoCaixa(12000, 3000)).toMatchObject({ mesesDeCaixa: 4, situacao: "ok" });
    expect(saudeDoCaixa(30000, 3000)).toMatchObject({ mesesDeCaixa: 10, situacao: "folgado" });
    expect(saudeDoCaixa(5000, 0)).toMatchObject({ mesesDeCaixa: null, situacao: "sem-dado" });
  });

  it("só EMPRESA é empresa", () => {
    expect(ehEmpresa("EMPRESA")).toBe(true);
    expect(ehEmpresa("PESSOAL")).toBe(false);
    expect(ehEmpresa(null)).toBe(false);
  });
});
