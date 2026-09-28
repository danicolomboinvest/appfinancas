import { describe, expect, it } from "vitest";
import { registeredDividendIds } from "../dividend.repo";
import { paysDividendsInReais } from "@/lib/analysis/dividend-scraper";

/**
 * "Caiu na conta": quais proventos já viraram renda. O caso real que motivou: a PETR4 paga JSCP
 * e Dividendos no mesmo dia, e lançar o JSCP escondia os Dividendos (R$ 47 sumiam sem aviso).
 */
const ev = (id: string, ticker: string, kind: string, day: string, amount: number) => ({ id, ticker, kind, day, amount });
const lanc = (description: string, day: string, amount: number) => ({ description, day, amount });

describe("registeredDividendIds", () => {
  it("lançar o JSCP não marca os Dividendos do mesmo ativo no mesmo dia", () => {
    const events = [ev("jscp", "PETR4", "JSCP", "2026-12-21", 17.21), ev("div", "PETR4", "Dividendos", "2026-12-21", 47.16)];
    const done = registeredDividendIds(events, [lanc("Proventos PETR4 (JSCP)", "2026-12-21", 17.21)]);
    expect([...done]).toEqual(["jscp"]);
  });

  it("tipo com espaço e ponto (Rend. Trib.) é reconhecido", () => {
    const done = registeredDividendIds([ev("rt", "BBAS3", "Rend. Trib.", "2026-09-11", 3.5)], [lanc("Proventos BBAS3 (Rend. Trib.)", "2026-09-11", 3.5)]);
    expect(done.has("rt")).toBe(true);
  });

  it("dois JSCP no mesmo dia: um lançamento marca só um, o de valor igual", () => {
    const events = [ev("a", "BBAS3", "JSCP", "2026-09-11", 10), ev("b", "BBAS3", "JSCP", "2026-09-11", 25)];
    const done = registeredDividendIds(events, [lanc("Proventos BBAS3 (JSCP)", "2026-09-11", 25)]);
    expect([...done]).toEqual(["b"]);
  });

  it("valor que não bate (quantidade mudou depois de lançar) ainda marca o provento", () => {
    const done = registeredDividendIds([ev("a", "MXRF11", "Rendimento", "2026-09-15", 12)], [lanc("Proventos MXRF11 (Rendimento)", "2026-09-15", 10)]);
    expect(done.has("a")).toBe(true);
  });

  it("lançamento digitado à mão fora do formato não esconde a sugestão", () => {
    const done = registeredDividendIds([ev("a", "PETR4", "JSCP", "2026-12-21", 17.21)], [lanc("Proventos PETR4 dezembro", "2026-12-21", 17.21)]);
    expect(done.size).toBe(0);
  });

  it("outro dia não conta", () => {
    const done = registeredDividendIds([ev("a", "PETR4", "JSCP", "2026-12-21", 17.21)], [lanc("Proventos PETR4 (JSCP)", "2026-08-21", 17.21)]);
    expect(done.size).toBe(0);
  });
});

describe("paysDividendsInReais", () => {
  it("B3 e BDR pagam em real", () => {
    expect(paysDividendsInReais("PETR4")).toBe(true);
    expect(paysDividendsInReais("MXRF11")).toBe(true);
    expect(paysDividendsInReais("aapl34")).toBe(true);
  });

  it("ação e ETF de fora (valor em dólar no investidor10) ficam de fora", () => {
    expect(paysDividendsInReais("AAPL")).toBe(false);
    expect(paysDividendsInReais("VOO")).toBe(false);
  });
});
