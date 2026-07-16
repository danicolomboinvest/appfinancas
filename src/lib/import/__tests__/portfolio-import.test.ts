import { describe, it, expect } from "vitest";
import { parsePortfolioStatement, guessAssetClass, detectFixedIncomeIndex } from "../portfolio-parser";

describe("detectFixedIncomeIndex", () => {
  it("reads the indexer from the rate text", () => {
    expect(detectFixedIncomeIndex("101,00% do CDI")).toBe("POS_FIXADO");
    expect(detectFixedIncomeIndex("SELIC + 0,14%")).toBe("POS_FIXADO");
    expect(detectFixedIncomeIndex("IPCA + 9,50%")).toBe("IPCA");
    expect(detectFixedIncomeIndex("13,20% a.a.")).toBe("PREFIXADO");
    expect(detectFixedIncomeIndex("")).toBeUndefined();
  });

  it("falls back to the Tesouro título name when the rate is missing", () => {
    expect(detectFixedIncomeIndex("", "LFT")).toBe("POS_FIXADO");
    expect(detectFixedIncomeIndex("", "LTN")).toBe("PREFIXADO");
    expect(detectFixedIncomeIndex("", "NTNB-P")).toBe("IPCA");
  });
});

describe("guessAssetClass", () => {
  it("infers class from ticker suffix", () => {
    expect(guessAssetClass("HGLG11")).toBe("FII");
    expect(guessAssetClass("PETR4")).toBe("ACAO");
    expect(guessAssetClass("ITUB3")).toBe("ACAO");
    expect(guessAssetClass("TSLA34")).toBe("ACAO"); // BDR termina em 34 → trata como ação
  });
});

