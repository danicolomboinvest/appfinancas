import { describe, expect, it } from "vitest";
import { staleUpcomingDividendIds } from "../dividend.repo";

/**
 * O investidor10 corrigiu o JSCP de 0,2025 pra 0,2030: a linha corrigida entrava como nova e a
 * antiga ficava, e o provento aparecia duas vezes nos "Próximos" e no Dashboard.
 */
const hoje = new Date("2026-09-28T00:00:00Z");
// Como o banco devolve (@db.Date, meia-noite UTC).
const salvo = (id: string, kind: string, ex: string, pag: string, valor: number) => ({
  id,
  kind,
  exDate: new Date(`${ex}T00:00:00Z`),
  paymentDate: new Date(`${pag}T00:00:00Z`),
  valuePerShare: valor,
});
// Como o scraper monta (meio-dia local).
const raspado = (kind: string, ex: string, pag: string, valor: number) => ({
  kind,
  exDate: new Date(`${ex}T12:00:00`),
  paymentDate: new Date(`${pag}T12:00:00`),
  valuePerShare: valor,
});

describe("staleUpcomingDividendIds", () => {
  it("valor corrigido: a linha antiga a pagar sai", () => {
    const existentes = [salvo("velho", "JSCP", "2026-09-10", "2026-12-21", 0.2025)];
    expect(staleUpcomingDividendIds(existentes, [raspado("JSCP", "2026-09-10", "2026-12-21", 0.203)], hoje)).toEqual(["velho"]);
  });

  it("data de pagamento remarcada: a antiga sai", () => {
    const existentes = [salvo("velho", "Dividendos", "2026-09-10", "2026-10-15", 0.5)];
    expect(staleUpcomingDividendIds(existentes, [raspado("Dividendos", "2026-09-10", "2026-10-20", 0.5)], hoje)).toEqual(["velho"]);
  });

  it("a mesma linha raspada de novo fica", () => {
    const existentes = [salvo("igual", "JSCP", "2026-09-10", "2026-12-21", 0.20250435)];
    expect(staleUpcomingDividendIds(existentes, [raspado("JSCP", "2026-09-10", "2026-12-21", 0.20250435)], hoje)).toEqual([]);
  });

  it("o que já foi pago nunca é apagado, mesmo que não venha mais na página", () => {
    const existentes = [salvo("pago", "Dividendos", "2026-08-01", "2026-08-20", 0.5), salvo("ontem", "JSCP", "2026-09-01", "2026-09-27", 0.1)];
    expect(staleUpcomingDividendIds(existentes, [raspado("JSCP", "2026-09-10", "2026-12-21", 0.2)], hoje)).toEqual([]);
  });

  it("o que paga hoje conta como a pagar", () => {
    const existentes = [salvo("hoje", "Dividendos", "2026-09-15", "2026-09-28", 0.5)];
    expect(staleUpcomingDividendIds(existentes, [raspado("Dividendos", "2026-09-15", "2026-09-28", 0.51)], hoje)).toEqual(["hoje"]);
  });
});
