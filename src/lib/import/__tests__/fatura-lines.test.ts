import { describe, expect, it } from "vitest";
import { comprasDaFaturaSaoPositivas, isFaturaSummaryLine } from "../fatura-lines";
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

  it("uma compra de verdade, com nome de loja, não é linha de resumo", () => {
    expect(isFaturaSummaryLine(txn({ description: "HTM *mepoup 11/12" }))).toBe(false);
    expect(isFaturaSummaryLine(txn({ description: "PAYGO*LGSTAR A 03/04" }))).toBe(false);
  });
});
