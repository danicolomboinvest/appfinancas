import { describe, expect, it } from "vitest";
import { conferirLeitura } from "../conferencia";
import { isFaturaSummaryLine } from "../fatura-lines";
import { parseStatementComLeitor, type ParsedTransaction } from "../statement-parser";

const soma = (txns: ParsedTransaction[]) => Math.round(txns.reduce((s, t) => s + t.amount, 0) * 100) / 100;
const lerFatura = (texto: string) => {
  const { txns, leitor } = parseStatementComLeitor(texto, "pdf", 2026);
  const semResumo = txns.filter((t) => !isFaturaSummaryLine(t));
  return { txns: semResumo, leitor, conf: conferirLeitura(texto, "fatura", semResumo) };
};

/** Fatura FICTÍCIA com a estrutura do PDF dos Cartões Caixa. */
const CAIXA = [
  "6550.XXXX.XXXX.0000",
  "PESSOA EXEMPLO",
  "VENCIMENTO",
  "17/09/2026",
  "VALOR TOTAL DESTA FATURA",
  "R$ 500,00",
  "MÍNIMO**",
  "R$ 75,00",
  "2X R$ 260,00 R$ 255,00 R$ 500,00/99,50% R$ 2,50/0,50% 8,40%/163,24% 186,16% R$ 515,00 R$ 502,50/100,00%",
  "CARTÕES CAIXA - 00.360.305/0001-04",
  "17/09/2026",
  "104-0",
  "CPF/CNPJ Beneficiário",
  "Vencimento",
  "500,00",
  "Limite Total -----------------------------",
  "R$ 5.000,00",
  "Melhor data para compra: 08/10/2026",
  "Saldo previsto próxima fatura: R$300,00 (Contempla as despesas",
  "que vencem no próximo mês aprovadas até dia 04/09/2026.)",
  "DESPESAS A VENCER: R$900,00",
  "Demonstrativo",
  "Data Descrição Cidade/País Valor U$$ Crédito/Débito",
  "07/08 TOTAL DA FATURA ANTERIOR 400,00D",
  "10/08 OBRIGADO PELO PAGAMENTO 400,00C",
  "17/08 AJUSTE CREDITO PARC. LOJISTA 0,10C",
  "Total 0,10 C",
  "COMPRAS (Cartão 1111)",
  "14/08 LOJA EXEMPLO Rio de Janeir 200,10D",
  "Total COMPRAS 200,10D",
  "COMPRAS PARCELADAS (Cartão 1111)",
  "08/10 LOJA PARCELADA 11 DE 12 SAO PAULO 100,00D",
  "18/08 JOALHERIA EXEMPLO 01 DE 10 SAO PAULO 200,00D",
  "Total COMPRAS PARCELADAS 300,00D",
  "Total final (cartão 1111) 500,10D",
  "Valor total desta fatura R$ 500,00 D",
].join("\n");

describe("fatura dos Cartões Caixa em PDF", () => {
  it("lê só o demonstrativo e fecha com o total", () => {
    const { txns, leitor, conf } = lerFatura(CAIXA);
    expect(leitor).toBe("caixa-fatura");
    // Boleto (17/09 500,00) e "DESPESAS A VENCER" ficam fora; pagamento e saldo anterior também.
    expect(txns).toHaveLength(4);
    expect(soma(txns)).toBe(500);
    expect(conf.status).toBe("fechou");
  });

  it("parcela de mês depois do vencimento é do ano anterior; crédito sai negativo", () => {
    const { txns } = lerFatura(CAIXA);
    expect(txns.find((t) => t.description.startsWith("LOJA PARCELADA"))?.date).toBe("2025-10-08");
    expect(txns.find((t) => t.description.startsWith("AJUSTE"))?.amount).toBe(-0.1);
  });
});

