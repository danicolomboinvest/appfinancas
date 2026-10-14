import { describe, expect, it } from "vitest";
import {
  dividendosPorAno,
  geralDoAtivo,
  gruposComparar,
  nomeCurtoRendaFixa,
  perguntasDoAtivo,
  perguntasRendaFixa,
  proventosMensais,
  quemVaiMelhor,
  termometro,
  vaiBem,
  type EntradaDoAtivo,
  type Provento,
} from "../quatro-perguntas";
import { rendaConstante } from "../fii-overview";
import { buildEtfOverview } from "../etf-overview";
import { buildLaudo } from "../laudo";

const HOJE = new Date(Date.UTC(2026, 9, 7, 12)); // quarta, 7 de outubro de 2026 (Ana canônica)

/** 12 rendimentos mensais iguais, de nov/2025 a out/2026 (pagos no dia 14). */
function mensais(valor: number | number[], ate = HOJE): Provento[] {
  const lista = Array.isArray(valor) ? valor : Array.from({ length: 12 }, () => valor);
  return lista.map((v, i) => ({ pagamento: new Date(Date.UTC(ate.getUTCFullYear(), ate.getUTCMonth() - (lista.length - 1 - i), 14)), valor: v }));
}

const base = (e: Partial<EntradaDoAtivo> & Pick<EntradaDoAtivo, "tipo" | "ticker" | "indicadores">): EntradaDoAtivo => ({ cotacao: null, moeda: "BRL", proventos: [], hoje: HOJE, ...e });

// Os indicadores da Ana nos protótipos (tema-girly.html, ANS), no formato que a fonte entrega.
const ANA: Record<string, EntradaDoAtivo> = {
  ITSA4: base({ tipo: "STOCK", ticker: "ITSA4", cotacao: 9.85, indicadores: { p_l: "8,2", p_vp: "1,5", ev_ebitda: "7,5", dividend_yield: "8,1%", roe: "17%", roic: "11%", margem_liquida: "95%", margem_ebit: "90%", evolucao_receita: "7%", evolucao_lucro: "9%", divida_liquida_ebitda: "-0,2", divida_liquida_patrimonio: "0,05", liquidez_corrente: "1,8" } }),
  BBAS3: base({ tipo: "STOCK", ticker: "BBAS3", cotacao: 24.1, indicadores: { p_l: "4,3", p_vp: "0,7", dividend_yield: "9,5%", roe: "19%", margem_liquida: "14%", evolucao_receita: "9%", evolucao_lucro: "12%" } }),
  MXRF11: base({ tipo: "FII", ticker: "MXRF11", cotacao: 9.62, indicadores: { p_vp: "1,02", taxa_administracao: "0,90%", liquidez_fii: "R$ 12 M" }, proventos: mensais(0.1) }),
  HGLG11: base({ tipo: "FII", ticker: "HGLG11", cotacao: 158.4, indicadores: { p_vp: "1,18", vacancia_atual: "12%", taxa_administracao: "0,60%", liquidez_fii: "R$ 8 M" }, proventos: mensais(1.1) }),
  VOO: base({ tipo: "ETF", ticker: "VOO", moeda: "USD", indicadores: { rentabilidade_12m: "24%", rentabilidade_5anos: "95%", patrimonio_liquido_etf: "R$ 500 B", taxa_administracao_etf: "0,03%" } }),
  IVVB11: base({ tipo: "ETF", ticker: "IVVB11", cotacao: 352, indicadores: { rentabilidade_12m: "31%", rentabilidade_5anos: "120%", patrimonio_liquido_etf: "R$ 8 B", taxa_administracao_etf: "0,23%" } }),
};

describe("o anel do topo das Análises (regra da canônica)", () => {
  it("Ana: 5 de 6 vão bem, com o HGLG11 na média", () => {
    const gerais = Object.fromEntries(Object.entries(ANA).map(([k, e]) => [k, geralDoAtivo(perguntasDoAtivo(e))]));
    expect(gerais.HGLG11).toBe("ok");
    expect(Object.values(gerais).filter(vaiBem)).toHaveLength(5);
  });

  it("'na média' não conta como vai bem, e atenção também não", () => {
    expect(vaiBem("forte")).toBe(true);
    expect(vaiBem("ok")).toBe(false);
    expect(vaiBem("atencao")).toBe(false);
    expect(vaiBem(null)).toBe(false);
  });

  it("o termômetro é a média das posições: 0,7 ou mais é forte, 0,3 ou menos é atenção", () => {
    expect(termometro(["forte", "forte", "forte", "ok"])).toBe("forte"); // 0,785
    expect(termometro(["forte", "atencao", "forte"])).toBe("ok"); // 0,627 (HGLG11)
    expect(termometro(["atencao", "atencao", "ok"])).toBe("atencao");
    expect(termometro([null, undefined])).toBeNull();
  });
});

