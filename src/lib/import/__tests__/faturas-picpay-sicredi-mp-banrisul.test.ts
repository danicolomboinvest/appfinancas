import { describe, expect, it } from "vitest";
import { parseStatementComLeitor } from "../statement-parser";
import { conferirLeitura } from "../conferencia";
import { isFaturaSummaryLine } from "../fatura-lines";
import { detectDocKind, periodoSemMovimento } from "../detect";

/** Lê como o app lê uma fatura em PDF e confere com o total impresso. */
function lerFatura(texto: string) {
  const { txns, leitor } = parseStatementComLeitor(texto, "pdf", 2026);
  const semResumo = txns.filter((t) => !isFaturaSummaryLine(t));
  return { leitor, txns: semResumo, conf: conferirLeitura(texto, "fatura", semResumo) };
}

// Todas as amostras abaixo são FICTÍCIAS, com a mesma estrutura do PDF de cada banco.

const PICPAY = [
  "PESSOA DE EXEMPLO,",
  "15/09/2026 | 09/09/2026\tVencimento: Fechamento:",
  "PicPay Mastercard® GOLD",
  "Despesas do mês 230,00",
  "Total da fatura R$ 119,00",
  "Data Estabelecimento Valor (R$)",
  "07/08 CRED COMPRA PARC",
  "CONTESTADA -11,00",
  "14/08 PAGAMENTO DE FATURA -500,00",
  "15/08 IOF COMPRA INTERNACIONAL 0,70",
  "Transações Internacionais",
  "Data Estabelecimento US$ R$",
  "15/08 PAYU*AR*UBER",
  "Peso argentino: 32.211,00",
  "Câmbio do dia: R$ 5,48",
  "3,69 20,30",
  "Subtotal dos lançamentos 21,00",
  "Picpay Card final 0000",
  "Data Estabelecimento Valor (R$)",
  "23/12 LOJA EXEMPLO PARC02/03 209,00",
  "Subtotal dos lançamentos 209,00",
  "Total geral dos lançamentos 230,00",
].join("\n");

const SICREDI = [
  "Pessoa Exemplo",
  "Total fatura de setembro R$ 140,00",
  "Pagamento mínimo (R$) R$ 60,00",
  "Entrada de R$ 531,62 + 1X R$ 531,62",
  "Total: R$ 1.063,24 (CET de 164,39% a.a.)",
  "Despesas atuais | Débitos no Brasil 140,00",
  "Total desta Fatura 140,00",
  "Vencimento 10/09/2026",
  "Data e hora Cidade Compra Descrição Parcela Valor em Dolar",
  "17/ago 06:15 Sao Paulo Online Apple Com/bill R$ 14,99",
  "17/ago 23:10 Iof Complementar S/ Saldo Ro-",
  "tativo R$ 0,21",
  "10/ago 13:40 Pagamento Em Dinheiro Na",
  "Loja -R$ 600,00",
  "10/ago 22:22 Cred P Fat Ent -R$ 300,00",
  "25/dez 23:29 Cob Anuidade 9/12 R$ 124,80",
  "Total cartão (final 0000) R$ 140,00",
  "Legenda: Artigos Roupas",
  "Utilizar sicredi.com.br",
].join("\n");

const MERCADO_PAGO = [
  "Pessoa Exemplo",
  "Total a pagar",
  "R$ 100,00",
  "Consumos de 10/08 a 09/09 R$ 150,00",
  "Total R$ 100,00",
  "Pague sua fatura pelo app Mercado Pago",
  "Vencimento: 14/09/2026",
  "Movimentações na fatura",
  "Data Movimentações Valor em R$",
  "14/08 Pagamento da fatura de agosto/2026 R$ 298,20",
  "31/08 Crédito concedido R$ 50,00",
  "Cartão Visa [************0000]",
  "Data Movimentações Valor em R$",
  "20/03 MERCADOLIVRE*PRODUTOS Parcela 6 de 6 R$ 100,00",
  "31/08 MERCADOLIVRE*FRETE R$ 50,00",
  "Total R$ 150,00",
  "Vencimento: Compras internacionais Para fazer a conversão, utilizamos a cotação. IOF -R$ 3,50",
].join("\n");