/** Fatura FICTÍCIA com a estrutura do PDF do cartão Porto Seguro. */
const PORTO = [
  "Pessoa Exemplo",
  "Cartão 4152 74** **** *000",
  "Esta fatura vence em",
  "20/09/2026",
  "O valor total é",
  "R$ 350,00",
  "Pagamento mínimo de",
  "R$ 17,50",
  "com seguro 24x de R$ 21,00",
  "Total: R$ 504,00",
  "Despesas/débitos (+) R$ 350,00",
  "Detalhamento",
  "da fatura",
  "Lançamentos: compras e saques",
  "Pessoa Exemplo (final *000)",
  "Data Estabelecimento Valor em R$",
  "15/03 LOJA EXEMPLO 405637 06/06 SAO PAUL 300,00",
  "02/09 PADARIA EXEMPLO 50,00",
  "Lançamentos no cartão (final *000) 350,00",
  "10x de R$ 40,00",
  "Total: 400,00",
  "PORTOSEG SA CRED FIN INV - CNPJ 04.862.600/0001-10",
  "Data do Documento Nr do Documento",
  "14/09/2026 4152 74** **** *000 DV N 14/09/2026 109/00000000-1",
  "109 Real 350,00",
].join("\n");

describe("fatura do cartão Porto Seguro em PDF", () => {
  it("lê só os lançamentos do cartão e fecha com o total", () => {
    const { txns, leitor, conf } = lerFatura(PORTO);
    expect(leitor).toBe("porto-fatura");
    expect(txns.map((t) => [t.date, t.amount])).toEqual([
      ["2026-03-15", 300],
      ["2026-09-02", 50],
    ]);
    expect(conf.status).toBe("fechou");
  });
});

/** Extrato FICTÍCIO com a estrutura do PDF da Unicred: saldo ANTES do valor. */
const UNICRED = [
  "Pág. 1\tCENTRAL DE RELACIONAMENTO: Capitais e regiões metropolitanas: 3003 7703 - Demais regiões:",
  "Extrato",
  "PESSOA EXEMPLO - ***.",
  "Coop: 100 - AG: 1000 - Conta: 123456\tPeríodo de 30/09/2026 a 07/10/2026",
  "Saldo em 29/09/2026: R$ 20,00",
  "Lançamentos Saldo (R$)\tData Valor (R$)",
  "30/09/2026 RECEBIMENTO DE TED CTA SALARIO ( Doc.: 1234",
  "/ EMPRESA EXEMPLO ) R$ 3.020,00\tR$ 3.000,00",
  "30/09/2026 DEB MENSALID PREVIDENCIA (",
  "Doc.: 32857 ) R$ 2.820,00\t- R$ 200,00",
  "05/10/2026 DEBITO TRANSFERENCIA PIX ( Doc.: DEB PIX /",
  "FULANO EXEMPLO",
  ")",
  "R$ 2.720,00\t- R$ 100,00",
  "Saldo no final do período R$ 2.720,00",
  "- R$ 500,00\tLançamentos futuros",
  "13/10/2026 DEBITO FATURA- CARTAO VISA (Doc: VISA / Fatura Cartão Visa) - R$ 500,00",
].join("\n");

describe("extrato da Unicred em PDF", () => {
  it("o lançamento é o SEGUNDO número da linha; o agendado fica fora", () => {
    const { txns, leitor } = parseStatementComLeitor(UNICRED, "pdf", 2026);
    expect(leitor).toBe("unicred");
    expect(txns.map((t) => [t.date, t.amount])).toEqual([
      ["2026-09-30", 3000],
      ["2026-09-30", -200],
      ["2026-10-05", -100],
    ]);
    // Saldo inicial + lançamentos = saldo final impresso.
    expect(20 + soma(txns)).toBe(2720);
  });
});

/** Extrato FICTÍCIO com a estrutura do PDF do Itaú, com muito Pix pequeno recebido. */
const ITAU_EXTRATO = [
  "PESSOA EXEMPLO 000.000.000-00 agência: 0000 conta: 000000-0",
  "extrato conta / lançamentos",
  "data lançamentos valor (R$) saldo (R$)",
  "07/10/2026 SALDO DO DIA 0,00",
  "07/10/2026 PIX TRANSF Pessoa07/10 -40,00",
  "06/10/2026 PIX TRANSF AMIGO A06/10 3,50",
  "06/10/2026 PIX TRANSF AMIGO B06/10 3,50",
  "06/10/2026 PIX TRANSF AMIGO C06/10 3,00",
  "06/10/2026 SALDO DO DIA 40,00",
  "05/10/2026 DEP DIN ATM N. 123 100,00",
  "05/10/2026 PIX TRANSF Fulano 05/10 -100,00",
  "05/10/2026 PIX TRANSF AMIGO D05/10 5,00",
  "05/10/2026 PIX TRANSF AMIGO E05/10 5,00",
  "05/10/2026 PIX TRANSF AMIGO F05/10 5,00",
  "05/10/2026 PIX TRANSF AMIGO G05/10 5,00",
  "05/10/2026 PIX TRANSF AMIGO H05/10 5,00",
  "05/10/2026 SALDO DO DIA 30,00",
  "02/10/2026 SALDO DO DIA 5,00",
].join("\n");

