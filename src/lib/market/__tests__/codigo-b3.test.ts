import { describe, expect, it } from "vitest";
import { ehCodigoB3, UNITS_B3 } from "../codigo-b3";
import { guessAssetClass, parsePortfolioStatement } from "@/lib/import/portfolio-parser";
import { parseB3Position } from "@/lib/import/b3-posicao";
import { looksLikeMarketTicker, paysDividendsInReais } from "@/lib/analysis/dividend-scraper";
import { tickerValido, tiposParaTentar } from "@/lib/analysis/tipo-do-ticker";
import { tipoDaAnalise } from "@/lib/analysis/analises-dados";

const DA_B3 = ["B3SA3", "PETR4", "VALE3", "BBAS3", "ITUB4", "MGLU3", "XPLG11", "HGLG11", "IVVB11", "TAEE11", "M1TA34"];

describe("código da B3", () => {
  it.each(DA_B3)("%s é código da B3", (c) => {
    expect(ehCodigoB3(c)).toBe(true);
    expect(looksLikeMarketTicker(c)).toBe(true);
    expect(paysDividendsInReais(c)).toBe(true);
    expect(tickerValido(c)).toBe(true);
  });

  it("VOO é de fora e texto solto não vira código", () => {
    expect(ehCodigoB3("VOO")).toBe(false);
    expect(tickerValido("VOO")).toBe(true);
    expect(paysDividendsInReais("VOO")).toBe(false);
    expect(ehCodigoB3("PIX123")).toBe(false);
    expect(ehCodigoB3("CDB 2027")).toBe(false);
  });

  it("B3SA3 é ação, com ficha de ação", () => {
    expect(guessAssetClass("B3SA3")).toBe("ACAO");
    expect(tiposParaTentar("B3SA3", null)).toEqual(["STOCK"]);
    expect(tipoDaAnalise({ assetClass: "ACAO", ticker: "B3SA3", currency: "BRL" })).toBe("STOCK");
  });

  it("a posição da B3 com B3SA3 entra como ação, com o código", () => {
    const csv = "Produto;Instituição;Conta;Código de Negociação;Quantidade;Valor Atualizado\nB3 S.A. - BRASIL, BOLSA, BALCAO;XP;1;B3SA3;100;1.250,00\n";
    const r = parseB3Position(csv);
    const h = r;
    expect(h[0]).toMatchObject({ ticker: "B3SA3", assetClass: "ACAO" });
  });

  it("units entram como ação, fundo imobiliário continua fundo", () => {
    for (const u of ["TAEE11", "KLBN11", "SANB11", "BPAC11", "ENGI11", "ALUP11"]) {
      expect(UNITS_B3.has(u)).toBe(true);
      expect(guessAssetClass(u)).toBe("ACAO");
    }
    expect(guessAssetClass("XPLG11")).toBe("FII");
    expect(guessAssetClass("HGLG11")).toBe("FII");
    expect(guessAssetClass("IVVB11")).toBe("FUNDO");
    expect(tipoDaAnalise({ assetClass: "FII", ticker: "TAEE11", currency: "BRL" })).toBe("STOCK");
  });

  it("o CSV simples com B3SA3 é lido", () => {
    const r = parsePortfolioStatement("Código;Quantidade;Valor\nB3SA3;100;1250,00\n");
    expect(JSON.stringify(r)).toContain("B3SA3");
  });
});
