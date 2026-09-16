import { describe, expect, it } from "vitest";
import { attentionLine, buildLaudo, compactValue, diffLaudo, isLaudo, sectionGauge, sectionSummary } from "../laudo";

/** Indicadores plausíveis de uma petroleira: baratos, rentáveis, pouco endividados, receita caindo. */
const PETRO = {
  p_l: "4,8",
  p_vp: "1,1",
  ev_ebitda: "3,2",
  dividend_yield: "12,4%",
  roe: "27%",
  roic: "18%",
  margem_liquida: "23%",
  margem_ebit: "34%",
  divida_liquida_ebitda: "0,9",
  divida_liquida_patrimonio: "0,6",
  liquidez_corrente: "0,9",
  evolucao_receita: "-3%",
  evolucao_lucro: "18%",
};

describe("buildLaudo", () => {
  it("groups the indicators under human questions, in order", () => {
    const l = buildLaudo("STOCK", PETRO);
    expect(l.sections.map((s) => s.question)).toEqual([
      "Está cara ou barata?",
      "Dá lucro?",
      "Deve muito?",
      "Está crescendo?",
    ]);
    expect(l.sections[0].items.map((i) => i.key)).toEqual(["p_l", "p_vp", "ev_ebitda", "dividend_yield"]);
  });

  it("scores from the badges: favorável 10, na média 6, atenção 2", () => {
    const l = buildLaudo("STOCK", PETRO);
    expect(l.counts).toEqual({ favoravel: 9, neutro: 2, atencao: 2 });
    // (9×10 + 2×6 + 2×2) / 13 = 8,15 → 8,2
    expect(l.autoScore).toBe(8.2);
  });

  it("opens with a sentence that names the attention points", () => {
    const l = buildLaudo("STOCK", PETRO);
    expect(l.verdict).toBe("Mais pontos a favor do que contra nos números de hoje. Atenção em: liquidez corrente e crescimento de receita.");
  });

  it("says what each number means, in plain words, with the value inside", () => {
    const l = buildLaudo("STOCK", PETRO);
    const roe = l.sections[1].items.find((i) => i.key === "roe");
    expect(roe?.plain).toBe("De cada R$ 100 dos sócios, R$ 27 viram lucro por ano");
    const receita = l.sections[3].items.find((i) => i.key === "evolucao_receita");
    expect(receita?.plain).toBe("Vendeu 3% menos que há 5 anos");
  });

  it("skips sections with nothing to show and copes with an empty read", () => {
    const l = buildLaudo("STOCK", { roe: "20%" });
    expect(l.sections).toHaveLength(1);
    const vazio = buildLaudo("STOCK", {});
    expect(vazio.autoScore).toBeNull();
    expect(vazio.verdict).toBe("Sem indicadores suficientes pra uma leitura.");
  });

  it("reads a FII with its own questions and keeps the facts that have no ruler", () => {
    const l = buildLaudo("FII", {
      p_vp: "0,92",
      vacancia_atual: "3,1%",
      taxa_administracao: "1,1%",
      segmento: "Galpões logísticos",
      numero_imoveis: "17",
    });
    expect(l.sections.map((s) => s.question)).toEqual([
      "Está cara ou barata?",
      "É grande e diversificado?",
      "Está cheio?",
      "Cobra muito?",
    ]);
    // 17 imóveis é diversificação, e diversificação é favorável — virou quadradinho, não rodapé.
    const imoveis = l.sections[1].items.find((i) => i.key === "numero_imoveis");
    expect(imoveis?.signal).toBe("favoravel");
    expect(imoveis?.plain).toBe("Tem 17 imóveis: a renda não depende de um endereço só");
    expect(l.facts).toEqual([{ label: "Segmento", value: "Galpões logísticos" }]);
  });

  it("reads a fund's size and daily trading from their magnitude text", () => {
    const l = buildLaudo("FII", { patrimonio_liquido: "R$ 7,57 Bilhões", liquidez_fii: "R$ 20,64 M" });
    const tamanho = l.sections[0].items[0];
    expect(tamanho.signal).toBe("favoravel");
    expect(tamanho.plain).toBe("Um fundo de R$ 7,57 bi");
    const liquidez = l.sections[1].items[0];
    expect(liquidez.plain).toBe("Negocia R$ 20,64 mi por dia");
  });

  it("shortens only the unit of a magnitude, never the number", () => {
    expect(compactValue("R$ 7,57 Bilhões")).toBe("R$ 7,57 bi");
    expect(compactValue("R$ 20,64 M")).toBe("R$ 20,64 mi");
    expect(compactValue("R$ 900 mil")).toBe("R$ 900 mil");
    expect(compactValue("4,13")).toBe("4,13");
  });

  it("summarises each question in one sentence, led by the attention point when there is one", () => {
    const l = buildLaudo("STOCK", PETRO);
    expect(sectionSummary(l.sections[2])).toEqual({
      signal: "atencao",
      text: "Pra cada R$ 1 de conta que vence em 12 meses, tem R$ 0,90 de caixa e a receber no mesmo prazo — não é sobre quanto a ação negocia na bolsa",
    });
    expect(sectionSummary(l.sections[1]).signal).toBe("favoravel");
  });

  it("places the gauge marker where the badges point, and names the side in plain words", () => {
    const l = buildLaudo("STOCK", PETRO);
    const preco = sectionGauge(l.sections[0]); // 3 favoráveis + 1 na média
    expect(preco.label).toBe("barata");
    expect(preco.position).toBeGreaterThan(0.7);
    const divida = sectionGauge(l.sections[2]); // 1 favorável, 1 na média, 1 atenção → meio
    expect(divida.signal).toBe("neutro");
    expect(divida.label).toBe("na média");
  });

  it("opens with only the attention points, by their friendly names", () => {
    expect(attentionLine(buildLaudo("STOCK", PETRO))).toEqual({
      text: "2 pontos de atenção:",
      names: ["Caixa de curto prazo", "Vendas em 5 anos"],
    });
    expect(attentionLine(buildLaudo("STOCK", { roe: "20%" })).text).toBe("Nenhum ponto de atenção nos números de hoje.");
  });

  it("reads an ETF", () => {
    const l = buildLaudo("ETF", { patrimonio_liquido_etf: "R$ 6,34 B", rentabilidade_12m: "12%", rentabilidade_5anos: "-4%" });
    expect(l.counts).toEqual({ favoravel: 2, neutro: 0, atencao: 1 });
    expect(l.verdict).toContain("Atenção em: rentabilidade 5 anos.");
  });
});

describe("diffLaudo", () => {
  it("reports only badges that changed, not numbers that wobbled inside the same band", () => {
    const antes = buildLaudo("STOCK", PETRO);
    const depois = buildLaudo("STOCK", { ...PETRO, roe: "26%", liquidez_corrente: "1,6" });
    const changes = diffLaudo(antes, depois);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ key: "liquidez_corrente", from: "atencao", to: "favoravel" });
  });

  it("has nothing to compare on the first read", () => {
    expect(diffLaudo(null, buildLaudo("STOCK", PETRO))).toEqual([]);
  });
});

describe("isLaudo", () => {
  it("accepts a snapshot and rejects junk from an older column", () => {
    expect(isLaudo(buildLaudo("STOCK", PETRO))).toBe(true);
    expect(isLaudo(null)).toBe(false);
    expect(isLaudo({ sections: "x" })).toBe(false);
  });
});
