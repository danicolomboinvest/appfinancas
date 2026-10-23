import { describe, expect, it } from "vitest";
import { conferirLeitura } from "../conferencia";
import { isFaturaSummaryLine } from "../fatura-lines";
import { isItauInvoice, parseItauInvoice } from "../itau-fatura-pdf";
import { parseStatement } from "../statement-parser";

/**
 * Fatura FICTÍCIA com a mesma estrutura do PDF do cartão Itaú: boleto e resumo no topo (com o
 * pagamento anterior numa linha com data completa), pagamento, compras com a linha de categoria
 * embaixo, compra no exterior com a moeda de origem na linha de baixo, repasse de IOF sem data,
 * anuidade, o total e, DEPOIS dele, o quadro das parcelas das próximas faturas.
 */
const ITAU = [
  "Banco Itaú S.A.",
  "Resumo da fatura em R$",
  "Total da fatura anterior 1.000,00",
  "Pagamento efetuado em 04/09/2026 -1.000,00",
  "Lançamentos atuais 340,77",
  "Total desta fatura 340,77",
  "O total da sua fatura é:",
  "R$ 340,77",
  "Emissão: 26/09/2026",
  "-- 1 of 3 --",
  "Pagamentos efetuados",
  "DATA VALOR EM R$",
  "04/09 Pagamento via conta -1.000,00",
  "Total dos pagamentos -1.000,00",
  "Lançamentos: compras e saques",
  "PESSOA EXEMPLO",
  "DATA ESTABELECIMENTO VALOR EM R$",
  "09/12 LOJA ANTIGA 10/10 50,00",
  "outros SAO PAULO",
  "15/09 MERCADO EXEMPLO 120,00",
  "supermercado BELO HORIZONT",
  "16/09 LOJA ESTORNO -20,00",
  "outros SAO PAULO",
  "Lançamentos no cartão 150,00",
  "Lançamentos internacionais",
  "PESSOA EXEMPLO",
  "DATA ESTABELECIMENTO US$ R$",
  "29/08 FARMACIA EXEMPLO 100,00",
  "200,00 BOB 18,00",
  "Dólar de Conversão R$ 5,50",
  "Total transações inter. em R$ 100,00",
  "Repasse de IOF em R$ 3,50",
  "Total lançamentos inter. em R$ 103,50",
  "Lançamentos: produtos e serviços",
  "DATA PRODUTOS/SERVIÇOS VALOR EM R$",
  "26/08 Anuidade Diferenciada 87,27",
  "Lançamentos produtos e serviços 87,27",
  "Total dos lançamentos atuais 340,77",
  "Compras parceladas - próximas faturas",
  "DATA ESTABELECIMENTO VALOR EM R$",
  "15/09 MERCADO EXEMPLO 02/02 60,00",
  "01/09 LOJA PARCELADA 02/03 99,90",
  "Próxima fatura 159,90",
].join("\n");

describe("fatura do cartão Itaú (PDF)", () => {
  it("reconhece o arquivo, e não confunde com extrato", () => {
    expect(isItauInvoice(ITAU)).toBe(true);
    expect(isItauInvoice("Itaú\nExtrato de Conta Corrente\n01/09/2026 PIX 10,00")).toBe(false);
  });

  it("lê compras, estorno, exterior, IOF e anuidade — e para antes das próximas faturas", () => {
    expect(parseItauInvoice(ITAU, 2026)).toEqual([
      { date: "2026-09-04", description: "Pagamento via conta", amount: -1000 },
      { date: "2025-12-09", description: "LOJA ANTIGA 10/10", amount: 50, categoriaDoBanco: "outros" },
      { date: "2026-09-15", description: "MERCADO EXEMPLO", amount: 120, categoriaDoBanco: "supermercado" },
      { date: "2026-09-16", description: "LOJA ESTORNO", amount: -20, categoriaDoBanco: "outros" },
      { date: "2026-08-29", description: "FARMACIA EXEMPLO", amount: 100 },
      { date: "2026-09-26", description: "Repasse de IOF (compras no exterior)", amount: 3.5 },
      { date: "2026-08-26", description: "Anuidade Diferenciada", amount: 87.27 },
    ]);
  });

  it("a linha de categoria fica na compra de cima, e a moeda de origem (200,00 BOB) não vira categoria", () => {
    const farmacia = parseItauInvoice(ITAU, 2026).find((t) => t.description === "FARMACIA EXEMPLO");
    expect(farmacia?.categoriaDoBanco).toBeUndefined();
  });

  it("sem o pagamento, a leitura fecha com o total da fatura", () => {
    const linhas = parseStatement(ITAU, "pdf", 2026).filter((t) => !isFaturaSummaryLine(t));
    expect(linhas.some((t) => t.description.includes("02/0"))).toBe(false);
    expect(conferirLeitura(ITAU, "fatura", linhas)).toMatchObject({ status: "fechou", esperado: 340.77 });
  });
});

