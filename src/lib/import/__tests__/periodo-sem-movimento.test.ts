import { describe, expect, it } from "vitest";
import { periodoSemMovimento } from "../detect";
import { parseStatementComLeitor } from "../statement-parser";

describe("período sem movimento", () => {
  it("Banco do Brasil: 'Sem lançamentos no período' é mês parado, não formato desconhecido", () => {
    // Layout do extrato do BB sem movimento; valores inventados.
    const texto = [
      "Extrato de Conta Corrente",
      "Sem lançamentos no período",
      "10,00 (-)\tSaldo Aprovisionado no Dia",
      "0,00\tJuros *",
      "0,00\tIOF *",
      "1.000,00 (+)\tCREDITO BB-MELHOR OFERTA*",
      "10,00 (-)\t14/10/2026 Tarifas Pendentes",
    ].join("\n");
    expect(parseStatementComLeitor(texto, "pdf").txns).toEqual([]);
    expect(periodoSemMovimento(texto)).toBe(true);
  });
});
