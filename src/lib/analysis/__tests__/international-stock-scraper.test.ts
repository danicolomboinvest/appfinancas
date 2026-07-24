import { describe, expect, it } from "vitest";
import { buildInvestidor10StockUrl, parseInternationalStockPage } from "../international-stock-scraper";

/** Estrutura real de cada indicador em #table-indicators (confirmada contra a página ao vivo
 * da AAPL em investidor10.com.br/stocks/aapl/ — o site já trocou esse HTML sem aviso antes,
 * incluindo o TEXTO dos rótulos, ex.: "Dividend Yield (DY)" virou só "Dividend Yield"). */
function buildRatioCell(label: string, value: string): string {
  return `
    <article class="indicator-card">
      <div class="indicator-card-title"><span>${label}</span></div>
      <span class="indicator-card-help popover-trigger" data-content="..."></span>
      <div class="indicator-card-value"><span>${value}</span></div>
    </article>
  `;
}

const FIXTURE_HTML = `
<html><body>
  <div id="table-indicators" class="indicator-groups">
    <section class="indicator-group">
      <h3>Valuation</h3>
      <div class="indicator-cards">
        ${buildRatioCell("P/L", "37,54")}
      </div>
    </section>
    <section class="indicator-group">
      <h3>Rentabilidade</h3>
      <div class="indicator-cards">
        ${buildRatioCell("Dividend Yield", "0,33%")}
        ${buildRatioCell("Payout", "12,39%")}
        ${buildRatioCell("Margem Líquida", "27,15%")}
        ${buildRatioCell("ROE", "115,10%")}
        ${buildRatioCell("ROIC", "38,39%")}
      </div>
    </section>
    <section class="indicator-group">
      <h3>Endividamento</h3>
      <div class="indicator-cards">
        ${buildRatioCell("Dívida Líquida/Patrimônio", "0,06")}
        ${buildRatioCell("Dívida Líquida/EBITDA", "0,15")}
      </div>
    </section>
    <section class="indicator-group">
      <h3>Crescimento</h3>
      <div class="indicator-cards">
        ${buildRatioCell("CAGR Receitas 5 anos", "3,60%")}
        ${buildRatioCell("CAGR Lucros 5 anos", "4,04%")}
      </div>
    </section>
  </div>
  <div class="table grid-3" id="table-indicators-company">
    <div class="cell">
      <h3 class="title">Valor de mercado</h3>
      <span class="value"><h4 class="simple-value">$ 4,60 Trilhões</h4></span>
    </div>
    <div class="cell">
      <h3 class="title">Volume Médio de negociações Diária</h3>
      <span class="value"><h4 class="simple-value">$ 56,52 Milhões</h4></span>
    </div>
    <div class="cell" onclick="window.location.href = '/stocks/setores/tecnologia'">
      <h3 class="title">Setor</h3>
      <h4 class="value">Tecnologia</h4>
    </div>
  </div>
</body></html>
`;

describe("buildInvestidor10StockUrl", () => {
  it("lowercases the ticker and builds the stocks URL", () => {
    expect(buildInvestidor10StockUrl("AAPL")).toBe("https://investidor10.com.br/stocks/aapl/");
  });
});

describe("parseInternationalStockPage", () => {
  it("extracts the 10 automatable criteria with their raw displayed values", () => {
    const results = parseInternationalStockPage(FIXTURE_HTML);
    const byKey = Object.fromEntries(results.map((r) => [r.key, r.value]));

    expect(byKey).toEqual({
      dividend_yield: "0,33%",
      payout: "12,39%",
      margem_liquida: "27,15%",
      roe: "115,10%",
      roic: "38,39%",
      divida_liquida_patrimonio: "0,06",
      divida_liquida_ebitda: "0,15",
      evolucao_receita: "3,60%",
      evolucao_lucro: "4,04%",
      liquidez: "$ 56,52 Milhões",
    });
  });

  it("ignores ratio cells that aren't in the target catalog (e.g. P/L)", () => {
    const results = parseInternationalStockPage(FIXTURE_HTML);
    expect(results.find((r) => r.key === "p_l")).toBeUndefined();
    expect(results).toHaveLength(10);
  });

  it("returns an empty array when the expected sections are absent", () => {
    expect(parseInternationalStockPage("<html><body>página inesperada</body></html>")).toEqual([]);
  });
});
