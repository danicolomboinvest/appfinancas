import { describe, expect, it } from "vitest";
import { detectInvoiceTotal } from "../detect";
import { isFaturaSummaryLine } from "../fatura-lines";
import { isInterInvoice, isInterStatement, parseInterInvoice, parseInterStatement } from "../inter-pdf";
import { parseStatement } from "../statement-parser";

/**
 * Extrato FICTÍCIO com a mesma estrutura do PDF que o app do Banco Inter exporta: "Solicitado
 * em" no topo, dia por extenso numa linha com o saldo do dia, lançamentos sem data com o valor
 * seguido do saldo depois dele, descrição que quebra de linha e rodapé de atendimento.
 */
const INTER = [
  "Solicitado em: 27/09/2026 - 11h05",
  "PESSOA DE EXEMPLO",
  "CPF/CNPJ: ***.000.000-** \tInstituição: Banco Inter",
  "Agência: 0001 \tConta: 0000000-0",
  "Período: 27/08/2026 a 27/09/2026",
  "Saldo total \tSaldo disponível \tSaldo bloqueado",
  "R$ 1.000,00 \tR$ 1.000,00 \tR$ 0,00",
  "Valor \tSaldo por transação",
  "27 de Agosto de 2026 \tSaldo do dia: R$ 1.084,56",
  'Pix enviado: "Cp :00000000-PADARIA FICTICIA" \t-R$ 50,00 \tR$ 1.184,56',
  "Compra no debito: \"No estabelecimento MERCADO",
  'EXEMPLO LTDA" \t-R$ 1.100,00 \tR$ 84,56',
  "1 de Setembro de 2026 \tSaldo do dia: R$ 2.584,56",
  'Pix recebido: "Cp :00000000-EMPRESA MODELO" \tR$ 2.500,00 \tR$ 2.584,56',
  "Fale com a gente",
  "SAC: 0800 000 0000",
  "-- 1 of 2 --",
  "3 de Março de 2026 \tSaldo do dia: R$ 2.574,56",
  'Pagamento efetuado: "Boleto CONTA DE LUZ" \t- R$ 10,00 \tR$ 2.574,56',
].join("\n");

describe("extrato do Banco Inter (PDF)", () => {
  it("reconhece o arquivo", () => {
    expect(isInterStatement(INTER)).toBe(true);
    expect(isInterStatement("Extrato de Conta Corrente\n01/01/2026 PIX 10,00")).toBe(false);
  });

  it("usa o dia por extenso, pega o valor (não o saldo) e junta descrição quebrada", () => {
    expect(parseInterStatement(INTER)).toEqual([
      { date: "2026-08-27", description: 'Pix enviado: "Cp :00000000-PADARIA FICTICIA"', amount: -50 },
      { date: "2026-08-27", description: 'Compra no debito: "No estabelecimento MERCADO EXEMPLO LTDA"', amount: -1100 },
      { date: "2026-09-01", description: 'Pix recebido: "Cp :00000000-EMPRESA MODELO"', amount: 2500 },
      { date: "2026-03-03", description: 'Pagamento efetuado: "Boleto CONTA DE LUZ"', amount: -10 },
    ]);
  });

  it("entra pelo caminho normal de PDF", () => {
    expect(parseStatement(INTER, "pdf")).toHaveLength(4);
  });

  it("não perde o primeiro dia quando ele vem grudado no título da coluna", () => {
    const grudado = INTER.replace(
      "Valor \tSaldo por transação\n27 de Agosto de 2026",
      "Valor \tSaldo por transação\t27 de Agosto de 2026",
    );
    expect(grudado).not.toBe(INTER);
    expect(isInterStatement(grudado)).toBe(true);
    expect(parseInterStatement(grudado)).toEqual(parseInterStatement(INTER));
  });
});

/**
 * Fatura FICTÍCIA com a mesma estrutura do PDF da fatura do cartão do Inter: resumo com
 * simulação de pagamento mínimo, data "23 de jun. 2026", crédito com "+ R$", pagamento da fatura
 * anterior, dois cartões com total cada.
 */
const INTER_FATURA = [
  "Resumo da fatura",
  "Total da sua fatura",
  "R$ 250,00",
  "Pagamento mínimo: R$ 37,50",
  "Total a pagar \tR$ 290,00",
  "1 + 2 de R$ 95,00 \tR$ 285,00",
  "Despesas da fatura",
  "CARTÃO 0000****1111",
  "Data \tMovimentação \tBeneficiário \tValor",
  "23 de jun. 2026 LOJA EXEMPLO (Parcela 03 de 03) \t- \tR$ 70,00",
  "06 de ago. 2026 ESTORNO EXEMPLO \t- \t+ R$ 20,00",
  "11 de ago. 2026 PAGAMENTO ON LINE \t- \t+ R$ 300,00",
  "12 de ago. 2026 MERCADO FICTICIO \t- \tR$ 1.000,00",
  "Total CARTÃO 0000****1111 \tR$ 1.070,00",
  "CARTÃO 0000****2222",
  "02 de ago. 2026 RESTAURANTE EXEMPLO \t- \tR$ 30,00",
].join("\n");

describe("fatura do cartão do Banco Inter (PDF)", () => {
  it("reconhece a fatura e não confunde com o extrato", () => {
    expect(isInterInvoice(INTER_FATURA)).toBe(true);
    expect(isInterInvoice(INTER)).toBe(false);
  });

  it("compra positiva, crédito negativo, data por extenso abreviada, dos dois cartões", () => {
    expect(parseInterInvoice(INTER_FATURA)).toEqual([
      { date: "2026-06-23", description: "LOJA EXEMPLO (Parcela 03 de 03)", amount: 70 },
      { date: "2026-08-06", description: "ESTORNO EXEMPLO", amount: -20 },
      { date: "2026-08-11", description: "PAGAMENTO ON LINE", amount: -300 },
      { date: "2026-08-12", description: "MERCADO FICTICIO", amount: 1000 },
      { date: "2026-08-02", description: "RESTAURANTE EXEMPLO", amount: 30 },
    ]);
  });

  it("sem o pagamento, as compras entram, e o total conferido é o da fatura (não o da simulação)", () => {
    const linhas = parseStatement(INTER_FATURA, "pdf").filter((t) => !isFaturaSummaryLine(t));
    expect(linhas.map((t) => t.description)).not.toContain("PAGAMENTO ON LINE");
    expect(detectInvoiceTotal(INTER_FATURA)).toBe(250);
  });
});
