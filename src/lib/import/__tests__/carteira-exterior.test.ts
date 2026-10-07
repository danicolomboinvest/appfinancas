import { describe, expect, it } from "vitest";
import { lerCarteiraNoExterior, numeroEmDolar, pareceCarteiraNoExterior } from "../carteira-exterior";
import { parsePortfolioStatement } from "../portfolio-parser";

describe("carteira no exterior", () => {
  it("lê número americano e brasileiro", () => {
    expect(numeroEmDolar("1,234.56")).toBe(1234.56);
    expect(numeroEmDolar("1.234,56")).toBe(1234.56);
    expect(numeroEmDolar("US$ 2.143,02")).toBe(2143.02);
    expect(numeroEmDolar("$700.80")).toBe(700.8);
    expect(numeroEmDolar("VOO")).toBeNaN();
  });

  it("planilha de ETFs de fora com valor em USD (a que dava 'não consegui ler')", () => {
    const text = ["Ticker;Tipo;% na Renda Variável;Valor (USD)", "VOO;S&P 500;0.25;700.8", "QQQ;Tech (Nasdaq 100);0.15;420.48", "SHV;Curto prazo;0.4;747.52"].join("\n");
    const r = parsePortfolioStatement(text);
    expect(r).toEqual([
      { ticker: "VOO", quantity: 0, value: 700.8, assetClass: "INTERNACIONAL", investedValue: undefined, currency: "USD" },
      { ticker: "QQQ", quantity: 0, value: 420.48, assetClass: "INTERNACIONAL", investedValue: undefined, currency: "USD" },
      { ticker: "SHV", quantity: 0, value: 747.52, assetClass: "INTERNACIONAL", investedValue: undefined, currency: "USD" },
    ]);
  });

  it("posição com quantidade, preço e custo (export em inglês)", () => {
    const text = ["Symbol,Description,Quantity,Last Price,Market Value,Cost Basis", 'VOO,Vanguard S&P 500 ETF,3,714.34,"2,143.02",1950.00', "AAPL,Apple Inc,10,271.01,2710.10,2400"].join("\n").replace('"2,143.02"', "2143.02");
    const r = lerCarteiraNoExterior(text);
    expect(r.map((h) => [h.ticker, h.quantity, h.value, h.investedValue])).toEqual([
      ["VOO", 3, 2143.02, 1950],
      ["AAPL", 10, 2710.1, 2400],
    ]);
  });

  it("preço médio por cota vira investido total", () => {
    const text = ["Ativo;Quantidade;Preço médio (US$);Valor atual (US$)", "VOO;2;600,00;1.428,68"].join("\n");
    expect(lerCarteiraNoExterior(text)).toEqual([
      { ticker: "VOO", quantity: 2, value: 1428.68, assetClass: "INTERNACIONAL", investedValue: 1200, currency: "USD" },
    ]);
  });

  it("texto de PDF: só a linha em que quantidade × preço bate com o valor", () => {
    const text = [
      "Avenue Securities LLC - Statement",
      "Account 1234-5678 Period 09/01/2026 - 09/30/2026",
      "VOO VANGUARD S&P 500 ETF 3.0000 714.34 2,143.02",
      "SHV ISHARES SHORT TREASURY 10 110.25 1,102.50",
      "PIX 10 50,00",
      "CASH 1 250.00 250.00",
    ].join("\n");
    expect(lerCarteiraNoExterior(text).map((h) => [h.ticker, h.quantity, h.value])).toEqual([
      ["VOO", 3, 2143.02],
      ["SHV", 10, 1102.5],
    ]);
  });

  it("extrato brasileiro não vira carteira de fora", () => {
    expect(pareceCarteiraNoExterior("Extrato Nubank\nPIX recebido 100,00")).toBe(false);
    expect(lerCarteiraNoExterior("Ticker;Valor\nPETR4;100")).toEqual([]);
    // Extrato daqui que cita dólar (BDR, conta global) continua com o leitor brasileiro.
    expect(lerCarteiraNoExterior("Código;Quantidade;Valor (USD)\nPETR4;100;3.250,00\nAAPL;1;270,00")).toEqual([]);
  });
});
