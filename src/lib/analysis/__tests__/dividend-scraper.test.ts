import { describe, expect, it } from "vitest";
import { parseDividendHistory, looksLikeMarketTicker } from "../dividend-scraper";

/** Trecho reduzido, mas com a estrutura EXATA confirmada na página real do investidor10
 * (id, classes, ordem de colunas) — ver comentário no dividend-scraper.ts. */
function tableHtml(rows: string): string {
  return `<html><body>
    <table id="table-dividends-history" class="table table-balance table-dividends-history">
      <thead>
        <tr><th><h3>tipo</h3></th><th><h3>data com</h3></th><th><h3>pagamento</h3></th><th><h3>valor</h3></th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </body></html>`;
}

const ROW = (kind: string, exDate: string, paymentDate: string, value: string) =>
  `<tr class="visible-even"><td class="text-center">${kind}</td><td class="text-center">${exDate}</td><td class="text-center">${paymentDate}</td><td class="text-center"> ${value}\n</td></tr>`;

describe("parseDividendHistory", () => {
  it("extrai tipo, data com, pagamento e valor (formato real do investidor10)", () => {
    const html = tableHtml(ROW("JSCP", "21/08/2026", "21/12/2026", "0,20250435"));
    const rows = parseDividendHistory(html);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("JSCP");
    expect(rows[0].valuePerShare).toBeCloseTo(0.20250435, 8);
    expect(rows[0].exDate.toISOString().slice(0, 10)).toBe("2026-08-21");
    expect(rows[0].paymentDate.toISOString().slice(0, 10)).toBe("2026-12-21");
  });

  it("lê várias linhas (tipos diferentes na mesma tabela)", () => {
    const html = tableHtml(
      ROW("JSCP", "21/08/2026", "21/12/2026", "0,20250435") +
        ROW("Dividendos", "21/08/2026", "21/12/2026", "0,47156696") +
        ROW("Rend. Trib.", "22/04/2026", "22/06/2026", "0,02038398"),
    );
    const rows = parseDividendHistory(html);
    expect(rows.map((r) => r.kind)).toEqual(["JSCP", "Dividendos", "Rend. Trib."]);
  });

  it("página sem a tabela (ETF que reinveste, ex.: BOVA11) devolve lista vazia, não erro", () => {
    expect(parseDividendHistory("<html><body>sem tabela de proventos aqui</body></html>")).toEqual([]);
  });

  it("linha com célula vazia ou valor zerado/inválido é descartada, não quebra o parser", () => {
    const html = tableHtml(
      ROW("JSCP", "21/08/2026", "21/12/2026", "0,50") + ROW("Dividendos", "data inválida", "21/12/2026", "0,10"),
    );
    const rows = parseDividendHistory(html);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("JSCP");
  });
});

describe("looksLikeMarketTicker", () => {
  it("aceita tickers B3 (4 letras + 1-2 dígitos)", () => {
    expect(looksLikeMarketTicker("PETR4")).toBe(true);
    expect(looksLikeMarketTicker("MXRF11")).toBe(true);
    expect(looksLikeMarketTicker("bova11")).toBe(true); // case-insensitive
  });

  it("aceita tickers internacionais (letras, sem dígito)", () => {
    expect(looksLikeMarketTicker("AAPL")).toBe(true);
    expect(looksLikeMarketTicker("SCHD")).toBe(true);
    expect(looksLikeMarketTicker("VOO")).toBe(true);
  });

  it("rejeita nomes descritivos de renda fixa (não são ticker de bolsa)", () => {
    expect(looksLikeMarketTicker("CDB Banco Inter 2027")).toBe(false);
    expect(looksLikeMarketTicker("Tesouro IPCA+ 2035")).toBe(false);
    expect(looksLikeMarketTicker("")).toBe(false);
  });
});