/** Duas colunas na mesma linha, e um código de reserva terminado em número logo antes do valor
 * ("29PXY7 6,00"): o remendo de número quebrado colava os dois em "76,00" (fatura real de 11/10/2026,
 * R$ 15.058 lida como R$ 7.285 e com as descrições trocadas). */
const ITAU_DUAS_COLUNAS = `Itaú Cartões
Postagem: 31/07/2026 L Lançamentos atuais 252,00
Lançamentos: compras e saques Lançamentos: compras e saques
DATA ESTABELECIMENTO VALOR EM R$ VESTUÁRIO .SANTO ANDRE
20/07 LOJA EXEMPLO 100,00 25/07 PADARIA EXEMPLO 20,00
VESTUÁRIO .SAO PAULO ALIMENTAÇÃO .SAO PAULO
29/07 ZUL 6 cartoes 29ABC7 6,00 16/07 PARQUE EXEMPLO 126,00
VEÍCULOS .SAO PAULO TURISMO E ENTRETENIM.SAO PAULO
L Total dos lançamentos atuais 252,00`;

describe("fatura do cartão Itaú em duas colunas", () => {
  it("lê as duas compras de cada linha, sem colar o código de reserva no valor", () => {
    const txns = parseItauInvoice(ITAU_DUAS_COLUNAS, 2026);
    expect(txns).toContainEqual({ date: "2026-07-29", description: "ZUL 6 cartoes 29ABC7", amount: 6 });
    expect(txns).toContainEqual({ date: "2026-07-16", description: "PARQUE EXEMPLO", amount: 126 });
    expect(txns.reduce((s, t) => s + t.amount, 0)).toBeCloseTo(252);
  });
});

/**
 * Fatura FICTÍCIA no formato esfarelado (espaço no meio de palavras e números, duas colunas na
 * mesma linha) com o quadro das próximas faturas no FIM, e parcelas seguintes de valor diferente
 * da parcela do mês (caso real de 22/10/2026: R$ 2.644 lidos de uma fatura de R$ 7.906, porque a
 * parcela 02/03 de R$ 560,86 entrava como compra do mês e o título do quadro estava esfarelado).
 */
const ITAU_ESFARELADO = `1
Platinum Itaú Cartões
Postagem: 03/09/2026
Vencimento: 10/09/2026 = Total desta fatura 600 ,00
Emissão: 03/09/2026
Pagamentos efetuados Lançamentos: compras e saques
DATA VA LOR EM R$ DAT A ESTA BE LECIME NT O VAL OR EM R$
03/08 Pagamento via conta -1.000 ,00 20/08 LOJA EX EMPLO UM 100,0 0
02/ 08 VIAGEM EX EMPLO 01/ 03 300, 00 23/08 REST AURANTE EXEM PLO 50 ,00
06/ 08 FARM ACIA EXEM PLO 150,00
L Total dos lançam ent os atuais 600 ,00
C om p ras p ar cel ad as - p ró x im as fa tur as
DATA ESTA BEL ECIMENTO VA LOR EM R$
02/ 08 VIAGEM EX EMPLO 02/ 03 280, 00
Próxima fat ura 280,00`;

describe("fatura do cartão Itaú esfarelada, com o quadro das próximas no fim", () => {
  it("corta o quadro pelo título esfarelado e fecha no centavo com o total do mês", () => {
    const txns = parseStatement(ITAU_ESFARELADO, "pdf", 2026);
    const compras = txns.filter((t) => !isFaturaSummaryLine(t));
    expect(compras.reduce((s, t) => s + t.amount, 0)).toBeCloseTo(600);
    expect(compras.some((t) => t.amount === 280)).toBe(false);
    expect(compras.some((t) => t.amount === 300)).toBe(true);
    expect(conferirLeitura(ITAU_ESFARELADO, "fatura", compras)).toMatchObject({ status: "fechou" });
  });
});
