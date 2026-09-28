import { describe, expect, it } from "vitest";
import { isFaturaSummaryLine } from "../fatura-lines";
import { parseStatement } from "../statement-parser";

/**
 * Fatura FICTÍCIA com a mesma estrutura do PDF do Bradesco Cartões: pagamento da fatura anterior
 * no meio dos lançamentos ("PAGTO. POR DEB EM C/C ... -"), cidade que quebra a linha e empurra o
 * valor pra baixo, e o quadro "Limites" no fim com a data numa linha e os valores na seguinte.
 */
const FATURA = [
  "Total da fatura",
  "R$ 130,00",
  "Lançamentos",
  "Data Histórico de Lançamentos Cidade US$ Cotação",
  "do Dólar R$",
  "10/08 PAGTO. POR DEB EM C/C 500,00 -",
  "PESSOA DE EXEMPLO Cartão 0000 XXXX XXXX 0000",
  "07/08 RESTAURANTE EXEMPLO PORTO",
  "ALEGRE",
  "100,00",
  "20/08 FARMACIA FICTICIA SAO PAULO 30,00",
  "Total para PESSOA DE EXEMPLO 130,00",
  "Total da fatura em real 130,00",
  "Limites",
  "Total Utilizado Disponível em",
  "28/08/2026",
  "Compras R$ 14.400,00 R$ 3.626,29 R$ 10.773,71",
  "Saque R$ 2.880,00 R$ 0,00 R$ 2.880,00",
].join("\n");

describe("fatura do Bradesco Cartões (PDF)", () => {
  it("só as compras entram: sem o pagamento da fatura anterior e sem o quadro de limites", () => {
    const compras = parseStatement(FATURA, "pdf", 2026).filter((t) => !isFaturaSummaryLine(t));
    expect(compras.map((t) => t.description)).toEqual(["RESTAURANTE EXEMPLO PORTO ALEGRE", "FARMACIA FICTICIA SAO PAULO"]);
    expect(compras.reduce((s, t) => s + Math.abs(t.amount), 0)).toBeCloseTo(130);
  });

  it("não confunde loja de verdade com a linha do quadro", () => {
    expect(isFaturaSummaryLine({ date: "2026-08-01", description: "COMPRAS ONLINE LTDA", amount: -10 })).toBe(false);
    expect(isFaturaSummaryLine({ date: "2026-08-01", description: "Compras", amount: -10 })).toBe(true);
  });
});

describe("sinal de menos tipográfico (−) na fatura do Nubank em PDF", () => {
  it("é lido como sinal, e o pagamento da fatura anterior sai da lista", () => {
    const texto = [
      "TRANSAÇÕES DE 02 AGO A 02 SET",
      "07 AGO •••• 0000 Loja Exemplo R$ 31,90",
      "Pagamentos -R$ 100,00",
      "09 AGO Pagamento em 09 AGO −R$ 100,00",
    ].join("\n");
    const lidos = parseStatement(texto, "pdf", 2026);
    expect(lidos.find((t) => t.description.startsWith("Pagamento em"))?.description).toBe("Pagamento em 09 AGO");
    expect(lidos.filter((t) => !isFaturaSummaryLine(t)).map((t) => t.description)).toEqual(["•••• 0000 Loja Exemplo"]);
  });
});

/**
 * Fatura FICTÍCIA com a mesma estrutura do PDF do Santander: quadro "Histórico de Faturas" no
 * topo logo depois de uma data solta, débito automático da fatura anterior entre os créditos, e
 * compras com um algarismo solto ANTES da data.
 */
const SANTANDER = [
  "Melhor dia para",
  "compras",
  "24/10/2026",
  "Histórico de Faturas \tPagamento \tPeríodo das compras",
  "JUL. \tR$ 811,34 \tR$3.382,91 \t24/06/26 a 23/07/26",
  "Detalhamento da Fatura",
  "Pagamento e Demais Créditos",
  "Compra Data Descrição \tParcela \tR$ \tUS$",
  "31/08 DEB AUTOM DE FATURA EM C/ \t-52,70",
  "Parcelamentos",
  "Compra Data Descrição \tParcela \tR$ \tUS$",
  "2 \t05/11 LOJA FICTICIA \t11/12 \t13,90",
  "08/04 OUTRA LOJA \t06/06 \t81,14",
  "Despesas",
  "Compra Data Descrição \tParcela \tR$ \tUS$",
  "3 \t25/08 METRO EXEMPLO \t8,10",
  "23/08 MERCADO EXEMPLO \t254,83",
  "VALOR TOTAL \t357,97 \t0,00",
].join("\n");

describe("fatura do Santander (PDF)", () => {
  it("lê a compra com algarismo antes da data e deixa de fora o histórico e o débito automático", () => {
    const compras = parseStatement(SANTANDER, "pdf", 2026).filter((t) => !isFaturaSummaryLine(t));
    expect(compras.map((t) => t.description)).toEqual(["LOJA FICTICIA 11/12", "OUTRA LOJA 06/06", "METRO EXEMPLO", "MERCADO EXEMPLO"]);
    expect(compras.reduce((s, t) => s + Math.abs(t.amount), 0)).toBeCloseTo(357.97);
  });
});
