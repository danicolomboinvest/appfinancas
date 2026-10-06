import { describe, expect, it } from "vitest";
import { isBradescoInvoice, parseBradescoInvoice } from "../bradesco-fatura-pdf";
import { conferirLeitura } from "../conferencia";
import { isFaturaSummaryLine } from "../fatura-lines";
import { parseStatement } from "../statement-parser";

/**
 * Fatura FICTÍCIA com a mesma estrutura do PDF do cartão Bradesco: crédito com o menos DEPOIS do
 * valor, cidade quebrada em linhas com o valor sozinho embaixo, compra no exterior com dólar e
 * cotação antes do valor em reais, total por cartão e o quadro de limites no fim.
 */
const BRADESCO = [
  "Total da fatura",
  "R$ 314,43",
  "Vencimento",
  "10/01/2027",
  "Resumo da fatura",
  "Saldo anterior......................... R$ 800,00",
  "(-) Créditos/Pagamentos..... R$ 850,00",
  "(+)Compras/Débitos............ R$ 364,43",
  "(=)Total.................................... R$ 314,43",
  "Banco Bradesco S/A",
  "Lançamentos",
  "Data Histórico de Lançamentos Cidade US$ Cotação",
  "do Dólar R$",
  "10/12 PAGTO. POR DEB EM C/C 800,00 -",
  "PESSOA EXEMPLO Cartão 0000 XXXX XXXX 0000",
  "21/02 LOJA PARCELADA 11/12 CIDADE 100,00",
  "08/12 FARMACIA EXEMPLO 02/03 SAO PEDRO",
  "DA",
  "196,92",
  "04/12 LOJA ESTORNADA BARUERI 50,00 -",
  "29/12 SERVICO USD 12,32 SITE.COM 12,32 5,4800 67,51",
  "Total para PESSOA EXEMPLO",
  "SOBRENOME 314,43",
  "Mensagem Importante",
  "Limites",
  "Compras R$ 40.500,00 R$ 8.000,00 R$ 32.500,00",
].join("\n");

describe("fatura do cartão Bradesco (PDF)", () => {
  it("reconhece o arquivo", () => {
    expect(isBradescoInvoice(BRADESCO)).toBe(true);
    expect(isBradescoInvoice("Extrato de Conta Corrente\n01/01/2026 PIX 10,00")).toBe(false);
  });

  it("menos depois do valor é crédito; valor sozinho na linha de baixo; real, não dólar", () => {
    expect(parseBradescoInvoice(BRADESCO)).toEqual([
      { date: "2026-12-10", description: "PAGTO. POR DEB EM C/C", amount: -800 },
      { date: "2026-02-21", description: "LOJA PARCELADA 11/12 CIDADE", amount: 100 },
      { date: "2026-12-08", description: "FARMACIA EXEMPLO 02/03 SAO PEDRO DA", amount: 196.92 },
      { date: "2026-12-04", description: "LOJA ESTORNADA BARUERI", amount: -50 },
      { date: "2026-12-29", description: "SERVICO USD 12,32 SITE.COM", amount: 67.51 },
    ]);
  });

  it("sem o pagamento, fecha com o total da fatura", () => {
    const linhas = parseStatement(BRADESCO, "pdf").filter((t) => !isFaturaSummaryLine(t));
    expect(linhas.some((t) => t.description.startsWith("PAGTO"))).toBe(false);
    expect(conferirLeitura(BRADESCO, "fatura", linhas)).toMatchObject({ status: "fechou", esperado: 314.43 });
  });
});

describe("Bradesco Cartões app: dia e mês em linhas separadas", () => {
  const texto = [
    "XXXX.XXXX.XXXX.0000",
    "Aplicativo Bradesco Cartões",
    "Data: 06/10/2026 - 03:03",
    "Situação do Extrato: EM ABERTO",
    "FULANA EXEMPLO - VISA",
    "Data Histórico",
    "30",
    "/08 Loja Exemplo 2/6 BRL",
    "600,00 0,00 R$ 0,00 100,00",
    "27",
    "/08",
    "MERCADO*EXEMPLO",
    "2/2",
    "BRL",
    "142,62 0,00 R$ 0,00 71,31",
    "25",
    "/06",
    "LOJA ABC 4",
    "/5",
    "BRL",
    "400,00 0,00 R$ 0,00 80,00",
    ". Total da Fatura em Real . . . R$ 251,31",
  ].join("\n");

  it("lê as três compras e fecha com o total da fatura", async () => {
    const { parseBradescoCartoesApp } = await import("../bradesco-cartoes-app-pdf");
    const t = parseBradescoCartoesApp(texto, 2026);
    expect(t).toHaveLength(3);
    expect(t.map((x) => x.date)).toEqual(["2026-08-30", "2026-08-27", "2026-06-25"]);
    expect(t.reduce((s, x) => s + x.amount, 0)).toBeCloseTo(251.31, 2);
  });
});
