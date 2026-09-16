import { describe, expect, it } from "vitest";
import { buildLaudo, diffLaudo, isLaudo } from "../laudo";

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
    expect(l.sections.map((s) => s.question)).toEqual(["Está cara ou barata?", "Está cheio?", "Cobra muito?"]);
    expect(l.facts).toEqual([
      { label: "Segmento", value: "Galpões logísticos" },
      { label: "Imóveis", value: "17" },
    ]);
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
