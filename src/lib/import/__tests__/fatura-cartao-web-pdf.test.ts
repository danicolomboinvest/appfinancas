import { describe, expect, it } from "vitest";
import { detectDocKind } from "../detect";
import { isFaturaSummaryLine } from "../fatura-lines";
import { isFaturaCartaoWeb, parseFaturaCartaoWeb } from "../fatura-cartao-web-pdf";
import { fechaComoFatura } from "../leitor-inteligente";
import { parseStatementComLeitor } from "../statement-parser";

/** Fatura do cartão salva da página do banco na internet; nomes e valores inventados. */
const FATURA = [
  "Valor da fatura: R$ 100,00",
  "Fatura Data 21/10/2026 - 01:43:00",
  "Cartao selecionado",
  "**** **** **** 0000",
  "Validade: 01/30",
  "PESSOA EXEMPLO",
  "Data de vencimento:",
  "Total da fatura:",
  "Forma de pagamento:",
  "Melhor data de compra:",
  "10/10/2026",
  "R$ 349,70",
  "Débito em conta",
  "30",
  "Valor da fatura anterior: R$ 2.500,00",
  "Data Lançamentos Moeda de Origem Valor (US$) Cotação (US$) Valor (R$)",
  "Gastos referentes ao cartão: Final 1111 | PESSOA EXEMPLO",
  "Você ainda não possui lançamentos.",
  "Data Lançamentos Moeda de Origem Valor (US$) Cotação (US$) Valor (R$)",
  "Gastos referentes ao cartão: Final 0000 | PESSOA EXEMPLO",
  "5",
  "SET LOJA EXEMPLO 89,90",
  "OUTRA LOJA 9,90",
  "",
  "-- 1 of 2 --",
  "",
  "Valor da fatura: R$ 99,80",
  "MERCADO EXEMPLO -10,00",
  "10",
  "SET SALDO ANTERIOR 2.500,00",
  "PAGTO. POR DEB EM C/C -2.500,00",
  "22",
  "NOV LOJA PARCELADA ( 11/12 ) 150,00",
  "28",
  "SET PADARIA EXEMPLO 110,00",
  "",
  "-- 2 of 2 --",
  "",
  "Total da fatura (final 0000 + 1111): R$ 349,70",
  "Resumo das Despesas Real",
  "Saldo anterior 2.500,00",
  "(-)Pagamentos/Créditos: 2.510,00",
  "(+)Despesas locais: 359,70",
  "(=)Total da fatura: 349,70",
].join("\n");

describe("fatura do cartão salva da página do banco", () => {
  it("liga o dia sozinho na linha às compras de baixo, inclusive depois da quebra de página", () => {
    expect(isFaturaCartaoWeb(FATURA)).toBe(true);
    expect(parseFaturaCartaoWeb(FATURA).map((t) => [t.date, t.description, t.amount])).toEqual([
      ["2026-09-05", "LOJA EXEMPLO", 89.9],
      ["2026-09-05", "OUTRA LOJA", 9.9],
      ["2026-09-05", "MERCADO EXEMPLO", -10],
      ["2026-09-10", "PAGTO. POR DEB EM C/C", -2500],
      ["2025-11-22", "LOJA PARCELADA ( 11/12 )", 150],
      ["2026-09-28", "PADARIA EXEMPLO", 110],
    ]);
  });

  it("não vira uma compra só do tamanho da fatura, e a leitura fecha com o total", () => {
    const { txns, leitor } = parseStatementComLeitor(FATURA, "pdf", 2026);
    expect(leitor).toBe("fatura-cartao-web");
    const compras = txns.filter((t) => !isFaturaSummaryLine(t));
    expect(compras).toHaveLength(5);
    expect(compras.some((t) => Math.abs(t.amount) === 349.7)).toBe(false);
    expect(fechaComoFatura(FATURA, txns)).toBe("fechou");
    expect(detectDocKind(FATURA).kind).toBe("fatura");
  });
});
