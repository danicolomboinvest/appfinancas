import { describe, expect, it } from "vitest";
import { conferirLeitura } from "../conferencia";
import { isFaturaSummaryLine } from "../fatura-lines";
import { isNubankInvoice, parseNubankInvoice } from "../nubank-fatura-pdf";
import { parseStatement } from "../statement-parser";

/**
 * Fatura FICTÍCIA com a mesma estrutura do PDF do cartão Nubank: compra com o valor na linha,
 * compra em dólar com o valor em reais três linhas abaixo, estorno com o menos tipográfico,
 * pagamento da fatura anterior, Pix no crédito parcelado (valor na linha depois do "Total a
 * pagar: ...") e saldo restante zerado.
 */
const NUBANK = [
  "Olá, Pessoa.",
  "Nu Pagamentos S.A.",
  "FATURA 14 SET 2026 EMISSÃO E ENVIO 07 SET 2026",
  "RESUMO DA FATURA ATUAL",
  "Fatura anterior R$ 500,00",
  "Pagamento recebido −R$ 500,00",
  "Total de compras de todos os cartões, 07 AGO a 07 SET R$ 300,00",
  "Outros lançamentos R$ 58,94",
  "Total a pagar R$ 358,94",
  "FATURA 14 SET 2026 EMISSÃO E ENVIO 07 SET 2026",
  "TRANSAÇÕES DE 07 AGO A 07 SET",
  "Pessoa Exemplo R$ 300,00",
  "07 AGO •••• 0000 Loja Exemplo - Parcela 4/4 R$ 50,00",
  "27 AGO 99Food - NuPay R$ 30,00",
  "04 SET Estorno de iFood - NuPay −R$ 10,00",
  "13 AGO •••• 0000 Servico Exterior",
  "USD 42.00",
  "Conversão: USD 1 = R$ 5,31",
  "R$ 223,02",
  "13 AGO IOF de \"Servico Exterior\" R$ 6,98",
  "5 de 6",
  "-- 5 of 6 --",
  "Pagamentos e Financiamentos -R$ 441,06",
  "11 AGO Pagamento em 11 AGO −R$ 500,00",
  "07 AGO Pessoa Recebedora - Parcela 5/5",
  "Total a pagar: R$ 294,70 (valor da transação de R$ 250,00 + R$ 2,72 de IOF +",
  "R$ 41,98 de juros) divididos em 5 parcelas de R$ 58,94.",
  "R$ 58,94",
  "14 AGO Saldo restante da fatura anterior R$ 0,00",
  "Em cumprimento à regulação do Banco Central, as suas operações de crédito...",
  "R$ 999,99",
].join("\n");

describe("fatura do cartão Nubank (PDF)", () => {
  it("reconhece o arquivo", () => {
    expect(isNubankInvoice(NUBANK)).toBe(true);
    expect(isNubankInvoice("Extrato de Conta Corrente\n01/01/2026 PIX 10,00")).toBe(false);
  });

  it("pega o valor em reais da compra em dólar e a parcela do Pix no crédito", () => {
    expect(parseNubankInvoice(NUBANK)).toEqual([
      { date: "2026-08-07", description: "Loja Exemplo - Parcela 4/4", amount: 50 },
      { date: "2026-08-27", description: "99Food - NuPay", amount: 30 },
      { date: "2026-09-04", description: "Estorno de iFood - NuPay", amount: -10 },
      { date: "2026-08-13", description: "Servico Exterior", amount: 223.02 },
      { date: "2026-08-13", description: 'IOF de "Servico Exterior"', amount: 6.98 },
      { date: "2026-08-11", description: "Pagamento em 11 AGO", amount: -500 },
      { date: "2026-08-07", description: "Pessoa Recebedora - Parcela 5/5", amount: 58.94 },
    ]);
  });

  it("sem o pagamento, fecha com o total a pagar", () => {
    const linhas = parseStatement(NUBANK, "pdf").filter((t) => !isFaturaSummaryLine(t));
    expect(linhas.some((t) => t.description.startsWith("Pagamento em"))).toBe(false);
    expect(conferirLeitura(NUBANK, "fatura", linhas)).toMatchObject({ status: "fechou", esperado: 358.94 });
  });
});
