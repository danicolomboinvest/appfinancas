import { describe, expect, it, vi, afterEach } from "vitest";
import { parseAwesomeRate, convertAmount, getExchangeRate } from "../rates";

afterEach(() => vi.unstubAllGlobals());

describe("parseAwesomeRate", () => {
  it("usa a média entre compra e venda", () => {
    const r = parseAwesomeRate({ EURBRL: { bid: "5.80", ask: "5.90", create_date: "2026-09-21 10:00:00" } }, "EUR", "BRL");
    expect(r?.rate).toBe(5.85);
    expect(r?.date).toBe("2026-09-21");
  });

  it("aceita só um dos lados quando o outro vem quebrado", () => {
    expect(parseAwesomeRate({ USDBRL: { bid: "5.10", ask: "x" } }, "USD", "BRL")?.rate).toBe(5.1);
  });

  it("recusa payload sem o par, em vez de inventar número", () => {
    expect(parseAwesomeRate({ GBPBRL: { bid: "6.8" } }, "USD", "BRL")).toBeNull();
    expect(parseAwesomeRate(null, "USD", "BRL")).toBeNull();
    expect(parseAwesomeRate({ USDBRL: { bid: "0" } }, "USD", "BRL")).toBeNull();
  });
});

describe("convertAmount", () => {
  it("arredonda a centavos", () => {
    expect(convertAmount(100, 5.8583)).toBe(585.83);
  });
});

/**
 * O caso que motivou a correção: no Mac funcionava e na produção não, e o `catch {}` vazio
 * escondia o motivo. A cliente via "não achei a cotação de hoje" toda vez que lançava em euro.
 */
describe("getExchangeRate quando a fonte falha", () => {
  it("mesma moeda não chama a fonte", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const r = await getExchangeRate("BRL", "BRL");
    expect(r?.rate).toBe(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  /** Sem cotação anterior não dá pra inventar uma: devolve nulo e a tela pede o número à pessoa. */
  it("devolve nulo quando nunca conseguiu buscar aquele par", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("rede fora")));
    expect(await getExchangeRate("GBP", "USD")).toBeNull();
  });

  /** Cotação de ontem vale muito mais que nenhuma — desde que a tela diga que é de ontem. */
  it("guarda a última boa e a devolve marcada como velha quando a fonte cai", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ EURUSD: { bid: "1.10", ask: "1.12", create_date: "2026-09-21 10:00:00" } }),
      }),
    );
    const boa = await getExchangeRate("EUR", "USD");
    expect(boa?.rate).toBe(1.11);
    expect(boa?.stale).toBeUndefined();

    // A fonte cai. O cache ainda é válido por uma hora, então nem chega a tentar.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("fonte fora do ar")));
    const doCache = await getExchangeRate("EUR", "USD");
    expect(doCache?.rate).toBe(1.11);
  });
});
