import { describe, expect, it } from "vitest";
import { buildInvestidor10EtfUrl, parseEtfPage } from "../etf-scraper";

function buildCard(title: string, value: string): string {
  return `
    <div class="_card">
      <div class="_card-header"><div><span title="${title}">${title}</span></div></div>
      <div class="_card-body"><div><span>${value}</span></div></div>
    </div>
  `;
}

const FIXTURE_HTML = `
<html><body>
  <section id="cards-ticker" class="br">
    ${buildCard("Cotação", "R$ 436,29")}
    ${buildCard("Capitalização", "R$ 6,34 B")}
    ${buildCard("Variação (12M)", "12,15%")}
    ${buildCard("VARIAÇÃO (60M)", "76,99%")}
    ${buildCard("DY", "0,00%")}
  </section>
</body></html>
`;

describe("buildInvestidor10EtfUrl", () => {
  it("lowercases the ticker and builds the etfs URL", () => {
    expect(buildInvestidor10EtfUrl("IVVB11")).toBe("https://investidor10.com.br/etfs/ivvb11/");
  });

  it("works the same for a US-domiciled ticker (server redirects to etfs-global)", () => {
    expect(buildInvestidor10EtfUrl("VOO")).toBe("https://investidor10.com.br/etfs/voo/");
  });
});

describe("parseEtfPage", () => {
  it("extracts the 4 automatable criteria from the cards-ticker section", () => {
    const results = parseEtfPage(FIXTURE_HTML);
    const byKey = Object.fromEntries(results.map((r) => [r.key, r.value]));

    expect(byKey).toEqual({
      patrimonio_liquido_etf: "R$ 6,34 B",
      dividend_yield_etf: "0,00%",
      rentabilidade_12m: "12,15%",
      rentabilidade_5anos: "76,99%",
    });
  });

  it("ignores the Cotação card (not a criterion)", () => {
    const results = parseEtfPage(FIXTURE_HTML);
    expect(results.find((r) => r.key === "cotacao")).toBeUndefined();
    expect(results).toHaveLength(4);
  });

  it("returns an empty array when the expected section is absent", () => {
    expect(parseEtfPage("<html><body>página inesperada</body></html>")).toEqual([]);
  });
});
