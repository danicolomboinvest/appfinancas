import { describe, expect, it } from "vitest";
import { contasQueOsProventosPagam, resumirProventos, type EventoDeProvento } from "../proventos";

/** Os proventos da Ana canônica (ana-canonica.md, item 5), com as cotas de hoje. */
const d = (ano: number, mes: number, dia: number) => new Date(Date.UTC(ano, mes - 1, dia));
const MESES_PAGOS: [number, number][] = [[2025, 12], [2026, 1], [2026, 2], [2026, 3], [2026, 4], [2026, 5], [2026, 6], [2026, 7], [2026, 8], [2026, 9]];
const MX = [28, 29, 30, 31, 32, 33, 34, 35, 35, 36];
const HG = [13, 14, 14, 15, 15, 16, 16, 17, 17, 17];
const eventos: EventoDeProvento[] = [
  ...MESES_PAGOS.map(([a, m], i) => ({ ticker: "MXRF11", kind: "Dividendos", paymentDate: d(a, m, 14), valuePerShare: MX[i] / 500 })),
  ...MESES_PAGOS.map(([a, m], i) => ({ ticker: "HGLG11", kind: "Dividendos", paymentDate: d(a, m, 14), valuePerShare: HG[i] / 20 })),
  ...[d(2026, 2, 27), d(2026, 5, 29), d(2026, 8, 28)].map((p) => ({ ticker: "BBAS3", kind: "Dividendos", paymentDate: p, valuePerShare: 0.45 })),
  ...[d(2025, 12, 30), d(2026, 3, 31), d(2026, 6, 30)].map((p) => ({ ticker: "ITSA4", kind: "Dividendos", paymentDate: p, valuePerShare: 0.028 })),
  // A caminho: 14/out e 1/nov.
  { ticker: "MXRF11", kind: "Dividendos", paymentDate: d(2026, 10, 14), valuePerShare: 0.1 },
  { ticker: "HGLG11", kind: "Dividendos", paymentDate: d(2026, 10, 14), valuePerShare: 1.1 },
  { ticker: "ITSA4", kind: "JSCP", paymentDate: d(2026, 11, 1), valuePerShare: 0.0244 / 0.85 },
  // De um ativo que ela não tem: não entra.
  { ticker: "PETR4", kind: "Dividendos", paymentDate: d(2026, 9, 1), valuePerShare: 2 },
];
const posicoes = [
  { ticker: "MXRF11", quantidade: 500, investido: 5025 },
  { ticker: "HGLG11", quantidade: 20, investido: 3300 },
  { ticker: "BBAS3", quantidade: 120, investido: 3300 },
  { ticker: "ITSA4", quantidade: 400, investido: 4080 },
];
const hoje = d(2026, 10, 11);

describe("Proventos (rodada 16, números da Ana)", () => {
  const r = resumirProventos(eventos, posicoes, hoje);

  it("12 meses R$ 672,60, média R$ 56,05 por mês", () => {
    expect(r.dozeMeses).toBe(672.6);
    expect(r.mediaPorMes).toBe(56.05);
  });

  it("a caminho R$ 81,76: MXRF11 R$ 50, HGLG11 R$ 22 em 14/out e ITSA4 JSCP R$ 9,76 (líquido) em 1/nov", () => {
    expect(r.totalACaminho).toBe(81.76);
    expect(r.aCaminho.map((p) => [p.ticker, p.valor])).toEqual([["MXRF11", 50], ["HGLG11", 22], ["ITSA4", 9.76]]);
  });

  it("quem mais pagou: MXRF11 323, BBAS3 162, HGLG11 154, ITSA4 33,60, com o rendimento sobre o que pagou", () => {
    expect(r.ranking.map((x) => [x.ticker, x.valor])).toEqual([["MXRF11", 323], ["BBAS3", 162], ["HGLG11", 154], ["ITSA4", 33.6]]);
    expect((r.ranking[0].sobreOQuePagou! * 100).toFixed(1)).toBe("6.4");
  });

  it("12 colunas, de dezembro a novembro; outubro e novembro com o que está a caminho", () => {
    expect(r.meses.map((m) => m.mes)).toEqual([12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(r.meses[10]).toMatchObject({ mes: 10, recebido: 0, aCaminho: 72 });
    expect(r.meses[11]).toMatchObject({ mes: 11, aCaminho: 9.76 });
  });

  it("sem cotas, sem proventos (nunca R$ 0 inventado)", () => {
    const vazio = resumirProventos(eventos, [{ ticker: "MXRF11", quantidade: 0, investido: null }], hoje);
    expect(vazio.dozeMeses).toBe(0);
    expect(vazio.ranking).toEqual([]);
  });
});

describe("Sua renda passiva já paga...", () => {
  it("as contas que cabem na média, das mais caras para as mais baratas", () => {
    const contas = [{ nome: "Netflix", valor: 55.9 }, { nome: "Spotify", valor: 21.9 }, { nome: "Aluguel", valor: 2200 }];
    expect(contasQueOsProventosPagam(56.05, contas).map((c) => c.nome)).toEqual(["Netflix"]);
    expect(contasQueOsProventosPagam(80, contas).map((c) => c.nome)).toEqual(["Netflix", "Spotify"]);
    expect(contasQueOsProventosPagam(0, contas)).toEqual([]);
  });
});
