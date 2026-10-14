import { describe, expect, it } from "vitest";
import { resumirProventos } from "@/lib/portfolio/proventos";
import { colunasDoDetalhe, linkDaAnalise, rotulosDasPontas } from "../colunas-de-proventos";

describe("proventos no detalhe do ativo", () => {
  // ITSA4 pagou em dez/2025, mar e jun/2026; hoje é 14/10/2026.
  const hoje = new Date(Date.UTC(2026, 9, 14));
  const ev = (iso: string) => ({ ticker: "ITSA4", kind: "Dividendos", paymentDate: new Date(`${iso}T00:00:00Z`), valuePerShare: 0.028 });
  const r = resumirProventos([ev("2025-12-30"), ev("2026-03-31"), ev("2026-06-30")], [{ ticker: "ITSA4", quantidade: 400, investido: 4080 }], hoje);

  it("as colunas vão de dezembro a outubro e somam o total dos 12 meses", () => {
    const colunas = colunasDoDetalhe(r.meses);
    expect(colunas).toHaveLength(11);
    expect(colunas[0]).toBeCloseTo(11.2); // dezembro, que antes sumia
    expect(colunas[3]).toBeCloseTo(11.2); // março
    expect(colunas[6]).toBeCloseTo(11.2); // junho
    expect(colunas.reduce((s, v) => s + v, 0)).toBeCloseTo(r.dozeMeses);
  });

  it("os rótulos são o primeiro mês e o mês de hoje", () => {
    expect(rotulosDasPontas(new Date(2026, 9, 14))).toEqual(["dez", "out"]);
    expect(rotulosDasPontas(new Date(2026, 0, 5))).toEqual(["mar", "jan"]);
  });
});

describe("Ver análise", () => {
  it("abre a análise do próprio ativo", () => {
    expect(linkDaAnalise("itsa4")).toBe("/fichas/ativo/ITSA4");
    expect(linkDaAnalise("VOO")).toBe("/fichas/ativo/VOO");
    expect(linkDaAnalise("BRK.B")).toBe("/fichas");
  });
});
