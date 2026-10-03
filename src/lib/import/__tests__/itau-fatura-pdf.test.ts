import { describe, expect, it } from "vitest";
import { conferirLeitura } from "../conferencia";
import { isFaturaSummaryLine } from "../fatura-lines";
import { isItauInvoice, parseItauInvoice } from "../itau-fatura-pdf";
import { parseStatement } from "../statement-parser";

/**
 * Fatura FICTÍCIA com a mesma estrutura do PDF do cartão Itaú: boleto e resumo no topo (com o
 * pagamento anterior numa linha com data completa), pagamento, compras com a linha de categoria
 * embaixo, compra no exterior com a moeda de origem na linha de baixo, repasse de IOF sem data,
 * anuidade, o total e, DEPOIS dele, o quadro das parcelas das próximas faturas.
 */
const ITAU = [
  "Banco Itaú S.A.",
  "Resumo da fatura em R$",
  "Total da fatura anterior 1.000,00",
  "Pagamento efetuado em 04/09/2026 -1.000,00",
  "Lançamentos atuais 340,77",
  "Total desta fatura 340,77",
  "O total da sua fatura é:",
  "R$ 340,77",
  "Emissão: 26/09/2026",
  "-- 1 of 3 --",
  "Pagamentos efetuados",
  "DATA VALOR EM R$",
  "04/09 Pagamento via conta -1.000,00",
  "Total dos pagamentos -1.000,00",
  "Lançamentos: compras e saques",
  "PESSOA EXEMPLO",
  "DATA ESTABELECIMENTO VALOR EM R$",
  "09/12 LOJA ANTIGA 10/10 50,00",
  "outros SAO PAULO",
  "15/09 MERCADO EXEMPLO 120,00",
  "supermercado BELO HORIZONT",
  "16/09 LOJA ESTORNO -20,00",
  "outros SAO PAULO",
  "Lançamentos no cartão 150,00",
  "Lançamentos internacionais",
  "PESSOA EXEMPLO",
  "DATA ESTABELECIMENTO US$ R$",
  "29/08 FARMACIA EXEMPLO 100,00",
  "200,00 BOB 18,00",
  "Dólar de Conversão R$ 5,50",
  "Total transações inter. em R$ 100,00",
  "Repasse de IOF em R$ 3,50",
  "Total lançamentos inter. em R$ 103,50",
  "Lançamentos: produtos e serviços",
  "DATA PRODUTOS/SERVIÇOS VALOR EM R$",
  "26/08 Anuidade Diferenciada 87,27",
  "Lançamentos produtos e serviços 87,27",
  "Total dos lançamentos atuais 340,77",
  "Compras parceladas - próximas faturas",
  "DATA ESTABELECIMENTO VALOR EM R$",
  "15/09 MERCADO EXEMPLO 02/02 60,00",
  "01/09 LOJA PARCELADA 02/03 99,90",
  "Próxima fatura 159,90",
].join("\n");

describe("fatura do cartão Itaú (PDF)", () => {
  it("reconhece o arquivo, e não confunde com extrato", () => {
    expect(isItauInvoice(ITAU)).toBe(true);
    expect(isItauInvoice("Itaú\nExtrato de Conta Corrente\n01/09/2026 PIX 10,00")).toBe(false);
  });

  it("lê compras, estorno, exterior, IOF e anuidade — e para antes das próximas faturas", () => {
    expect(parseItauInvoice(ITAU, 2026)).toEqual([
      { date: "2026-09-04", description: "Pagamento via conta", amount: -1000 },
      { date: "2025-12-09", description: "LOJA ANTIGA 10/10", amount: 50, categoriaDoBanco: "outros" },
      { date: "2026-09-15", description: "MERCADO EXEMPLO", amount: 120, categoriaDoBanco: "supermercado" },
      { date: "2026-09-16", description: "LOJA ESTORNO", amount: -20, categoriaDoBanco: "outros" },
      { date: "2026-08-29", description: "FARMACIA EXEMPLO", amount: 100 },
      { date: "2026-09-26", description: "Repasse de IOF (compras no exterior)", amount: 3.5 },
      { date: "2026-08-26", description: "Anuidade Diferenciada", amount: 87.27 },
    ]);
  });

  it("a linha de categoria fica na compra de cima, e a moeda de origem (200,00 BOB) não vira categoria", () => {
    const farmacia = parseItauInvoice(ITAU, 2026).find((t) => t.description === "FARMACIA EXEMPLO");
    expect(farmacia?.categoriaDoBanco).toBeUndefined();
  });

  it("sem o pagamento, a leitura fecha com o total da fatura", () => {
    const linhas = parseStatement(ITAU, "pdf", 2026).filter((t) => !isFaturaSummaryLine(t));
    expect(linhas.some((t) => t.description.includes("02/0"))).toBe(false);
    expect(conferirLeitura(ITAU, "fatura", linhas)).toMatchObject({ status: "fechou", esperado: 340.77 });
  });
});
