import { describe, expect, it } from "vitest";
import { buildInvestidor10Url, parseStockPage } from "../stock-scraper";

const FIXTURE_HTML = `
<html><body>
  <div class="table grid-3" id="table-indicators-company">
    <div class="cell">
      <span class="title">Free Float</span>
      <span class="value">60,70%<i class="far fa-question-circle popover-trigger"></i></span>
    </div>
    <div class="cell">
      <span class="title">Tag Along</span>
      <span class="value"> 100,00%<i class="far fa-question-circle popover-trigger"></i></span>
    </div>
    <div class="cell">
      <span class="title">Liquidez Média Diária</span>
      <span class="value">
        <div class="simple-value">R$ 1,36 Bilhão</div>
        <div class="detail-value">R$ 1.363.718.000</div>
      </span>
    </div>
    <div class="cell">
      <span class="title">Segmento de Listagem</span>
      <span class="value">Nível 2</span>
    </div>
  </div>

  <div id="table-indicators" class="table table-bordered outter-borderless">
    <div class="cell">
      <span class="d-flex">Dividend Yield <i class="far fa-question-circle popover-trigger"></i></span>
      <div class="value"><span>7,42%</span></div>
    </div>
    <div class="cell">
      <span class="d-flex">Payout <i class="far fa-question-circle popover-trigger"></i></span>
      <div class="value"><span>38,46%</span></div>
    </div>
    <div class="cell">
      <span class="d-flex">Margem Líquida <i class="far fa-question-circle popover-trigger"></i></span>
      <div class="value"><span>21,60%</span></div>
    </div>
    <div class="cell">
      <span class="d-flex">ROE <i class="far fa-question-circle popover-trigger"></i></span>
      <div class="value"><span>24,17%</span></div>
    </div>
    <div class="cell">
      <span class="d-flex">ROIC <i class="far fa-question-circle popover-trigger"></i></span>
      <div class="value"><span>12,95%</span></div>
    </div>
    <div class="cell">
      <span class="d-flex">Dívida Líquida / Patrimônio <i class="far fa-question-circle popover-trigger"></i></span>
      <div class="value"><span>0,73</span></div>
    </div>
    <div class="cell">
      <span class="d-flex">Dívida Líquida / Ebitda <i class="far fa-question-circle popover-trigger"></i></span>
      <div class="value"><span>1,40</span></div>
    </div>
    <div class="cell">
      <span class="d-flex">CAGR Receitas 5 anos <i class="far fa-question-circle popover-trigger"></i></span>
      <div class="value"><span>12,83%</span></div>
    </div>
    <div class="cell">
      <span class="d-flex">CAGR Lucros 5 anos <i class="far fa-question-circle popover-trigger"></i></span>
      <div class="value"><span>77,66%</span></div>
    </div>
    <div class="cell">
      <span class="d-flex">P/L <i class="far fa-question-circle popover-trigger"></i></span>
      <div class="value"><span>4,75</span></div>
    </div>
  </div>
</body></html>
`;

describe("buildInvestidor10Url", () => {
  it("lowercases the ticker and builds the acoes URL", () => {
    expect(buildInvestidor10Url("PETR4")).toBe("https://investidor10.com.br/acoes/petr4/");
  });

  it("trims surrounding whitespace", () => {
    expect(buildInvestidor10Url("  petr4  ")).toBe("https://investidor10.com.br/acoes/petr4/");
  });
});

describe("parseStockPage", () => {
  it("extracts all 12 automatable criteria with their raw displayed values", () => {
    const results = parseStockPage(FIXTURE_HTML);
    const byKey = Object.fromEntries(results.map((r) => [r.key, r.value]));

    expect(byKey).toEqual({
      free_float: "60,70%",
      tag_along: "100,00%",
      liquidez: "R$ 1,36 Bilhão",
      dividend_yield: "7,42%",
      payout: "38,46%",
      margem_liquida: "21,60%",
      roe: "24,17%",
      roic: "12,95%",
      divida_liquida_patrimonio: "0,73",
      divida_liquida_ebitda: "1,40",
      evolucao_receita: "12,83%",
      evolucao_lucro: "77,66%",
    });
  });

  it("ignores ratio cells that aren't in the target catalog (e.g. P/L)", () => {
    const results = parseStockPage(FIXTURE_HTML);
    expect(results.find((r) => r.key === "p_l")).toBeUndefined();
    expect(results).toHaveLength(12);
  });

  it("returns an empty array when the expected sections are absent", () => {
    expect(parseStockPage("<html><body>página inesperada</body></html>")).toEqual([]);
  });
});
