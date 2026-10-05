import { describe, expect, it } from "vitest";
import { isFaturaSummaryLine } from "../fatura-lines";
import { lerFaturaTestando } from "../leitor-inteligente";
import type { ParsedTransaction } from "../statement-parser";

/**
 * O que o leitor inteligente aprendeu em 05/10/2026, com as faturas reais guardadas: cada
 * tropeço virou uma regra ou uma chave a mais pra testar, NUNCA um leitor de banco. Amostras
 * FICTÍCIAS de um "Banco Exemplo", com a forma de escrever de cada banco real.
 */
const cabeca = (total: string) => ["BANCO EXEMPLO S.A. - Fatura do cartão", "Vencimento 10/10/2026", "Fatura fechada em 29/09/2026", `Total da fatura R$ ${total}`];
const compras = (txns: ParsedTransaction[] | null) => (txns ?? []).filter((t) => !isFaturaSummaryLine(t));
const valores = (txns: ParsedTransaction[] | null) => compras(txns).map((t) => t.amount);

describe("leitor inteligente: lições de 05/10/2026", () => {
  it("crédito escrito sem sinal ('Crédito concedido', Mercado Pago) é crédito", () => {
    const texto = [...cabeca("80,10"), "Lançamentos", "26/07 Crédito concedido R$ 19,90", "20/07 LOJA EXEMPLO R$ 60,00", "24/07 OUTRA LOJA R$ 40,00"].join("\n");
    expect(valores(lerFaturaTestando(texto, 2026))).toEqual([-19.9, 60, 40]);
  });

  it("frase explicando o estorno no meio não faz desistir do valor (Nubank)", () => {
    const texto = [
      ...cabeca("50,00"),
      "Transações de 25 AGO a 24 SET",
      "05 SET LOJA EXEMPLO R$ 100,00",
      '05 SET Estorno de "Servico Exemplo"',
      "Estorno referente a compra em Servico Exemplo, de valor R$ 50,00,",
      "realizada em 06 de Novembro de 2025",
      "−R$ 50,00",
    ].join("\n");
    expect(valores(lerFaturaTestando(texto, 2026))).toEqual([100, -50]);
  });

  it("'JUROS DE MORA' com data é cobrança (Riachuelo); a tabela de taxas com % não é", () => {
    const texto = [...cabeca("100,32"), "Lançamentos", "Juros de mora 1,00 % a.m. 0,00 % a.a.", "08/09 LOJA EXEMPLO 100,00", "23/09 JUROS DE MORA 0,32"].join("\n");
    expect(valores(lerFaturaTestando(texto, 2026))).toEqual([100, 0.32]);
  });

  it("data '19/set' com a hora logo depois (Sicredi)", () => {
    const texto = [...cabeca("64,00"), "Lançamentos", "19/set 08:34 Sao Paulo Online Loja Exemplo R$ 49,00", "18/set 08:06 Cidade Presencial Cafeteria R$ 15,00"].join("\n");
    const txns = compras(lerFaturaTestando(texto, 2026));
    expect(txns.map((t) => [t.date, t.amount])).toEqual([["2026-09-19", 49], ["2026-09-18", 15]]);
  });

  it("quadro de limites antes das compras não engole a fatura até o fim (Banrisul)", () => {
    const texto = [...cabeca("300,00"), "Limites de crédito Taxas anuais", "Limite total R$ 19.400,00", "HISTÓRICO DE TRANSAÇÕES", "23/07 LOJA EXEMPLO 02/02 200,00", "06/08 OUTRA LOJA 100,00"].join("\n");
    expect(valores(lerFaturaTestando(texto, 2026))).toEqual([200, 100]);
  });

  it("linha só de números abaixo da compra: o valor em reais é o último; câmbio é informação (Bradesco app, PicPay)", () => {
    const texto = [
      ...cabeca("140,13"),
      "Lançamentos",
      "24/09 LOJA EXEMPLO BRL",
      "119,90 0,00 R$ 0,00 119,90",
      "15/08 SERVICO EXTERIOR",
      "Peso argentino: 5.173,00",
      "Câmbio do dia: R$ 5,48",
      "3,69 20,23",
    ].join("\n");
    expect(valores(lerFaturaTestando(texto, 2026))).toEqual([119.9, 20.23]);
  });

  it("número com espaço no meio, duas colunas na linha e a parcela seguinte repetida (Itaú)", () => {
    const texto = [
      "Itaú Cartões",
      "Postagem: 29/08/2026",
      "Lanç am ent o s: c o mp ra s e saq ue s",
      "01/08 MER CADO EXEMPLO 53 ,90 04/ 08 PIX Ministe rio 01/02 125, 56",
      "31/05 LO JA -C 03/1 0 82,4 9 07/08 FARMA CIA EXEMPLO 17 ,51",
      "Tot al para próximas fatura s 208,05 03/08 PA DARIA EX 20 ,98",
      "31/05 LO JA -C 04/ 10 82,4 9 04/ 08 PIX Ministe rio 02/02 125, 56",
      "L Tot al dos lançam ent os atuais 300,44",
    ].join("\n");
    expect(valores(lerFaturaTestando(texto, 2026))).toEqual([53.9, 125.56, 82.49, 17.51, 20.98]);
  });

  it("'Repasse de IOF em R$' no meio da linha, na outra coluna, também conta (Itaú)", () => {
    const texto = [...cabeca("102,43"), "Lançamentos", "11/09 LOJA EXEMPLO 100,00 Repasse de IOF em R$ 2,43"].join("\n");
    expect(valores(lerFaturaTestando(texto, 2026))).toEqual([2.43, 100]);
  });

  it("pagamento da anterior escrito de outro jeito sai pelo valor do saldo anterior (Carrefour, Banrisul)", () => {
    const texto = [...cabeca("150,00"), "Total da fatura anterior: R$ 870,71", "Lançamentos", "08/08 LOJA EXEMPLO 100,00", "10/08 Pagamento Banco Exemplo 870,71-", "22/08 OUTRA LOJA 50,00"].join("\n");
    const txns = lerFaturaTestando(texto, 2026)!;
    expect(valores(txns)).toEqual([100, 50]);
    expect(txns.find((t) => t.amount === -870.71)?.description).toMatch(/^Pagamento da fatura anterior/);
  });

  it("devolução de loja com o valor do saldo, por acaso, continua devolução", () => {
    const texto = [...cabeca("269,10"), "Total da fatura anterior 1.000,00", "Lançamentos", "02/09 PAGAMENTO EFETUADO -949,10", "06/09 LOJA EXEMPLO 300,00", "07/09 PADARIA EXEMPLO 20,00", "10/08 LOJA DEVOLVEU -50,90"].join("\n");
    expect(valores(lerFaturaTestando(texto, 2026))).toEqual([300, 20, -50.9]);
  });

  it("parcela '03/05' logo abaixo de data com mês por extenso é parcela, não 3 de maio (Ailos)", () => {
    const texto = [...cabeca("349,90"), "Lançamentos", "07 MAI ACADEMIA EXEMPLO", "17/18 CIDADE R$ 69,90", "04 JUL LOJA EXEMPLO", "03/05 PENHA R$ 280,00"].join("\n");
    const txns = compras(lerFaturaTestando(texto, 2026));
    expect(txns.map((t) => [t.date, t.amount])).toEqual([["2026-05-07", 69.9], ["2026-07-04", 280]]);
  });

  it("traço da coluna vazia não é menos, o '+' de poucas linhas é o crédito e o valor ao lado do beneficiário vale (Inter)", () => {
    const texto = [
      ...cabeca("80,00"),
      "Data \tMovimentação \tBeneficiário \tValor",
      "09 de out. 2025 PIX CRED PARCELADO (Parcela 03 de 04)",
      "Principal (R$ 25,79) + Juros (R$ 4,21)",
      "PESSOA EXEMPLO \tR$ 30,00",
      "15 de set. 2026 LOJA EXEMPLO \t- \tR$ 40,00",
      "16 de set. 2026 OUTRA LOJA \t- \tR$ 30,00",
      "06 de ago. 2026 LOJA ESTORNO \t- \t+ R$ 20,00",
    ].join("\n");
    expect(valores(lerFaturaTestando(texto, 2026))).toEqual([30, 40, 30, -20]);
  });

  it("linha ao contrário: valor, descrição e a data no fim, às vezes duas na linha (BTG)", () => {
    const texto = [
      "Olá! Esta é a fatura do seu cartão Banco Exemplo",
      "fatura de Setembro de 2026 | cartão final 0000",
      "Vencimento: 15/09",
      "Total de compras e despesas R$ 300,00",
      "Total de créditos recebidos",
      "- R$ 12,16\tBenefício do cartão\t24 Ago - R$ 39,90\tCrédito Parcelamento\t10 Set",
      "Total de compras e despesas",
      "R$ 107,79\tFarmacia Exemplo (5/5)\t24 Abr",
      "R$ 92,21\tLoja Exemplo\t28 Dez",
      "R$ 100,00\tMercado Exemplo\t15 Ago",
    ].join("\n");
    const txns = compras(lerFaturaTestando(texto, 2026));
    expect(txns.map((t) => t.amount)).toEqual([-12.16, -39.9, 107.79, 92.21, 100]);
    expect(txns.find((t) => t.amount === 92.21)?.date).toBe("2025-12-28");
  });

  it("entre as leituras que fecham, fica a que explica mais linhas (compra e estorno que se anulam)", () => {
    const texto = [
      ...cabeca("100,00"),
      "Lançamentos",
      "21/08/2026 \tEst Compra Exterior USD 0.99",
      "= USD 0.99 Cotação dolar R$ 5.3930",
      "-5,34\tLOJA EXTERIOR",
      "21/08/2026 \tCompra Exterior USD 0.99",
      "Cotação dolar R$ 5.3930",
      "5,34\tLOJA EXTERIOR",
      "22/08/2026 \tCompra a Vista \t100,00\tMERCADO EXEMPLO",
    ].join("\n");
    expect(valores(lerFaturaTestando(texto, 2026))).toEqual([-5.34, 5.34, 100]);
  });
});
