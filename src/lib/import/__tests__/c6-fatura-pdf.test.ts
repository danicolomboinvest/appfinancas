import { describe, expect, it } from "vitest";
import { isC6Invoice, parseC6Invoice } from "../c6-fatura-pdf";
import { conferirLeitura } from "../conferencia";
import { isFaturaSummaryLine } from "../fatura-lines";
import { parseStatement } from "../statement-parser";

/**
 * Fatura FICTÍCIA com a mesma estrutura do PDF do C6 Bank: resumo com saldo remanescente da fatura
 * anterior, lançamentos com mês por extenso e SEM sinal (estorno e pagamento só pela descrição),
 * compra em dólar com a cotação na coluna ao lado, loja que começa com número, parcela do ano
 * passado e, no fim, o boleto repetindo o total e o pagamento mínimo.
 */
const C6 = [
  "Olá, Pessoa! Sua fatura com",
  "no valor de R$ 350,00.",
  "Cartão C6 Carbon",
  "Resumo da fatura",
  "Compras e pagamentos feitos até o fechamento desta fatura em 18/09/26.",
  "Compras nacionais 300,00",
  "Compras internacionais 42,22",
  "Valor remanescente da fatura anterior 26,25",
  "(-) 20,00\tEstornos / Crédito na Fatura",
  "Total a pagar R$ 350,00",
  "Saldo obrigações futuras R$ 1.000,00",
  "Transações do cartão principal",
  "C6 Carbon Final 0000 - PESSOA EXEMPLO Subtotal deste cartão R$ 300,00",
  "Valores em reais",
  "25 ago LOJA EXEMPLO 100,00",
  "13 set Estorno Tarifa - Estorno 20,00",
  "13 set Anuidade Diferenciada - Parcela 1/12 20,00",
  "29 ago 00271 SH EXEMPLO - Parcela 1/3 80,00",
  "15 set SERVICO *EXTERIOR 1,53\tIOF Transações Exterior",
  "15 set SERVICO *EXTERIOR 42,22\tUSD 7,76 | Cotação USD: R$5,44",
  "C6 Black Final 1111 - PESSOA EXEMPLO Subtotal deste cartão R$ 100,00",
  "03 nov LOJA ANTIGA - Parcela 11/12 100,00",
  "19 ago Inclusao de Pagamento 900,00",
  "Formas de pagamento",
  "Banco C6 SA",
  "VALOR TOTAL",
  "350,00",
  "25/09/2026",
  "(-) PAGAMENTO MÍNIMO",
].join("\n");

describe("fatura do C6 Bank (PDF)", () => {
  it("reconhece o arquivo", () => {
    expect(isC6Invoice(C6)).toBe(true);
    expect(isC6Invoice("Extrato de Conta Corrente\n01/01/2026 PIX 10,00")).toBe(false);
  });

  it("valor em reais da compra em dólar, estorno e pagamento negativos, parcela antiga no ano certo", () => {
    expect(parseC6Invoice(C6, 2026)).toEqual([
      { date: "2026-08-25", description: "LOJA EXEMPLO", amount: 100 },
      { date: "2026-09-13", description: "Estorno Tarifa - Estorno", amount: -20 },
      { date: "2026-09-13", description: "Anuidade Diferenciada - Parcela 1/12", amount: 20 },
      { date: "2026-08-29", description: "00271 SH EXEMPLO - Parcela 1/3", amount: 80 },
      { date: "2026-09-15", description: "SERVICO *EXTERIOR - IOF", amount: 1.53 },
      { date: "2026-09-15", description: "SERVICO *EXTERIOR", amount: 42.22 },
      { date: "2025-11-03", description: "LOJA ANTIGA - Parcela 11/12", amount: 100 },
      { date: "2026-08-19", description: "Inclusao de Pagamento", amount: -900 },
    ]);
  });

  it("o boleto no fim não vira compra, e fecha com o total menos o saldo da fatura anterior", () => {
    const linhas = parseStatement(C6, "pdf", 2026).filter((t) => !isFaturaSummaryLine(t));
    expect(linhas).toHaveLength(7);
    expect(conferirLeitura(C6, "fatura", linhas)).toMatchObject({ status: "fechou", esperado: 323.75 });
  });
});