describe("parsePortfolioStatement", () => {
  it("parses a B3-style CSV with código/quantidade/valor", () => {
    const csv = `Código;Quantidade;Valor
PETR4;100;3.500,00
HGLG11;50;8.000,00`;
    const holdings = parsePortfolioStatement(csv);
    expect(holdings).toHaveLength(2);
    expect(holdings[0]).toEqual({ ticker: "PETR4", quantity: 100, value: 3500 });
    expect(holdings[1]).toEqual({ ticker: "HGLG11", quantity: 50, value: 8000 });
  });

  it("parses loose text with tickers", () => {
    const text = `Minha carteira:
PETR4 100 acoes 3.500,00
KNRI11 30 cotas 4.200,00`;
    const holdings = parsePortfolioStatement(text);
    expect(holdings.map((h) => h.ticker)).toEqual(["PETR4", "KNRI11"]);
    expect(holdings[0].quantity).toBe(100);
  });

  it("merges repeated tickers (multiple buy lines)", () => {
    const csv = `Ticker;Quantidade;Valor
PETR4;100;3.500,00
PETR4;50;1.800,00`;
    const holdings = parsePortfolioStatement(csv);
    expect(holdings).toHaveLength(1);
    expect(holdings[0].quantity).toBe(150);
    expect(holdings[0].value).toBe(5300);
  });

  it("ignores lines without a valid ticker", () => {
    const text = `Saldo em conta: 1.000,00\nPETR4 10 350,00`;
    const holdings = parsePortfolioStatement(text);
    expect(holdings).toHaveLength(1);
    expect(holdings[0].ticker).toBe("PETR4");
  });

  it("parses a sectioned bank statement (BTG-style, US number format)", () => {
    // Recorte real (anonimizado) do "Extrato da Conta Investimento" do BTG: várias abas
    // concatenadas, tabelas por seção, números americanos e seções que devem ser ignoradas.
    const text = [
      ";Extrato da Conta Investimento;;;;",
      ";Fundos;;;;;;;;",
      ";Posições;;;;;;;;",
      ";Posição > Portfólio de fundos;;;;;;;;",
      ";Data Referência;Saldo Líquido R$ 30/06/26;Quantidade de Cotas;Cotação Atual R$;Saldo Bruto R$;Provisão de IR R$;Provisão de IOF R$;Saldo Líquido R$;Variação Nominal R$",
      ";BTG Yield DI FIRFRef CrPr - Classe CNPJ: 00.840.011/0001-80;;;;;;;;",
      ";10/07/2026;2,748.23;48.194989;57.51975625;2,772.16;14.60;-;2,757.56;9.33",
      ";Total em fundos;;;;2,772.16;14.60;-;2,757.56;9.33",
      ";Detalhamento;;;;;;;;",
      ";Detalhamento > BTG Yield DI FIRFRef CrPr;;;;;;;;",
      ";Data Compra;Quantidade de Cotas;Cotação Compra R$;Valor de Compra R$;Saldo Bruto R$;;;;",
      ";30/03/2026;48.194989;55.36259478;2,668.20;2,772.16;;;;",
      ";Renda Fixa;;;;;;;;",
      ";Posições;;;;;;;;",
      ";Posição > CRA;;;;;;;;",
      ";Emissor;Ativo;Emissão;Vencimento;Liquidez;Taxa Média Ponderada;Quantidade;Preço R$;Saldo Bruto R$",
      ";CERES;CRA-CRA0250038P;15/04/2025;15/07/2030;Não;110,00% do CDI;7;1078.193713;7,547.35",
      ";Total;;;;;;;;7,547.35",
      ";Posição > TESOURO DIRETO - LFT;;;;;;;;",
      ";Emissor;Ativo;Emissão;Vencimento;Liquidez;Taxa Média Ponderada;Quantidade;Preço R$;Saldo Bruto R$",
      ";BACEN;LFT;05/10/2022;01/03/2029;Não;SELIC + 0,14%;0.01;19379.93;193.79",
      ";Total;;;;;;;;193.79",
      ";Renda Variável;;;;;;;;",
      ";Posição;;;;;;;;",
      ";Posição > Ações;;;;;;;;",
      ";Código;Ação;Qtde.;Preço Fechamento R$;Preço Médio R$;Saldo Bruto R$;;;",
      ";ITSA4;ITAUSA      PN  N1;414;14.17;9.82;5,870.52;;;",
      ";Total em Ações R$;;;;;5,870.52;;;",
      ";Movimentação;;;;;;;;",
      ";Movimentação > Ações;;;;;;;;",
      ";Data;Transação;Código;Qtde.;Preço R$;Valor Bruto R$;;;",
      ";01/07/2026;JUROS S/CAPITAL;ITSA4;414;-;10.03;;;",
      ";Posição;;;;;;;;",
      ";Posição > Ações | Aluguel;;;;;;;;",
      ";Código;Qtde.;Posição;Preço de Referência R$;Valor Contratado R$;;;;",
      ";EGIE3;1;Doador;33.39;33.39;;;;",
      ";Posição;;;;;;;;",
      ";Posição > Fundos Listados;;;;;;;;",
      ";Código;Ativo;Tipo;Qtde.;Preço Fechamento R$;Preço Médio R$;Saldo Bruto R$;;",
      ";MXRF11;FII MAXI RENCI  ER;FII;1000;9.74;10.29;9,760.00;;",
      ";Total em Fundos Listados R$;;;;;;9,760.00;;",
    ].join("\n");

    const holdings = parsePortfolioStatement(text);
    const byName = new Map(holdings.map((h) => [h.ticker, h]));

    // Fundo com nome limpo (sem CNPJ), sem duplicar pelo Detalhamento
    expect(byName.get("BTG Yield DI FIRFRef CrPr")).toMatchObject({ quantity: 48.194989, value: 2772.16, assetClass: "FUNDO" });
    // Renda fixa com emissor legível
    expect(byName.get("CRA-CRA0250038P (CERES)")).toMatchObject({ quantity: 7, value: 7547.35, assetClass: "RENDA_FIXA" });
    // Tesouro identificado
    expect(byName.get("LFT")).toMatchObject({ quantity: 0.01, value: 193.79, assetClass: "TESOURO_DIRETO" });
    // Ação (número americano 5,870.52 → 5870.52), sem duplicar pela Movimentação
    expect(byName.get("ITSA4")).toMatchObject({ quantity: 414, value: 5870.52, assetClass: "ACAO" });
    // FII com classe vinda da coluna Tipo
    expect(byName.get("MXRF11")).toMatchObject({ quantity: 1000, value: 9760, assetClass: "FII" });
    // Aluguel de ações NÃO vira posição (evita duplicar/contar errado)
    expect(byName.has("EGIE3")).toBe(false);
    expect(holdings).toHaveLength(5);
  });
});
