import { describe, expect, it } from "vitest";
import { isCarrefourInvoice, parseCarrefourInvoice } from "../carrefour-fatura-pdf";
import { conferirLeitura } from "../conferencia";
import { isFaturaSummaryLine } from "../fatura-lines";
import { isItauInvoice, parseItauInvoice } from "../itau-fatura-pdf";
import { parseCsv, parseStatementComLeitor, type ParsedTransaction } from "../statement-parser";

const soma = (txns: ParsedTransaction[]) => Math.round(txns.reduce((s, t) => s + t.amount, 0) * 100) / 100;
const t = (amount: number, description = "LOJA EXEMPLO"): ParsedTransaction => ({ date: "2026-09-10", description, amount });

/** Fatura FICTÍCIA com a estrutura do PDF do Cartão Carrefour (Banco CSF). */
const CARREFOUR = [
  "FATURA MENSAL CARTÃO VISA GOLD TITULAR:Pessoa Exemplo",
  "Valor Total",
  "R$ 900,00",
  "TOTAL DA SUA FATURA VENCIMENTO LIMITE DE CRÉDITO",
  "R$ 230,00 11/09/2026 R$5.000,00",
  "Juros rotativo 19,49% 747,19% 20,42% 830,01%",
  "LANÇAMENTOS NO BRASIL",
  "DATA DESCRIÇÃO VALOR R$",
  "SALDO FATURA ANTERIOR 400,00",
  "PESSOA EXEMPLO 406166******0000",
  "08/08 MERCADO EXEMPLO - 13/15 20,00",
  "05/08 LANCHONETE EXEMPLO, OSASCO 60,00",
  "10/08 Pagamento Banco CSF 400,00-",
  "04/09 Tarifa de Anuidade com desconto -",
  "CARTAO VIRTUAL 406166******1111",
  "19/12 LOJA EXEMPLO,OSASCO-2/3 150,00",
  "TOTAL DA FATURA R$ 230,00",
  "RESUMO DA FATURA EM R$",
  "Total da fatura anterior: R$ 400,00",
  "(+) Pagamentos efetuados/créditos: R$ 400,00",
  "(-) Lançamentos atuais/débitos: R$ 230,00",
  "TOTAL DA FATURA ATUAL: R$ 230,00",
  "Limite de crédito: R$ 5.000,00",
  "Banco CSF S.A. CNPJ: 00.000.000/0001-00",
].join("\n");

describe("fatura do Cartão Carrefour (Banco CSF) em PDF", () => {
  it("reconhece o arquivo", () => {
    expect(isCarrefourInvoice(CARREFOUR)).toBe(true);
  });

  it("lê só os lançamentos, com o pagamento como linha de resumo e o ano certo", () => {
    const txns = parseCarrefourInvoice(CARREFOUR, 2026);
    const compras = txns.filter((x) => !isFaturaSummaryLine(x));
    expect(compras.map((x) => x.amount)).toEqual([20, 60, 150]);
    expect(soma(compras)).toBe(230);
    expect(compras[2].date).toBe("2025-12-19");
    expect(txns.find((x) => x.amount < 0)).toMatchObject({ amount: -400 });
    expect(isFaturaSummaryLine(txns.find((x) => x.amount < 0)!)).toBe(true);
  });

  it("não lê o limite nem a simulação de parcelamento, e fecha com o total", () => {
    const { txns, leitor } = parseStatementComLeitor(CARREFOUR, "pdf", 2026);
    expect(leitor).toBe("carrefour-fatura");
    const compras = txns.filter((x) => !isFaturaSummaryLine(x));
    expect(conferirLeitura(CARREFOUR, "fatura", compras).status).toBe("fechou");
  });
});

/** Fatura FICTÍCIA do Itaú com o texto que o PDF devolve: espaço no meio das palavras e dos
 * números, e as duas colunas na mesma linha. */