const BANRISUL_FATURA = [
  "Beneficiário BANRISUL S.A. CARTÕES DE CRÉDITO",
  "(+) Despesas / Débitos no Brasil 500,00",
  "Total da Fatura: R$ 500,00",
  "Vencimento: 02/10/2026",
  "VALOR TOTAL",
  "R$ 500,00",
  "HISTÓRICO DE TRANSAÇÕES",
  "PESSOA - NR. 0000 US$ R$",
  "23/07 LOJA EXEMPLO FL 433 02/02 300,00",
  "02/09 DEB 0000/35 00000000 -9.332,25",
  "19/09 CAFE FICTICIO SANTA CRUZ 200,00",
  "TOTAL DE GASTOS 500,00",
].join("\n");

describe("fatura PicPay em PDF", () => {
  it("lê o valor cobrado em reais (não o valor em peso) e fecha com as despesas do mês", () => {
    const { leitor, txns, conf } = lerFatura(PICPAY);
    expect(leitor).toBe("picpay-fatura");
    expect(txns.find((t) => t.description === "PAYU*AR*UBER")?.amount).toBe(20.3);
    expect(txns.find((t) => t.description === "CRED COMPRA PARC CONTESTADA")?.amount).toBe(-11);
    // Compra de dezembro numa fatura que fecha em setembro é do ano anterior.
    expect(txns.find((t) => t.description.startsWith("LOJA EXEMPLO"))?.date).toBe("2025-12-23");
    expect(conf.status).toBe("fechou");
  });
});

describe("fatura Sicredi em PDF", () => {
  it("ignora as ofertas de parcelamento, junta a descrição quebrada e fecha", () => {
    const { leitor, txns, conf } = lerFatura(SICREDI);
    expect(leitor).toBe("sicredi-fatura");
    expect(txns.map((t) => [t.date, t.description, t.amount])).toEqual([
      ["2026-08-17", "Apple Com/bill", 14.99],
      ["2026-08-17", "Iof Complementar S/ Saldo Rotativo", 0.21],
      ["2026-08-10", "Pagamento Em Dinheiro Na Loja", -600],
      ["2025-12-25", "Cob Anuidade 9/12", 124.8],
    ]);
    expect(conf.status).toBe("fechou");
  });
});

describe("fatura Mercado Pago em PDF", () => {
  it("crédito concedido é devolução, compra é compra, e o rodapé fica de fora", () => {
    const { leitor, txns, conf } = lerFatura(MERCADO_PAGO);
    expect(leitor).toBe("mercado-pago-fatura");
    expect(txns.map((t) => [t.description, t.amount])).toEqual([
      ["Crédito concedido", -50],
      ["MERCADOLIVRE*PRODUTOS Parcela 6 de 6", 100],
      ["MERCADOLIVRE*FRETE", 50],
    ]);
    expect(conf.status).toBe("fechou");
  });
});

describe("fatura Banrisul em PDF", () => {
  it("não lê o boleto como compra e o débito da fatura anterior fica de fora", () => {
    const { leitor, txns, conf } = lerFatura(BANRISUL_FATURA);
    expect(leitor).toBe("banrisul-fatura");
    expect(txns.map((t) => t.amount)).toEqual([300, 200]);
    expect(conf).toMatchObject({ status: "fechou", esperado: 500 });
  });
});

describe("fatura Nubank com 'Outros lançamentos'", () => {
  it("compras + outros lançamentos também é uma conta que fecha", () => {
    const texto = [
      "Olá, Pessoa.",
      "RESUMO DA FATURA ATUAL",
      "Fatura anterior R$ 500,00",
      "Pagamento recebido −R$ 500,00",
      "Total de compras de todos os cartões, 25 AGO a 24 SET R$ 100,00",
      "Outros lançamentos R$ 20,00",
      "Total a pagar R$ 120,00",
      "O Nubank declara, nos termos da Lei 12.007 2009, que os débitos foram quitados.",
    ].join("\n");
    const txns = [
      { date: "2026-09-01", description: "Loja", amount: 100 },
      { date: "2026-09-02", description: "IOF", amount: 20 },
      { date: "2026-08-27", description: "Estorno de pagamento", amount: -10 },
    ];
    expect(conferirLeitura(texto, "fatura", txns).status).toBe("fechou");
  });
});

