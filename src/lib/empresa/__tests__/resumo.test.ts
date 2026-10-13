import { describe, expect, it } from "vitest";
import { faturamentoMedio, resumoDaEmpresa } from "../resumo";
import { lerConfigEmpresa } from "../config";
import type { LancamentoDaEmpresa } from "../regras";
import type { ParametrosDoMei } from "../legal";

let n = 0;
const venda = (month: number, amount: number, extra: Partial<LancamentoDaEmpresa> = {}): LancamentoDaEmpresa => ({
  id: `v${n++}`, year: 2026, month, category: "INCOME", parentCategory: null, subcategory: "Vendas", description: null, amount, entryDate: null, ...extra,
});
const saida = (month: number, amount: number, extra: Partial<LancamentoDaEmpresa> = {}): LancamentoDaEmpresa => ({
  id: `s${n++}`, year: 2026, month, category: "EXPENSE", parentCategory: "MORADIA", subcategory: null, description: null, amount, entryDate: null, ...extra,
});

// A Ana canônica: jan a jun só o faturamento; jul e ago com o lucro do salário seguro; setembro inteiro; outubro até hoje.
const ana: LancamentoDaEmpresa[] = [
  ...[4600, 5000, 6300, 6700, 6800, 7120].map((v, i) => venda(i + 1, v)),
  venda(7, 8800), saida(7, 3560),
  venda(8, 9200), saida(8, 3890),
  venda(9, 9000), saida(9, 3478, { parentCategory: "ALIMENTACAO" }), saida(9, 400), saida(9, 86.05, { parentCategory: "IMPOSTOS", subcategory: "DAS (Simples Nacional)", entryDate: "2026-09-18" }),
  venda(10, 1440, { cliente: "Café Lume", forma: "boleto" }), venda(10, 900), venda(10, 240), venda(10, 320),
  venda(10, 450, { cliente: "Marina Costa", forma: "pix", recebeEm: "2026-10-06", entryDate: "2026-10-01" }),
];

const legal: ParametrosDoMei = {
  teto: { valor: 81000, fonte: "gov.br", fonteData: "2026-09-16" },
  tolerancia: { valor: 97200, fonte: "gov.br", fonteData: "2026-09-16" },
  das: { valor: 86.05, fonte: "Receita Federal", fonteData: "2026-01-02" },
  diaDoDas: { valor: 20, fonte: "Receita Federal", fonteData: "2026-01-02" },
};

