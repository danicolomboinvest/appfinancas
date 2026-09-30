import { describe, expect, it } from "vitest";
import { conferirLeitura } from "../conferencia";
import { isFaturaSummaryLine } from "../fatura-lines";
import { isSantanderInvoice, parseSantanderInvoice } from "../santander-fatura-pdf";
import { parseStatement } from "../statement-parser";

/**
 * Fatura FICTÍCIA com a mesma estrutura do PDF do cartão Santander: fechamento "realizados até",
 * vencimento, e no detalhamento a compra SEM sinal e o crédito (pagamento, estorno) COM menos, o
 * número da categoria antes da data e a parcela numa coluna própria.
 */
const SANTANDER = (ate: string, vencimento: string) =>
  [
    "BANCO SANTANDER (BRASIL) S.A.",
    "Olá, Pessoa! Esta é a fatura do seu cartão FREE",
    "MASTERCARD contendo compras e pagamentos realizados",
    `até ${ate}.`,
    "Total a Pagar",
    "R$ 150,00",
    "Vencimento",
    vencimento,
    "Detalhamento da Fatura",
    "PESSOA EXEMPLO - 0000 XXXX XXXX 0000",
    "Pagamento e Demais Créditos",
    "Compra Data Descrição \tParcela \tR$ \tUS$",
    "23/08 PAGAMENTO DE FATURA-INTERNET \t-300,00",
    "31/08 LOJA ESTORNADA \t-50,00",
    "Parcelamentos",
    "Compra Data Descrição \tParcela \tR$ \tUS$",
    "1 \t31/12 LOJA PARCELADA \t09/10 \t40,00",
    "Despesas",
    "Compra Data Descrição \tParcela \tR$ \tUS$",
    "3 \t19/08 FARMACIA EXEMPLO \t60,00",
    "29/08 LOJA ESTORNADA \t100,00",
    "VALOR TOTAL \t150,00 \t0,00",
    "Resumo da Fatura",
    "Saldo Anterior \t300,00",
    "(+) Total Despesas/Débitos no Brasil \t200,00",
    "(-) Total de pagamentos \t300,00",
    "(-) Total de créditos \t50,00",
    "(=) Saldo Desta Fatura \t150,00",
  ].join("\n");

describe("fatura do cartão Santander (PDF)", () => {
  it("reconhece o arquivo", () => {
    expect(isSantanderInvoice(SANTANDER("21/09", "26/09/2026"))).toBe(true);
    expect(isSantanderInvoice("Extrato de Conta Corrente\n01/01/2026 PIX 10,00")).toBe(false);
  });

  it("compra positiva, estorno e pagamento negativos, parcela antiga no ano anterior", () => {
    expect(parseSantanderInvoice(SANTANDER("21/09", "26/09/2026"))).toEqual([
      { date: "2026-08-23", description: "PAGAMENTO DE FATURA-INTERNET", amount: -300 },
      { date: "2026-08-31", description: "LOJA ESTORNADA", amount: -50 },
      { date: "2025-12-31", description: "LOJA PARCELADA 09/10", amount: 40 },
      { date: "2026-08-19", description: "FARMACIA EXEMPLO", amount: 60 },
      { date: "2026-08-29", description: "LOJA ESTORNADA", amount: 100 },
    ]);
  });

  it("fatura que fecha em dezembro e vence em janeiro fica no ano do fechamento", () => {
    const [, , parcela] = parseSantanderInvoice(SANTANDER("26/12", "05/01/2027"));
    expect(parcela.date).toBe("2026-12-31");
  });

  it("sem o pagamento, fecha com o total da fatura", () => {
    const linhas = parseStatement(SANTANDER("21/09", "26/09/2026"), "pdf").filter((t) => !isFaturaSummaryLine(t));
    expect(conferirLeitura(SANTANDER("21/09", "26/09/2026"), "fatura", linhas)).toMatchObject({ status: "fechou" });
  });
});
