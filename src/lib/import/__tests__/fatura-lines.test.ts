import { describe, expect, it } from "vitest";
import { comprasDaFaturaSaoPositivas, isFaturaSummaryLine, pareceCreditoDePagamento } from "../fatura-lines";
import type { ParsedTransaction } from "@/lib/import/statement-parser";

const txn = (over: Partial<ParsedTransaction> = {}): ParsedTransaction => ({
  date: "2026-09-10",
  description: "IFOOD",
  amount: 45.9,
  ...over,
});

describe("comprasDaFaturaSaoPositivas: a fatura pode vir com qualquer convenção de sinal", () => {
  it("BTG: compra positiva, maioria positiva — mantém o sinal de sempre", () => {
    const parsed = [txn({ amount: 100 }), txn({ amount: 50 }), txn({ amount: -30 })];
    expect(comprasDaFaturaSaoPositivas(parsed)).toBe(true);
  });

  it("Itaú lido pelo parser genérico: compra sem sinal explícito sai negativa, maioria negativa — inverte", () => {
    // 133 compras negativas (sem marcação de crédito) contra só algumas positivas de verdade.
    const parsed = [...Array(133).fill(0).map(() => txn({ amount: -50 })), txn({ amount: 6523.91 })];
    expect(comprasDaFaturaSaoPositivas(parsed)).toBe(false);
  });

  it("empate: mantém a convenção positiva (o padrão de antes, sem regressão)", () => {
    const parsed = [txn({ amount: 100 }), txn({ amount: -100 })];
    expect(comprasDaFaturaSaoPositivas(parsed)).toBe(true);
  });
});

describe("isFaturaSummaryLine: linhas que não são uma compra de verdade", () => {
  it("pagamento via conta (o pagamento da fatura anterior) não é compra", () => {
    expect(isFaturaSummaryLine(txn({ description: "Pagamento via conta" }))).toBe(true);
  });

  it("pagamento efetuado/recebido continua coberto", () => {
    expect(isFaturaSummaryLine(txn({ description: "Pagamento efetuado" }))).toBe(true);
    expect(isFaturaSummaryLine(txn({ description: "PAGAMENTO RECEBIDO" }))).toBe(true);
  });

  it("total de compras/créditos continua coberto", () => {
    expect(isFaturaSummaryLine(txn({ description: "Total de compras" }))).toBe(true);
  });

  it("linha digitável de boleto (só dígitos, barras e traços) não é compra", () => {
    expect(isFaturaSummaryLine(txn({ description: "2525/0004841-5 175/04314114-1" }))).toBe(true);
  });

  it("pagamento da fatura anterior no meio das compras (Nubank e Bradesco em PDF) não é compra", () => {
    expect(isFaturaSummaryLine(txn({ description: "Pagamento em 09 AGO" }))).toBe(true);
    expect(isFaturaSummaryLine(txn({ description: "PAGTO. POR DEB EM C/C -" }))).toBe(true);
  });

  it("uma compra de verdade, com nome de loja, não é linha de resumo", () => {
    expect(isFaturaSummaryLine(txn({ description: "HTM *mepoup 11/12" }))).toBe(false);
    expect(isFaturaSummaryLine(txn({ description: "PAYGO*LGSTAR A 03/04" }))).toBe(false);
  });
});

describe("pagamento da fatura anterior escrito de outro jeito também é resumo", () => {
  // Sem isso a linha virava estorno e a fatura anterior inteira saía do gasto do mês.
  it.each([
    "Pagamento da fatura",
    "PAGAMENTO FATURA",
    "PAGTO FATURA",
    "Pgto. da fatura",
    "Inclusao de Pagamento",
    "Inclusão de pagamento",
    "PAGAMENTO ON LINE",
    "Pagamento online",
    "Pagto debito automatico",
    "PAGAMENTO DEB. AUTOM.",
    "Pagamentos Validos Normais",
    "PAGAMENTO DE FATURA",
  ])("%s", (description) => {
    expect(isFaturaSummaryLine(txn({ description, amount: -2800 }))).toBe(true);
  });

  it("compra com nome de loja parecido não vira resumo", () => {
    expect(isFaturaSummaryLine(txn({ description: "FATURA SEGURA LTDA" }))).toBe(false);
    expect(isFaturaSummaryLine(txn({ description: "PAGUE MENOS 123" }))).toBe(false);
  });
});

describe("pareceCreditoDePagamento: crédito da fatura que é pagamento, não devolução", () => {
  it("fala em pagamento e não diz que é devolução", () => {
    expect(pareceCreditoDePagamento("PAGAMENTO RECEBIDO OBRIGADO")).toBe(true);
    expect(pareceCreditoDePagamento("Pgto cartao")).toBe(true);
  });

  it("estorno de compra continua estorno", () => {
    expect(pareceCreditoDePagamento("ESTORNO PAGAMENTO LOJA X")).toBe(false);
    expect(pareceCreditoDePagamento("AMAZON MARKETPLACE")).toBe(false);
  });
});