describe("resumo da Empresa (Ana canônica)", () => {
  const config = lerConfigEmpresa({ tipo: "MEI", faz: "doces", formas: ["credito", "pix", "boleto"], prazoCredito: 30, salario: null });
  // A Marina entra só no teste de recebimentos: os R$ 2.900 de outubro da canônica não contam com ela.
  const lancs = ana.filter((l) => l.cliente !== "Marina Costa");
  const r = resumoDaEmpresa({ config, hoje: "2026-10-07", mesAtual: { ano: 2026, mes: 10 }, dia: 7, diasNoMes: 31, lancamentos: lancs, legal, caixa: 6800 });

  it("salário seguro R$ 4.600: média do lucro de jul, ago e set, menos 10% (13/10/2026)", () => {
    expect(r.fechados).toEqual([{ ano: 2026, mes: 7 }, { ano: 2026, mes: 8 }, { ano: 2026, mes: 9 }]);
    expect(r.lucros.map(Math.round)).toEqual([5240, 5310, 5036]);
    expect(r.seguro).toBe(4600);
    expect(r.salario).toBe(4600);
  });
  it("ponto de equilíbrio R$ 8.279, faltam R$ 5.379", () => {
    expect(r.reciboAtual.entrou).toBe(2900);
    expect(r.pe).toBe(8279);
    expect(r.falta).toBe(5379);
  });
  // 13/10/2026: o ritmo era a média de jul-set (R$ 9.000, passava em novembro). Agora é o
  // faturamento médio dos 12 meses fechados com venda: jan-set, R$ 63.520 ÷ 9 = R$ 7.057,78.
  // Cabem R$ 14.580: 2,07 meses depois de outubro, passa em dezembro. O faturado segue a soma real.
  it("MEI 82%, no faturamento médio de 9 meses passa em dezembro", () => {
    expect(r.limite!.faturado).toBe(66420);
    expect(Math.round(r.limite!.pct * 100)).toBe(82);
    expect(r.limite!.ritmo).toBeCloseTo(7057.78, 2);
    expect(r.limite!.ritmoMeses).toBe(9);
    expect(r.limite!.passaEm).toBe(12);
  });
  it("faturamento médio: ignora o mês de hoje e os meses sem venda; mais de 12 meses atrás não conta", () => {
    const l = [venda(9, 6000), venda(7, 4000), saida(8, 500), venda(10, 99999), { ...venda(9, 50000), year: 2025 }];
    expect(faturamentoMedio(l, { ano: 2026, mes: 10 })).toEqual({ ritmo: 5000, meses: 2 });
    expect(faturamentoMedio([venda(10, 100)], { ano: 2026, mes: 10 })).toEqual({ ritmo: null, meses: 0 });
  });
  it("guia de R$ 86,05 que vence dia 20, ainda não paga em outubro", () => {
    expect(r.guia).toEqual({ valor: 86.05, vence: "2026-10-20", paga: false, diasAte: 13 });
  });
  it("a Marina deve R$ 450 há 5 dias (pela data em que o dinheiro devia cair)", () => {
    const c = resumoDaEmpresa({ config, hoje: "2026-10-11", mesAtual: { ano: 2026, mes: 10 }, dia: 11, diasNoMes: 31, lancamentos: ana, legal, caixa: 0 });
    expect(c.devendo.map((d) => [d.cliente, d.valor, d.dias])).toEqual([["Marina Costa", 450, 5]]);
  });
  it("caixa de R$ 6.800 paga 40 dias", () => {
    expect(r.caixaDias).toBe(40);
  });
  it("o salário combinado vale no lugar do seguro", () => {
    const c = resumoDaEmpresa({ config: { ...config!, salario: 3000 }, hoje: "2026-10-07", mesAtual: { ano: 2026, mes: 10 }, dia: 7, diasNoMes: 31, lancamentos: lancs, legal, caixa: 0 });
    expect(c.salario).toBe(3000);
    expect(c.caixaDias).toBeNull();
  });
  it("fora do MEI: sem teto, sem guia (números de ME e autônoma não aparecem)", () => {
    const c = resumoDaEmpresa({ config: { ...config!, tipo: "ME" }, hoje: "2026-10-07", mesAtual: { ano: 2026, mes: 10 }, dia: 7, diasNoMes: 31, lancamentos: lancs, legal, caixa: 6800 });
    expect(c.limite).toBeNull();
    expect(c.guia).toBeNull();
  });
  it("sem a linha legal, o número não aparece", () => {
    const c = resumoDaEmpresa({ config, hoje: "2026-10-07", mesAtual: { ano: 2026, mes: 10 }, dia: 7, diasNoMes: 31, lancamentos: lancs, legal: { teto: null, tolerancia: null, das: null, diaDoDas: null }, caixa: 6800 });
    expect(c.limite).toBeNull();
    expect(c.guia).toBeNull();
  });
  it("conta nova: sem mês fechado, nada de salário seguro nem ponto de equilíbrio", () => {
    const c = resumoDaEmpresa({ config, hoje: "2026-10-07", mesAtual: { ano: 2026, mes: 10 }, dia: 7, diasNoMes: 31, lancamentos: [venda(10, 100)], legal, caixa: 0 });
    expect(c.seguro).toBeNull();
    expect(c.salario).toBe(0);
    expect(c.pe).toBeNull();
    expect(c.falta).toBeNull();
  });
});
