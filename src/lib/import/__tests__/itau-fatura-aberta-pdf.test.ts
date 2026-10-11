import { describe, expect, it } from "vitest";
import { isFaturaSummaryLine } from "../fatura-lines";
import { isItauOpenInvoice, parseItauOpenInvoice } from "../itau-fatura-aberta-pdf";
import { isItauInvoice } from "../itau-fatura-pdf";
import { parseStatementComLeitor } from "../statement-parser";

// Amostra FICTÍCIA da "Fatura Aberta" do Itaú: a coluna de datas inteira, depois a de valores.
const AMOSTRA = [
  "Nome Fulano De Tal",
  "Fatura Aberta - Novembro/2026",
  "Cartão",
  "Personnalite Mastercard - final 0000",
  "Lançamentos",
  "Data Lançamento",
  "01/10/2026 Pagamento Debito Automatico",
  "09/10/2026 Mercado Exemplocuritibabra",
  "06/10/2026 Loja Ficticiasao Paulobra",
  "",
  "-- 1 of 4 --",
  "",
  "06/01/2026 Clinica Exemplo Curitiba Bra",
  "Importante saber",
  "",
  "-- 2 of 4 --",
  "",
  "Valor (",
  "R$",
  "Parcelamento Valor Titularidade",
  "R$ -1.500,00 Titular",
  "R$ 161,00 Titular",
  "Parcela 1 de 3 R$ 39,16 Titular",
  "",
  "-- 3 of 4 --",
  "",
  "Parcela 10 de 12 R$ 1.291,74 Titular",
  "Subtotal R$ 1.491,90",
].join("\n");

describe("fatura aberta do Itaú (datas e valores em colunas separadas)", () => {
  it("casa a n-ésima data com o n-ésimo valor e fecha com o subtotal", () => {
    expect(isItauOpenInvoice(AMOSTRA)).toBe(true);
    const txns = parseItauOpenInvoice(AMOSTRA);
    expect(txns.map((t) => [t.date, t.amount, t.description])).toEqual([
      ["2026-10-01", -1500, "Pagamento Debito Automatico"],
      ["2026-10-09", 161, "Mercado Exemplocuritibabra"],
      ["2026-10-06", 39.16, "Loja Ficticiasao Paulobra Parcela 1/3"],
      ["2026-01-06", 1291.74, "Clinica Exemplo Curitiba Bra Parcela 10/12"],
    ]);
    const compras = txns.filter((t) => !isFaturaSummaryLine(t)).reduce((s, t) => s + t.amount, 0);
    expect(Math.round(compras * 100) / 100).toBe(1491.9);
  });

  it("não chuta quando as colunas não têm o mesmo tamanho", () => {
    expect(parseItauOpenInvoice(AMOSTRA.replace("R$ 161,00 Titular\n", ""))).toEqual([]);
  });

  it("entra pelo leitor próprio, não pelo da fatura fechada", () => {
    expect(isItauInvoice(AMOSTRA)).toBe(false);
    expect(parseStatementComLeitor(AMOSTRA, "pdf").leitor).toBe("itau-fatura-aberta");
  });
});
