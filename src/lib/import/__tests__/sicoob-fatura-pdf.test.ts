import { describe, expect, it } from "vitest";
import { conferirLeitura } from "../conferencia";
import { isFaturaSummaryLine } from "../fatura-lines";
import { isSicoobInvoice, parseSicoobInvoice } from "../sicoob-fatura-pdf";
import { parseStatementComLeitor } from "../statement-parser";

/** Fatura Sicoobcard fictícia, no layout do PDF real (texto como sai da extração). */
const SICOOB = `VENCIMENTO
PAGAMENTO MÍNIMO
07 JUL 2026
R$ 124,30
de 5	Página 1
Olá, FULANA!
Esta é a fatura de julho
no valor total de R$ 178,71.
3036 - SICOOB EXEMPLO
-- 1 of 5 --
RESUMO DA FATURA
540,83	FATURA ANTERIOR
- 1.094,76	PAGAMENTOS RECEBIDOS
- 0,00	CRÉDITOS INTERNACIONAIS
+ 16,95	ENCARGOS
+ 605,69	DESPESAS/DÉBITOS
+ 110,00	DESPESAS/DÉBITOS INTERNACIONAIS
= 178,71	SALDO TOTAL
DATA DE FECHAMENTO DA FATURA 29/06/2026
-- 3 of 5 --
FULANA DE TAL
REF 29 MAI A 29 JUN
LANÇAMENTOS - SICOOB MASTERCARD GOLD PRO
MOVIMENTAÇÕES DA CONTA
SALDO ANTERIOR R$ 540,83
23 ABR ANUIDADE MASTERCARD
(1234) 02/12 R$ 9,90
23 ABR DESC ANUIDADE USO
MASTER -R$ 9,90
08 JUN PAGAMENTO DEBITO EM
CONTA -R$ 540,83
08 JUN PAGAMENTO-BOLETO
BANCARIO -R$ 540,83
12 JUN PROTEÇÃO PERDA OU
ROUBO R$ 3,20
12 JUN CRÉDITO PROMOÇÃO
SEGURO -R$ 3,20
22 JUN IOF OPERACAO EXTERIOR R$ 3,85
DATA DESCRIÇÃO CIDADE VALOR EM R$
FULANA DE TAL 1234
28 FEV CURSO EXEMPLO DE
04/04 FLORIANOPOLIS R$ 31,50
07 ABR 0697 LOJA EXEMPLO 03/04 SALVADOR R$ 55,05
04 JUN MERCADO EXEMPLO SALVADOR R$ 319,14
10 JUN EC *SERVICO EXEMPLO
01/03 Osasco R$ 200,00
22 JUN ASSINATURA EXEMPLO SAN FRANCISCO
R$ 110,00 U$ 21,40
V.DOL 5,1395 R$ 110,00
TOTAL DE FULANA R$ 715,69
TOTAL R$ 178,71
Veja como você usou seu Sicoob Mastercard Gold Pro
ALIMENTAÇÃO R$ 0,00
DIVERSOS R$ 34,89`;

describe("fatura do cartão Sicoob (PDF)", () => {
  it("reconhece o arquivo", () => {
    expect(isSicoobInvoice(SICOOB)).toBe(true);
    expect(isSicoobInvoice("SICOOB\nEXTRATO CONTA CORRENTE\n08/10 PIX 10,00C")).toBe(false);
  });

  it("lê lançamentos de duas linhas, créditos, compra em dólar uma vez só, e deixa de fora pagamento e pagamento mínimo", () => {
    expect(parseSicoobInvoice(SICOOB, 2026)).toEqual([
      { date: "2026-04-23", description: "ANUIDADE MASTERCARD (1234) 02/12", amount: 9.9 },
      { date: "2026-04-23", description: "DESC ANUIDADE USO MASTER", amount: -9.9 },
      { date: "2026-06-12", description: "PROTEÇÃO PERDA OU ROUBO", amount: 3.2 },
      { date: "2026-06-12", description: "CRÉDITO PROMOÇÃO SEGURO", amount: -3.2 },
      { date: "2026-06-22", description: "IOF OPERACAO EXTERIOR", amount: 3.85 },
      { date: "2026-02-28", description: "CURSO EXEMPLO DE 04/04 FLORIANOPOLIS", amount: 31.5 },
      { date: "2026-04-07", description: "0697 LOJA EXEMPLO 03/04 SALVADOR", amount: 55.05 },
      { date: "2026-06-04", description: "MERCADO EXEMPLO SALVADOR", amount: 319.14 },
      { date: "2026-06-10", description: "EC *SERVICO EXEMPLO 01/03 Osasco", amount: 200 },
      { date: "2026-06-22", description: "ASSINATURA EXEMPLO SAN FRANCISCO", amount: 110 },
    ]);
  });

  it("parcela de antes da virada do ano fica no ano anterior", () => {
    const outubro = SICOOB.replace("29/06/2026", "01/10/2026").replace("23 ABR ANUIDADE", "01 DEZ ANUIDADE");
    expect(parseSicoobInvoice(outubro, 2026)[0].date).toBe("2025-12-01");
  });

  it("é o leitor usado pro PDF, e fecha com encargos + despesas do resumo (não com o saldo total)", () => {
    const { txns, leitor } = parseStatementComLeitor(SICOOB, "pdf", 2026);
    expect(leitor).toBe("sicoob-fatura");
    const linhas = txns.filter((t) => !isFaturaSummaryLine(t));
    expect(conferirLeitura(SICOOB, "fatura", linhas)).toMatchObject({ status: "fechou", esperado: 732.64 });
  });
});