describe("as quatro perguntas", () => {
  it("ação: lucro, dívida, dividendo numa pergunta própria e preço", () => {
    const p = perguntasDoAtivo(ANA.ITSA4);
    expect(p.map((x) => x.k)).toEqual(["lucro", "divida", "paga", "preco"]);
    expect(p.map((x) => x.f)).toEqual(["forte", "forte", "forte", "ok"]);
    expect(p[2].q).toBe("Paga bem?");
  });

  it("dividendo de 5% ou mais é forte; abaixo é ok, nunca atenção", () => {
    const pouco = perguntasDoAtivo(base({ tipo: "STOCK", ticker: "WEGE3", indicadores: { dividend_yield: "1,8%" } }));
    expect(pouco.find((x) => x.k === "paga")?.f).toBe("ok");
    const bem = perguntasDoAtivo(base({ tipo: "STOCK", ticker: "X", indicadores: { dividend_yield: "5%" } }));
    expect(bem.find((x) => x.k === "paga")?.f).toBe("forte");
  });

  it("banco sem número de dívida: a pergunta fica sem cor e diz que falta o dado", () => {
    const d = perguntasDoAtivo(ANA.BBAS3).find((x) => x.k === "divida")!;
    expect(d.f).toBeNull();
    expect(d.graficos).toEqual([]);
    expect(d.num).toMatch(/fonte não traz/);
  });

  it("sem série de lucro, o cartão do lucro fica só com a régua e o número (nada de colunas inventadas)", () => {
    const l = perguntasDoAtivo(ANA.ITSA4).find((x) => x.k === "lucro")!;
    expect(l.graficos.map((g) => g.tipo)).toEqual(["regua"]);
  });

  it("FII: renda constante, quanto paga (sem cor), preço e liquidez", () => {
    const p = perguntasDoAtivo(ANA.MXRF11);
    expect(p.map((x) => x.k)).toEqual(["renda", "paga", "preco", "vender"]);
    expect(p[0].f).toBe("forte");
    expect(p[1].f).toBeNull();
    expect(p[1].r).toBe("R$ 0,10 por cota");
  });

  it("ETF: o que é, rendeu, tamanho e taxa", () => {
    const p = perguntasDoAtivo(ANA.VOO);
    expect(p.map((x) => x.k)).toEqual(["oque", "rendeu", "grande", "cobra"]);
    expect(p.find((x) => x.k === "cobra")?.f).toBe("forte");
    expect(p[0].graficos[0]).toEqual({ tipo: "pontos100" });
  });

  it("ETF sem a taxa na fonte: a pergunta fica sem cor, sem régua", () => {
    const p = perguntasDoAtivo(base({ tipo: "ETF", ticker: "IVVB11", indicadores: { rentabilidade_12m: "31%" } }));
    const cobra = p.find((x) => x.k === "cobra")!;
    expect(cobra.f).toBeNull();
    expect(cobra.graficos).toEqual([]);
  });
});

