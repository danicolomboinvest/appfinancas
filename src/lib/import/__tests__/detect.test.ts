import { describe, expect, it } from "vitest";
import { detectDocKind, detectInvoiceTotal, looksLikeCardInvoice } from "../detect";
import { parseCsv, parseTextLines, parseAmountFlexible } from "../statement-parser";

describe("detectDocKind", () => {
  it("tells a card invoice from a bank statement by header, OFX type or file name", () => {
    expect(detectDocKind("date,title,amount\n2026-08-01,IFOOD,45.9", "Nubank_2026-09-20.csv").kind).toBe("fatura");
    expect(detectDocKind("Data,Valor,Identificador,Descrição\n01/08/2026,-45.9,abc,Ifood", "NU_1_01AGO2026.csv").kind).toBe("extrato");
    expect(detectDocKind("<OFX><CREDITCARDMSGSRSV1><CCSTMTRS>", "x.ofx").kind).toBe("fatura");
    expect(detectDocKind("<OFX><BANKMSGSRSV1><STMTRS>", "x.ofx").kind).toBe("extrato");
    expect(detectDocKind("Data de Compra;Nome no Cartão;Final do Cartão;Categoria;Descrição;Parcela;Valor (em US$);Cotação (em R$);Valor (em R$)", "C6 setembro.csv").kind).toBe("fatura");
    expect(detectDocKind("qualquer coisa", "extrato_agosto.csv").kind).toBe("extrato");
    expect(detectDocKind("qualquer coisa", "arquivo.csv").kind).toBe("unknown");
  });

  it("uses the signs as a second opinion", () => {
    const allPositive = Array.from({ length: 10 }, (_, i) => ({ date: "2026-08-01", description: `Loja ${i}`, amount: 10 + i }));
    expect(looksLikeCardInvoice(allPositive)).toBe(true);
    expect(looksLikeCardInvoice([...allPositive.slice(0, 5), ...allPositive.slice(5).map((t) => ({ ...t, amount: -t.amount }))])).toBe(false);
  });

  it("reads the invoice total to reconcile", () => {
    expect(detectInvoiceTotal("Fatura de setembro\nTotal da fatura R$ 2.345,67\n")).toBe(2345.67);
    expect(detectInvoiceTotal("Valor total: R$ 980,00")).toBe(980);
    expect(detectInvoiceTotal("sem total")).toBeNull();
  });
});

describe("parseCsv with real-world headers", () => {
  it("picks the R$ column on a C6 invoice, not the US$ one", () => {
    const csv = [
      "Data de Compra;Nome no Cartão;Final do Cartão;Categoria;Descrição;Parcela;Valor (em US$);Cotação (em R$);Valor (em R$)",
      "01/09/2026;MARINA;1234;Alimentação;IFOOD;Única;0,00;0,00;45,90",
      "02/09/2026;MARINA;1234;Viagem;AIRBNB;Única;120,00;5,20;624,00",
    ].join("\n");
    expect(parseCsv(csv).map((t) => t.amount)).toEqual([45.9, 624]);
  });

  it("combines separate credit and debit columns, and honours a D/C column", () => {
    const csv = ["Data;Histórico;Crédito;Débito", "01/09/2026;SALARIO;5.000,00;", "02/09/2026;MERCADO;;250,00"].join("\n");
    expect(parseCsv(csv).map((t) => t.amount)).toEqual([5000, -250]);
    const dc = ["Data;Lançamento;Valor;D/C", "03/09/2026;PIX RECEBIDO;100,00;C", "04/09/2026;PIX ENVIADO;80,00;D"].join("\n");
    expect(parseCsv(dc).map((t) => t.amount)).toEqual([100, -80]);
  });

  it("treats accounting parentheses as negative", () => {
    expect(parseAmountFlexible("(1.234,56)")).toBe(-1234.56);
    expect(parseAmountFlexible("1.234,56")).toBe(1234.56);
  });
});

describe("parseTextLines (PDF) with multi-line records and short dates", () => {
  it("reads invoice lines dated '12 AGO' and descriptions that wrap before the amount", () => {
    const text = ["Fatura de setembro", "12 AGO", "IFOOD *IFD", "45,90", "13 AGO UBER *TRIP 18,50", "Total da fatura R$ 64,40", "14 ago 2026 PADARIA 12,00"].join("\n");
    const txns = parseTextLines(text, 2026);
    expect(txns).toEqual([
      { date: "2026-08-12", description: "IFOOD *IFD", amount: -45.9 },
      { date: "2026-08-13", description: "UBER *TRIP", amount: -18.5 },
      { date: "2026-08-14", description: "PADARIA", amount: -12 },
    ]);
  });

  it("keeps the old one-line behaviour and skips balance lines", () => {
    const text = ["01/09/2026 PIX RECEBIDO JOAO 1.000,00 C", "01/09/2026 SALDO DO DIA 3.000,00", "02/09/2026 MERCADO 250,00 D"].join("\n");
    expect(parseTextLines(text).map((t) => [t.description, t.amount])).toEqual([["PIX RECEBIDO JOAO", 1000], ["MERCADO", -250]]);
  });
});