describe("arquivo de um período sem movimentação", () => {
  it("reconhece o PDF do Nubank, o CSV só com cabeçalho e o OFX sem lançamento", () => {
    expect(periodoSemMovimento("Saldo final do período\nR$ 1,98\nNenhuma movimentação realizada.")).toBe(true);
    expect(periodoSemMovimento("Data,Valor,Identificador,Descrição\n")).toBe(true);
    expect(periodoSemMovimento("OFXHEADER:100\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><LEDGERBAL><BALAMT>1.98</BALAMT></LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>")).toBe(true);
  });

  it("não confunde com arquivo que tem lançamento", () => {
    expect(periodoSemMovimento("Data,Valor,Identificador,Descrição\n01/10/2026,-10.00,abc,Padaria")).toBe(false);
    expect(periodoSemMovimento("<OFX><STMTTRN><TRNAMT>-10.00</TRNAMT></STMTTRN></OFX>")).toBe(false);
  });
});

describe("fatura do app Bradesco Cartões em PDF", () => {
  const BRADESCO_APP = [
    "XXXX.XXXX.XXXX.0000",
    "Aplicativo Bradesco Cartões",
    "Data: 02/10/2026 - 09:00",
    "Situação do Extrato: EM ABERTO",
    "PESSOA EXEMPLO - THE PLATINUM CARD",
    "Data Histórico Moeda de",
    "origem US$ Cotação",
    "US$ R$",
    "25/09 PADARIA EXEMPLO BRL 24,99 0,00 R$ 0,00 24,99",
    "22/09 FARMACIA FICTICIA 1/3 BRL 99,36 0,00 R$ 0,00 33,12",
    "21/09 PAGTO ANTECIPADO PIX BRL",
    "-500,00 0,00 R$ 0,00 -500,00",
    "20/09 SALDO ANTERIOR BRL 0,00 0,00 R$ 0,00 500,00",
    "17/09 LOJA DE NOME LONGO 1",
    "/4",
    "BRL",
    "400,00 0,00 R$ 0,00 100,00",
    "17/12 OFICINA EXEMPLO 10/10 BRL",
    "2.000,00 0,00 R$ 0,00 200,00",
    ". Total para PESSOA EXEMPLO",
    "B . . . R$ 358,11",
    ". Total da Fatura em Real . . . R$ 358,11",
  ].join("\n");

  it("é fatura (não extrato), pega o valor cobrado da parcela, deixa o pagamento de fora e fecha", () => {
    const { leitor, txns, conf } = lerFatura(BRADESCO_APP);
    expect(leitor).toBe("bradesco-cartoes-app");
    expect(txns.map((t) => [t.date, t.description, t.amount])).toEqual([
      ["2026-09-25", "PADARIA EXEMPLO", 24.99],
      ["2026-09-22", "FARMACIA FICTICIA 1/3", 33.12],
      ["2026-09-17", "LOJA DE NOME LONGO 1/4", 100],
      ["2025-12-17", "OFICINA EXEMPLO 10/10", 200],
    ]);
    expect(conf).toMatchObject({ status: "fechou", esperado: 358.11 });
    expect(detectDocKind(BRADESCO_APP).kind).toBe("fatura");
  });
});

describe("pagamento antecipado da fatura", () => {
  it("é pagamento do cartão, nunca compra — com ou sem sinal", () => {
    for (const description of ["PAGTO ANTECIPADO PIX", "PAGTO ANTECIPADO PIX -", "Pagamento antecipado"]) {
      expect(isFaturaSummaryLine({ date: "2026-09-21", description, amount: 7353.58 })).toBe(true);
    }
    expect(isFaturaSummaryLine({ date: "2026-09-21", description: "LOJA ANTECIPA LTDA", amount: 50 })).toBe(false);
  });
});
