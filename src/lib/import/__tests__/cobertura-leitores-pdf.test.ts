import { describe, expect, it } from "vitest";
import { isBradescoInvoice, parseBradescoInvoice } from "../bradesco-fatura-pdf";
import { parseStatementComLeitor } from "../statement-parser";
import { isBancoDoBrasilStatement } from "../bb-pdf";
import { isBanestesStatement } from "../banestes-pdf";
import { isBradescoStatement } from "../bradesco-pdf";
import { isC6Invoice } from "../c6-fatura-pdf";
import { isCaixaAppStatement } from "../caixa-pdf";
import { isCoraStatement } from "../cora-pdf";
import { isInterInvoice, isInterStatement } from "../inter-pdf";
import { isItauInvoice } from "../itau-fatura-pdf";
import { isMidwayInvoice } from "../midway-fatura-pdf";
import { isNubankInvoice } from "../nubank-fatura-pdf";
import { isNubankStatement } from "../nubank-pdf";
import { isOurocardInvoice } from "../ourocard-pdf";
import { isSantanderInvoice } from "../santander-fatura-pdf";
import { isSantanderConsolidatedStatement } from "../santander-pdf";

// Cobertura extra (set/2026). Textos FICTÍCIOS, no formato que o extrator de PDF devolve.

/** Fatura do cartão Bradesco, montada a partir do exemplo do cabeçalho de bradesco-fatura-pdf.ts. */
const FATURA_BRADESCO = [
  "Banco Bradesco Cartões",
  "Resumo da fatura",
  "Vencimento",
  "10/10/2026",
  "Lançamentos",
  "Data Histórico de Lançamentos Cidade US$ Cotação do Dólar R$",
  "10/09 PAGTO. POR DEB EM C/C 6.384,08 -",
  "PESSOA EXEMPLO Cartão 0000 XXXX XXXX 0000",
  "08/08 FARMACIA EXEMPLO 02/03 SAO PEDRO",
  "DA",
  "196,92",
  "04/09 LOJA ESTORNADA BARUERI 56,89 -",
  "29/08 SERVICO USD 12,32 SITE.COM 12,32 5,4800 67,51",
  "Total para PESSOA EXEMPLO 3.071,80",
  "Limites",
  "Compras R$ 40.500,00 R$ 8.000,00 R$ 32.500,00",
].join("\n");

describe("fatura do Bradesco em PDF (bradesco-fatura-pdf.ts, sem teste até aqui)", () => {
  it("o leitor próprio reconhece e lê: compra positiva, estorno e pagamento negativos", () => {
    expect(isBradescoInvoice(FATURA_BRADESCO)).toBe(true);
    expect(parseBradescoInvoice(FATURA_BRADESCO, 2026)).toEqual([
      { date: "2026-09-10", description: "PAGTO. POR DEB EM C/C", amount: -6384.08 },
      { date: "2026-08-08", description: "FARMACIA EXEMPLO 02/03 SAO PEDRO DA", amount: 196.92 },
      { date: "2026-09-04", description: "LOJA ESTORNADA BARUERI", amount: -56.89 },
      { date: "2026-08-29", description: "SERVICO USD 12,32 SITE.COM", amount: 67.51 },
    ]);
  });

  it("compra de mês depois do vencimento é do ano anterior", () => {
    const t = FATURA_BRADESCO.replace("10/10/2026", "10/01/2027").replace("08/08 FARMACIA", "20/12 FARMACIA");
    expect(parseBradescoInvoice(t, 2027).find((x) => x.description.startsWith("FARMACIA"))?.date).toBe("2026-12-20");
  });

  it("sem 'Resumo da fatura' não é fatura do Bradesco", () => {
    expect(isBradescoInvoice(FATURA_BRADESCO.replace("Resumo da fatura", ""))).toBe(false);
  });

  // O leitor existia mas não estava na lista LEITORES_PDF (statement-parser.ts) nem era importado
  // em lugar nenhum. A fatura caía no leitor genérico, que não vê o "-" DEPOIS do valor: o
  // estorno saía com o mesmo sinal das compras e virava mais um gasto (o próprio cabeçalho do
  // arquivo cita uma fatura de R$ 4.981 lida como R$ 5.095).
  it("a fatura do Bradesco em PDF passa pelo leitor próprio", () => {
    expect(parseStatementComLeitor(FATURA_BRADESCO, "pdf", 2026).leitor).toBe("bradesco-fatura");
  });

  it("pelo leitor próprio, estorno e compra saem com sinais OPOSTOS", () => {
    const { txns } = parseStatementComLeitor(FATURA_BRADESCO, "pdf", 2026);
    const estorno = txns.find((t) => t.description.startsWith("LOJA ESTORNADA"));
    const compra = txns.find((t) => t.description.startsWith("FARMACIA"));
    expect(Math.sign(estorno!.amount)).toBe(-1);
    expect(Math.sign(compra!.amount)).toBe(1);
  });
});

describe("reconhecedores dos bancos não pegam texto de outro lugar", () => {
  const reconhecedores = {
    isBancoDoBrasilStatement,
    isBanestesStatement,
    isBradescoStatement,
    isBradescoInvoice,
    isC6Invoice,
    isCaixaAppStatement,
    isCoraStatement,
    isInterInvoice,
    isInterStatement,
    isItauInvoice,
    isMidwayInvoice,
    isNubankInvoice,
    isNubankStatement,
    isOurocardInvoice,
    isSantanderInvoice,
    isSantanderConsolidatedStatement,
  };
  const textos = [
    "",
    "Extrato de conta corrente\nBanco Exemplo S.A.\n10/09/2026 PIX ENVIADO MARIA 50,00\nSaldo 1.000,00",
    "Fatura do cartão\nCooperativa Exemplo\n10/09 LOJA EXEMPLO 20,00\nTotal da fatura 20,00",
  ];

  for (const [nome, reconhece] of Object.entries(reconhecedores)) {
    it(`${nome} não reconhece extrato/fatura genérica`, () => {
      for (const t of textos) expect(reconhece(t), t.slice(0, 30)).toBe(false);
    });
  }
});
