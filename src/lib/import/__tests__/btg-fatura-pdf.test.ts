import { describe, expect, it } from "vitest";
import { isBtgInvoice, parseBtgInvoice } from "../btg-fatura-pdf";
import { conferirLeitura } from "../conferencia";
import { isFaturaSummaryLine } from "../fatura-lines";
import { parseStatementComLeitor } from "../statement-parser";

/** Fatura BTG/EQI fictícia, no layout do PDF real (texto como sai da extração, com TAB). */
const BTG = [
  "Olá, Fulana! Esta é a fatura do seu cartão EQI de",
  "Junho no valor a pagar de R$ 1.103,44",
  "Fulana Exemplo | fatura de Junho de 2026 | cartão final 0000",
  "Mensalidade R$ 160,00",
  "Desconto -R$ 160,00",
  "Resumo da Fatura Atual",
  "Total de compras e despesas R$ 1.153,44",
  "Total de créditos recebidos -R$ 50,00",
  "Total da fatura anterior R$ 900,00",
  "Total de pagamentos feitos pelo cliente -R$ 900,00",
  "Total a pagar R$ 1.103,44",
  "BTG Pactual S.A",
  "-- 1 of 3 --",
  "Pagamentos feitos pelo cliente",
  "- R$ 900,00\tPagamento de fatura\t18 Mai",
  "-R$ 900,00",
  "Lançamentos do cartão físico | Fulana Exemplo | Final 0000 Total do cartão: R$ 550,00",
  "Total de créditos recebidos",
  "- R$ 30,00\tCashback Exemplo\t16 Mai - R$ 20,00\tCancelamento - Loja\t08 Jun",
  "-R$ 50,00",
  "Total de compras e despesas",
  "R$ 500,00\tHospital Exemplo (4/5)\t27 Fev",
  "R$ 100,00\tMercado Exemplo\t13 Mai",
  "R$ 600,00",
  "Lançamentos do cartão virtual | Fulana Exemplo | Final 1111 Total do cartão: R$ 553,44",
  "Total de compras e despesas",
  "R$ 89,00\tAssinatura Exemplo (12/12)\t10 Jul",
  "US$ 36,00\tServiço Exemplo\t15 Mai",
  "Cotação da moeda -",
  "Conversão para Real -",
  "R$ 5,27",
  "R$ 190,07",
  "EUR 28,98\tUber\t14 Jun",
  "Cotação da moeda -",
  "Conversão para Real -",
  "R$ 6,37",
  "R$ 184,70",
  "R$ 89,67\tLoja Exemplo\t01 Jun",
  "R$ 553,44",
  "BTG Pactual S.A",
].join("\n");

describe("fatura do cartão BTG Pactual / EQI (PDF)", () => {
  it("reconhece o arquivo", () => {
    expect(isBtgInvoice(BTG)).toBe(true);
    expect(isBtgInvoice("BTG Pactual\nExtrato de conta corrente\n01/06 PIX 10,00")).toBe(false);
  });

  it("lê valor-nome-data, créditos na mesma linha, moeda estrangeira pelo valor em real, e deixa de fora pagamento e subtotais", () => {
    expect(parseBtgInvoice(BTG, 2026)).toEqual([
      { date: "2026-05-16", description: "Cashback Exemplo", amount: -30 },
      { date: "2026-06-08", description: "Cancelamento - Loja", amount: -20 },
      { date: "2026-02-27", description: "Hospital Exemplo (4/5)", amount: 500 },
      { date: "2026-05-13", description: "Mercado Exemplo", amount: 100 },
      { date: "2025-07-10", description: "Assinatura Exemplo (12/12)", amount: 89 },
      { date: "2026-05-15", description: "Serviço Exemplo", amount: 190.07 },
      { date: "2026-06-14", description: "Uber", amount: 184.7 },
      { date: "2026-06-01", description: "Loja Exemplo", amount: 89.67 },
    ]);
  });

  it("é o leitor usado pro PDF, e fecha com o total da fatura", () => {
    const { txns, leitor } = parseStatementComLeitor(BTG, "pdf", 2026);
    expect(leitor).toBe("btg-fatura");
    const linhas = txns.filter((t) => !isFaturaSummaryLine(t));
    expect(conferirLeitura(BTG, "fatura", linhas)).toMatchObject({ status: "fechou" });
  });
});