const ITAU_ESPACADO = [
  "Platinum",
  "PESSOA EXE MPLO Resumo da fatura em R$",
  "Total da fatura anterior 1.00 0,00",
  "Pagamento efetuado em 01/08/ 2026 -1.00 0,00",
  "L Lançamentos atuais 1.10 0,00",
  "Postagem: 29/08/2026",
  "Vencimento: 08/09/2026 = Total desta fatura 1.10 0,00",
  "Limite total de crédito: R$ 3.000,00",
  "Total a pagar R$ 1.050,00 -",
  "Itaú Cartõ es",
  "Pa ga me nt os e fet u ad o s Lanç am ent o s: c o mp ra s e saq ue s",
  "01/08 Pagamento via conta -1.000, 00 04/ 08 AUTO CENT ER EXEM PLO 15 0,00",
  "DATA ES TAB ELE CIMENTO VA LOR EM R$ su perm erc ado SAO PAULO",
  "31/05 LO JA -C 03/1 0 82,4 9 07/08 FARMA CIA EXEMPLO 17 ,51",
  "09/ 07 SERV ICO EXEM 02/05 100,00",
  "01/08 MER CADO EXEMPLO 53 ,90 04/ 08 PIX Ministe rio 01/02 125, 56",
  "02/ 08 RESTA URANTE EX 380,54 Co m pr as pa rce la das - pr ó xi ma s fat u ra s",
  "03/08 PA DARIA EX 190 ,00 31/05 LO JA -C 04/ 10 82,4 9",
  "09/07 SERV ICO EXEM 03/05 99 ,99 04/ 08 PIX Ministe rio 02/02 125, 56", // parcela seguinte com centavo diferente
  "lazer SAO PAULO Próxima fatu ra 308,05",
  "L Tot al dos lançam ent os atuais 1.10 0,00",
  "Juro s da compra parc elada 5,9 9 % am 102, 95 % aa",
].join("\n");

describe("fatura do Itaú com texto espaçado", () => {
  it("reconhece mesmo com espaço no meio das palavras", () => {
    expect(isItauInvoice(ITAU_ESPACADO)).toBe(true);
  });

  it("lê as compras das duas colunas, sem o quadro das próximas faturas, e fecha no centavo", () => {
    const txns = parseItauInvoice(ITAU_ESPACADO, 2026);
    const compras = txns.filter((x) => !isFaturaSummaryLine(x));
    expect(compras.map((x) => x.amount)).toEqual([150, 82.49, 17.51, 100, 53.9, 125.56, 380.54, 190]);
    expect(soma(compras)).toBe(1100);
    expect(compras[1].date).toBe("2026-05-31");
    expect(txns.some((x) => x.amount === -1000)).toBe(true);
    expect(conferirLeitura(ITAU_ESPACADO, "fatura", compras).status).toBe("fechou");
  });
});

describe("conferência pelo resumo: anterior − pagamento + mês = total", () => {
  it("fatura com crédito de renegociação (Nubank) fecha pela conta do resumo", () => {
    const texto = [
      "RESUMO DA FATURA ATUAL",
      "Fatura anterior R$ 1.000,00",
      "Pagamento recebido −R$ 800,00",
      "Crédito de parcelamento −R$ 500,00",
      "Total de compras de todos os cartões, 02 SET a 02 OUT R$ 900,00",
      "Total a pagar R$ 600,00",
    ].join("\n");
    const txns = [t(900), t(-500, "Crédito de parcelamento")];
    expect(conferirLeitura(texto, "fatura", txns).status).toBe("fechou");
  });

  it("fatura com encargos de atraso (Riachuelo) fecha somando os encargos", () => {
    const texto = ["Saldo Anterior 100,00", "Pagamentos/Créditos - 110,00", "Encargos + 10,00", "Despesas/Débitos no Brasil + 200,00", "Saldo desta Fatura 200,00"].join("\n");
    expect(conferirLeitura(texto, "fatura", [t(200), t(10, "JUROS DE MORA")]).status).toBe("fechou");
  });

  it("faltando compra de verdade, continua não fechando", () => {
    const texto = ["Fatura anterior R$ 1.000,00", "Pagamento recebido −R$ 1.000,00", "Total a pagar R$ 600,00"].join("\n");
    expect(conferirLeitura(texto, "fatura", [t(300)]).status).toBe("nao-fechou");
  });
});