describe("extrato Itaú em PDF com poucas saídas", () => {
  it("entrada sem sinal é entrada quando o saldo do dia confirma", () => {
    const txns = parseStatementComLeitor(ITAU_EXTRATO, "pdf", 2026).txns;
    expect(txns.filter((t) => t.amount > 0)).toHaveLength(9);
    expect(txns.filter((t) => t.amount < 0)).toHaveLength(2);
    // De 5,00 (02/10) a 0,00 (07/10).
    expect(soma(txns)).toBe(-5);
  });
});

describe("app Bradesco Cartões com a fatura em aberto", () => {
  it("o saldo da anterior somado no total não acusa leitura errada", () => {
    const texto = [
      "Aplicativo Bradesco Cartões",
      "Situação do Extrato: EM ABERTO",
      "10/10 SALDO ANTERIOR BRL 0,00 0,00 R$ 0,00 1.000,00",
      ". Total da Fatura em Real . . . R$ 1.150,00",
    ].join("\n");
    const txns = [
      { date: "2026-10-04", description: "LANCHONETE", amount: 100 },
      { date: "2026-10-03", description: "MERCADO", amount: 50 },
    ];
    expect(conferirLeitura(texto, "fatura", txns)).toMatchObject({ status: "fechou", esperado: 150 });
  });
});

/** Fatura FICTÍCIA do Itaú espaçada (duas colunas na linha), com cancelamento de parcelas e o
 * repasse de IOF no meio da linha. */
const ITAU_ESPACADO_COM_CANCELAMENTO = [
  "PESSOA EXE MPLO Resumo da fatura em R$",
  "Total da fatura anterior 1.00 0,00",
  "Pagamento efetuado em 01/08/ 2026 -1.00 0,00",
  "L Lançamentos atuais 1.00 2,99",
  "Postagem: 29/08/2026",
  "Vencimento: 08/09/2026 = Total desta fatura 1.00 2,99",
  "Itaú Cartõ es",
  "Pa ga me nt os e fet u ad o s Lanç am ent o s: c o mp ra s e saq ue s",
  "01/08 Pagamento via conta -1.000, 00 04/ 08 AUTO CENT ER EXEM PLO 15 0,00",
  "31/05 LO JA -C 03/1 0 82,4 9 07/08 FARMA CIA EXEMPLO 17 ,51",
  "09/ 07 SERV ICO EXEM 02/05 100,00",
  "01/08 MER CADO EXEMPLO 53 ,90 04/ 08 PIX Ministe rio 01/02 125, 56",
  "29/ 07 CA NC PAR CEL A S 01/02 -50 ,01 Es se s sã o os se us limite s",
  "29/ 07 CA NC PAR CEL A S 02/02 -50 ,00 lim ite, co nsu lte",
  "02/ 08 RESTA URANTE EX 380,54 Co m pr as pa rce la das - pr ó xi ma s fat u ra s",
  "03/08 PA DARIA EX 190 ,00 31/05 LO JA -C 04/ 10 82,4 9",
  "Repasse de IOF em R$ 3,00 contratação, e caso ultrapassem",
  "09/07 SERV ICO EXEM 03/05 99 ,99 04/ 08 PIX Ministe rio 02/02 125, 56",
  "L Tot al dos lançam ent os atuais 1.00 2,99",
].join("\n");

describe("fatura do Itaú espaçada com cancelamento de parcelas", () => {
  it("o cancelamento da 2ª parcela não some e o IOF do meio da linha entra", () => {
    const { txns, leitor, conf } = lerFatura(ITAU_ESPACADO_COM_CANCELAMENTO);
    expect(leitor).toBe("itau-fatura");
    expect(txns.filter((t) => t.amount < 0).map((t) => t.amount)).toEqual([-50.01, -50]);
    expect(txns.some((t) => /IOF/.test(t.description) && t.amount === 3)).toBe(true);
    expect(soma(txns)).toBe(1002.99);
    expect(conf.status).toBe("fechou");
  });
});
