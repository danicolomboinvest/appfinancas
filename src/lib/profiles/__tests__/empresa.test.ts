import { describe, expect, it } from "vitest";
import { CATEGORIAS_EMPRESA, caixaDaEmpresa, calcularDRE, despesasFixasTipicas, ehEmpresa, saudeDoCaixa, soMesesJaVividos } from "../empresa";
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

describe("perfil Empresa: DRE do ano só com meses já vividos", () => {
  it("corta o gasto no mesmo mês da receita, sem as cópias recorrentes de out–dez", () => {
    // Aluguel recorrente lançado em janeiro: o banco tem uma linha por mês até dezembro.
    const aluguel = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, parentCategory: "MORADIA", spent: 1000 }));
    const ateSetembro = soMesesJaVividos(aluguel, 9);
    expect(ateSetembro).toHaveLength(9);
    expect(ateSetembro.every((l) => l.month <= 9)).toBe(true);

    // Receita de jan–set 12.000 contra 9 meses de aluguel: lucro de 3.000, e não zero como daria contando os 12 meses.
    const dre = calcularDRE({ receita: 12000, gastoPorCategoria: { MORADIA: ateSetembro.reduce((s, l) => s + l.spent, 0) } });
    expect(dre.lucroOperacional).toBe(3000);
  });

  it("ano que já acabou mantém os 12 meses; ano futuro não tem mês vivido", () => {
    const linhas = [{ month: 1 }, { month: 12 }];
    expect(soMesesJaVividos(linhas, 12)).toEqual(linhas);
    expect(soMesesJaVividos(linhas, 0)).toEqual([]);
  });
});

describe("perfil Empresa: caixa do Painel com a mesma régua da tela do caixa", () => {
  const criado = new Date(Date.UTC(2026, 8, 20));
  const linha = (month: number, amount: number, extra: Partial<Parameters<typeof despesasFixasTipicas>[0][number]> = {}) => ({
    year: 2026, month, category: "EXPENSE", parentCategory: "MORADIA" as const, subcategory: null, description: null, amount, createdAt: criado, ...extra,
  });

  it("vale o digitado na tela do caixa quando nada está marcado na carteira", () => {
    expect(caixaDaEmpresa(50000, 0)).toBe(50000);
    expect(caixaDaEmpresa(null, 12000)).toBe(12000);
    // Os dois contam o mesmo dinheiro: fica o maior, não a soma.
    expect(caixaDaEmpresa(20000, 24000)).toBe(24000);
  });

  it("aplicação e pagamento de fatura não viram despesa fixa", () => {
    const fixas = despesasFixasTipicas([
      linha(8, 3000, { description: "Aluguel" }),
      linha(8, 5000, { parentCategory: null, description: "Pagamento de fatura" }),
      linha(8, 10000, { parentCategory: "OUTROS", subcategory: "Investimento", description: "Aplicação RDB" }),
    ]);
    expect(fixas).toBe(3000);
    // 24 mil de caixa cobrem 8 meses, não 1,3.
    expect(saudeDoCaixa(24000, fixas ?? 0).situacao).toBe("folgado");
  });

  it("mês só com a cópia automática da conta fixa não puxa a média pra baixo", () => {
    const fixas = despesasFixasTipicas([
      linha(7, 3000),
      linha(8, 3000),
      // Setembro: só a cópia do aluguel, criada em janeiro, e nada lançado depois.
      linha(9, 3000, { createdAt: new Date(Date.UTC(2026, 0, 10)) }),
      linha(9, 1000, { parentCategory: "ALIMENTACAO", createdAt: new Date(Date.UTC(2026, 0, 10)) }),
    ]);
    expect(fixas).toBe(3000);
  });

  it("sem despesa fixa nenhuma devolve null (a página usa o próprio período)", () => {
    expect(despesasFixasTipicas([linha(8, 800, { parentCategory: "ALIMENTACAO" })])).toBeNull();
    expect(despesasFixasTipicas([])).toBeNull();
  });
});