describe("CSV exportado pelo próprio app, subido de volta", () => {
  it("Gasto e Aporte saem como saída, Renda e Resgate como entrada", () => {
    const csv = [
      "Perfil;Ano;Mês;Data;Tipo;Categoria;Subcategoria;Descrição;Valor",
      "Casal;2026;8;31/08/2026;Aporte;;;APLICACAO EXEMPLO;500",
      "Casal;2026;8;31/08/2026;Gasto;Lazer;;PIX LOJA EXEMPLO;100,23",
      "Casal;2026;8;30/08/2026;Renda;;;PIX RECEBIDO EXEMPLO;1886,62",
      "Casal;2026;8;29/08/2026;Resgate;;;RESGATE EXEMPLO;50",
    ].join("\n");
    const txns = parseCsv(csv, 2026);
    expect(txns.map((x) => x.amount)).toEqual([-500, -100.23, 1886.62, 50]);
    expect(txns[1].description).toBe("PIX LOJA EXEMPLO");
  });
});

describe("extrato Itaú em PDF: rendimento da aplicação automática", () => {
  it('"REND PAGO APLIC AUT MAIS" é entrada, não gasto', () => {
    const texto = [
      "extrato conta / lançamentos",
      "data lançamentos valor (R$) saldo (R$)",
      "05/01/2026 PIX TRANSF EXEMPLO05/01 -4,00",
      "05/01/2026 REND PAGO APLIC AUT MAIS 0,04",
    ].join("\n");
    const { txns } = parseStatementComLeitor(texto, "pdf", 2026);
    expect(txns.map((x) => x.amount)).toEqual([-4, 0.04]);
  });
});

/** Fatura FICTÍCIA com a estrutura do PDF do cartão Nomad: o rodapé "Valor da fatura" se repete
 * em toda página, com a data de vencimento logo acima. */
const NOMAD = [
  "Resumo da sua fatura",
  "Saldo da fatura anterior R$ 0,00",
  "Despesas e créditos do mês R$ 330,00",
  "Valor da fatura R$ 330,00",
  "Parcelamentos para aliviar seu bolso",
  "Total a pagar: R$ 360,00",
  "Extrato Referente ao mês de Setembro de 2026",
  "Data Descrição Valor",
  "29/08/2026 LOJA EXEMPLO CIDADE BR R$ 30,00",
  "11/09/2026 RESTAURANTE EXEMPLO MIAMI FL (US$ 37,33 US$1.00 = R$ 5,3149) R$ 198,41",
  "Data de vencimento",
  "05/10/2026",
  "Mês de referência: Setembro",
  "Valor da fatura",
  "R$ 330,00",
  "Data Descrição Valor",
  "14/09/2026 IOF SOBRE TRANSACAO INTERNACIONAL R$ 6,94",
  "15/09/2026 LOJA DEVOLUCAO EXEMPLO -R$ 5,35",
  "16/09/2026 MERCADO EXEMPLO CIDADE BR R$ 100,00",
  "Data de vencimento",
  "05/10/2026",
  "Mês de referência: Setembro",
  "Valor da fatura",
  "R$ 330,00",
  "(11) 0000-0000 - support@nomadglobal.com",
].join("\n");

describe("fatura do cartão Nomad em PDF", () => {
  it("não lança o rodapé 'Valor da fatura' e fecha com o total do mês", () => {
    const { txns, leitor } = parseStatementComLeitor(NOMAD, "pdf", 2026);
    expect(leitor).toBe("nomad-fatura");
    expect(txns.map((x) => x.amount)).toEqual([30, 198.41, 6.94, -5.35, 100]);
    expect(conferirLeitura(NOMAD, "fatura", txns).status).toBe("fechou");
  });
});