describe("régua do FII: a renda é constante?", () => {
  it("forte quando nenhum mês cai mais de 20% do anterior", () => {
    expect(rendaConstante([1, 1, 1, 0.9, 0.95, 1, 1, 0.8, 0.8, 0.9, 1, 1])).toBe("favoravel");
  });
  it("atenção quando algum mês cai mais de 20%", () => {
    expect(rendaConstante([1, 1, 1, 1, 0.79, 1, 1, 1, 1, 1, 1, 1])).toBe("atencao");
  });
  it("exatamente 80% do mês anterior ainda é constante", () => {
    expect(rendaConstante([1, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8])).toBe("favoravel");
  });
  it("menos de 12 meses: sem régua", () => {
    expect(rendaConstante([1, 1, 1])).toBeNull();
  });
  it("mês sem pagamento é queda", () => {
    const valores = mensais([1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1]).filter((p) => p.valor > 0);
    const m = proventosMensais(valores, HOJE)!;
    expect(m.valores[5]).toBe(0);
    expect(rendaConstante(m.valores)).toBe("atencao");
  });
  it("histórico mais curto que 12 meses não vira queda: fica sem resposta", () => {
    const curto = mensais([1, 1, 1]);
    expect(proventosMensais(curto, HOJE)).toBeNull();
    const p = perguntasDoAtivo(base({ tipo: "FII", ticker: "NOVO11", indicadores: {}, proventos: curto }));
    expect(p[0].f).toBeNull();
    expect(p[0].graficos).toEqual([]);
  });
  it("a janela acaba no mês atual quando ele já tem pagamento; senão no mês passado", () => {
    const comOutubro = proventosMensais(mensais(0.1), HOJE)!;
    expect(comOutubro.rotulos[11]).toBe("out");
    const ateSetembro = proventosMensais(mensais(0.1, new Date(Date.UTC(2026, 8, 20))), HOJE)!;
    expect(ateSetembro.rotulos[11]).toBe("set");
  });
});

describe("régua do ETF: taxa de administração", () => {
  it("até 1% ao ano é forte (favorável)", () => {
    expect(buildEtfOverview({ taxa_administracao_etf: "1%" }).items[0].signal).toBe("favoravel");
    expect(buildEtfOverview({ taxa_administracao_etf: "1,2%" }).items[0].signal).toBe("neutro");
    expect(buildEtfOverview({ taxa_administracao_etf: "1,6%" }).items[0].signal).toBe("atencao");
  });
  it("o laudo do ETF ganha a pergunta 'Cobra quanto?'", () => {
    const l = buildLaudo("ETF", { taxa_administracao_etf: "0,23%" });
    expect(l.sections.map((s) => s.question)).toEqual(["Cobra quanto?"]);
  });
});

describe("dividendos por ano", () => {
  it("soma por ano fechado e só os anos que o histórico cobre", () => {
    const prov: Provento[] = [
      { pagamento: new Date(Date.UTC(2023, 3, 1)), valor: 0.5 },
      { pagamento: new Date(Date.UTC(2024, 3, 1)), valor: 0.6 },
      { pagamento: new Date(Date.UTC(2025, 3, 1)), valor: 0.4 },
      { pagamento: new Date(Date.UTC(2025, 9, 1)), valor: 0.3 },
      { pagamento: new Date(Date.UTC(2026, 3, 1)), valor: 9 },
    ];
    expect(dividendosPorAno(prov, HOJE)).toEqual({ valores: [0.5, 0.6, 0.7], rotulos: ["2023", "2024", "2025"] });
  });
  it("menos de 2 anos: sem colunas", () => {
    expect(dividendosPorAno([{ pagamento: new Date(Date.UTC(2025, 3, 1)), valor: 1 }], HOJE)).toBeNull();
  });
});

