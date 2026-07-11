import { describe, expect, it } from "vitest";
import { buildInvestidor10StockUrl, parseInternationalStockPage } from "../international-stock-scraper";

function buildRatioCell(label: string, value: string): string {
  return `
    <div class="cell" style="padding: 15px 0px 20px 15px;">
      <h3 class="d-flex justify-content-between align-items-center">${label}
        <i class="far fa-question-circle popover-trigger"></i></h3>
      <div class="value d-flex justify-content-between align-items-center"><span>${value}</span></div>
    </div>
  `;
}

const FIXTURE_HTML = `
<html><body>
  <div id="table-indicators" class="table table-bordered outter-borderless four_columns">
    ${buildRatioCell("P/L", "37,54")}
    ${buildRatioCell("Dividend Yield (DY)", "0,33%")}
    ${buildRatioCell("Payout", "12,39%")}
    ${buildRatioCell("Margem Líquida", "27,15%")}
    ${buildRatioCell("ROE", "115,10%")}
    ${buildRatioCell("ROIC", "38,39%")}
    ${buildRatioCell("Dívida Líquida / Patrimônio", "0,06")}
    ${buildRatioCell("Dívida Líquida / EBITDA", "0,15")}
    ${buildRatioCell("CAGR Receitas 5 Anos", "3,60%")}
    ${buildRatioCell("CAGR Lucros 5 Anos", "4,04%")}
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