describe("renda fixa", () => {
  it("lê do nome o que está no nome, e nada além", () => {
    const cdb = perguntasRendaFixa({ nome: "CDB Banco Inter 105% CDI", classe: "RENDA_FIXA", indexador: "POS_FIXADO" });
    expect(cdb.map((p) => p.r)).toEqual(["105% do CDI", "Sem esse dado", "FGC", "Sem esse dado"]);
    const td = perguntasRendaFixa({ nome: "Tesouro IPCA+ 2035", classe: "TESOURO_DIRETO", indexador: "IPCA" });
    expect(td.map((p) => p.r)).toEqual(["Inflação + uma taxa fixa", "2035", "Tesouro Nacional", "Sim, todo dia útil"]);
    expect(td.every((p) => p.f === null)).toBe(true);
  });
  it("com a taxa da compra, diz a taxa dela no lugar do genérico", () => {
    const td = perguntasRendaFixa({ nome: "Tesouro IPCA+ 2035", classe: "TESOURO_DIRETO", indexador: "IPCA", taxaCompra: 0.075 });
    expect(td[0].r).toBe("IPCA + 7,5% ao ano");
    const cdb = perguntasRendaFixa({ nome: "CDB XP", classe: "RENDA_FIXA", indexador: "POS_FIXADO", taxaCompra: 1.1 });
    expect(cdb[0].r).toBe("110% do CDI");
    const pre = perguntasRendaFixa({ nome: "LCA BB", classe: "RENDA_FIXA", indexador: "PREFIXADO", taxaCompra: 0.12 });
    expect(pre[0].r).toBe("12% ao ano");
    // O nome manda quando já diz a taxa; o Tesouro Selic continua "Acompanha a Selic".
    expect(perguntasRendaFixa({ nome: "CDB Banco Inter 105% CDI", classe: "RENDA_FIXA", indexador: "POS_FIXADO", taxaCompra: 1.1 })[0].r).toBe("105% do CDI");
    expect(perguntasRendaFixa({ nome: "Tesouro Selic 2029", classe: "TESOURO_DIRETO", indexador: "POS_FIXADO", taxaCompra: 1 })[0].r).toBe("Acompanha a Selic");
  });
  it("nome curto tira a taxa do fim", () => {
    expect(nomeCurtoRendaFixa("CDB Banco Inter 105% CDI")).toBe("CDB Banco Inter");
    expect(nomeCurtoRendaFixa("Tesouro Selic 2029")).toBe("Tesouro Selic 2029");
  });
});

describe("comparar (barras espelhadas)", () => {
  it("ITSA4 x BBAS3: só números que existem; dívida de banco fica de um lado só", () => {
    const g = gruposComparar("STOCK", ANA.ITSA4.indicadores, ANA.BBAS3.indicadores);
    expect(g.map((x) => x.q)).toEqual(["Ganha dinheiro?", "Paga bem?", "Cara ou barata?", "Deve muito?"]);
    const divida = g[3].linhas[0];
    expect(divida.a).toBe(-0.2);
    expect(divida.b).toBeNull();
    expect(quemVaiMelhor(divida)).toBeNull();
  });
  it("quem vai melhor respeita o sentido de cada número", () => {
    const g = gruposComparar("STOCK", ANA.ITSA4.indicadores, ANA.BBAS3.indicadores);
    const pl = g[2].linhas.find((l) => l.rotulo === "Preço ÷ lucro")!;
    expect(quemVaiMelhor(pl)).toBe("b"); // 4,3 é mais barato que 8,2
    const roe = g[0].linhas[0];
    expect(quemVaiMelhor(roe)).toBe("b"); // 19% > 17%
  });
});

describe("dados que a fonte entrega pela metade", () => {
  it("banco: zero em dívida, EBITDA e ROIC é 'sem dado', e a liquidez sozinha não responde a dívida", () => {
    const bb = perguntasDoAtivo(base({ tipo: "STOCK", ticker: "BBAS3", indicadores: { p_l: "7,45", p_vp: "0,62", ev_ebitda: "0", roe: "10%", roic: "0%", divida_liquida_ebitda: "0", divida_liquida_patrimonio: "0", liquidez_corrente: "11,58", dividend_yield: "8%" } }));
    const divida = bb.find((x) => x.k === "divida")!;
    expect(divida.f).toBeNull();
    expect(divida.graficos).toEqual([]);
    const preco = bb.find((x) => x.k === "preco")!;
    expect(preco.graficos.map((g) => (g.tipo === "regua" ? g.rotulo : ""))).toEqual(["Preço ÷ lucro", "Preço ÷ patrimônio"]);
  });

  it("ETF americano em trilhões é muito grande, não pequeno", () => {
    const voo = perguntasDoAtivo(base({ tipo: "ETF", ticker: "VOO", moeda: "USD", indicadores: { patrimonio_liquido_etf: "US$ 1,05 T" } }));
    expect(voo.find((x) => x.k === "grande")?.f).toBe("forte");
    expect(voo.find((x) => x.k === "grande")?.num).toBe("Patrimônio de US$ 1,05 tri.");
  });

  it("comparar patrimônio só na mesma moeda", () => {
    const g = gruposComparar("ETF", { patrimonio_liquido_etf: "US$ 1,05 T", rentabilidade_12m: "20%" }, { patrimonio_liquido_etf: "R$ 6,34 B", rentabilidade_12m: "8%" });
    expect(g.map((x) => x.q)).toEqual(["Rendeu?"]);
  });
});

