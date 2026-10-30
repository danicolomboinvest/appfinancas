import { describe, expect, it } from "vitest";
import { conferirLeitura } from "../conferencia";
import { detectDocKind } from "../detect";
import { normalizarTextoEuropeu } from "../texto-europeu";
import { parseStatement, parseStatementComLeitor } from "../statement-parser";
import { isWiseStatement, saldosDoExtratoWise } from "../wise-extrato-pdf";

/**
 * Importação para quem ganha em euro (23/10/2026): CSV e PDF dos bancos de lá, com as colunas, as
 * datas e o dinheiro do jeito do país. Amostras FICTÍCIAS no formato de cada banco; o número de
 * lançamentos esperado é o das linhas de dados, e cada uma tem de entrar com o sinal certo.
 */

const CSV: Record<string, string> = {
revolut: `Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
CARD_PAYMENT,Current,2026-10-01 08:12:44,2026-10-02 10:00:01,Lidl Berlin,-23.45,0.00,EUR,COMPLETED,976.55
TOPUP,Current,2026-10-03 09:00:00,2026-10-03 09:00:05,Top-Up by *1234,500.00,0.00,EUR,COMPLETED,1476.55
TRANSFER,Current,2026-10-04 12:00:00,2026-10-04 12:10:00,To Maria Silva,-200.00,0.00,EUR,COMPLETED,1276.55
CARD_PAYMENT,Current,2026-10-05 19:30:00,2026-10-06 07:00:00,Uber *Trip,-12.80,0.00,EUR,COMPLETED,1263.75`,
n26: `"Booking Date","Value Date","Partner Name","Partner Iban",Type,"Payment Reference","Account Name","Amount (EUR)","Original Amount","Original Currency","Exchange Rate"
"2026-10-01","2026-10-01","REWE Markt","","Presentment","","Main Account","-34.20","","",""
"2026-10-02","2026-10-02","Arbeitgeber GmbH","DE89370400440532013000","Income","Gehalt Oktober","Main Account","2450.00","","",""
"2026-10-03","2026-10-03","Netflix","","Presentment","","Main Account","-12.99","","",""`,
sparkasse: `"Auftragskonto";"Buchungstag";"Valutadatum";"Buchungstext";"Verwendungszweck";"Beguenstigter/Zahlungspflichtiger";"Kontonummer";"BLZ";"Betrag";"Waehrung";"Info"
"DE89370400440532013000";"01.10.26";"01.10.26";"KARTENZAHLUNG";"EDEKA Berlin";"EDEKA";"";"";"-45,67";"EUR";"Umsatz gebucht"
"DE89370400440532013000";"02.10.26";"02.10.26";"GEHALT";"Gehalt 10/2026";"Firma AG";"";"";"2.350,00";"EUR";"Umsatz gebucht"
"DE89370400440532013000";"05.10.26";"05.10.26";"MIETE";"Miete Oktober";"Vermieter";"";"";"-950,00";"EUR";"Umsatz gebucht"`,
ingnl: `"Datum";"Naam / Omschrijving";"Rekening";"Tegenrekening";"Code";"Af Bij";"Bedrag (EUR)";"Mutatiesoort";"Mededelingen"
"20261001";"Albert Heijn 1234";"NL12INGB0001234567";"";"BA";"Af";"23,45";"Betaalautomaat";"Pasvolgnr: 001"
"20261002";"Werkgever BV";"NL12INGB0001234567";"NL20RABO0123456789";"OV";"Bij";"2.150,00";"Overschrijving";"Salaris"
"20261004";"Huur";"NL12INGB0001234567";"NL20RABO0123456789";"OV";"Af";"850,00";"Overschrijving";"Huur okt"`,
millennium: `Data Mov.;Data Valor;Descrição;Montante;Saldo
01-10-2026;01-10-2026;COMPRA CONTINENTE LISBOA;-34,56;1.965,44
02-10-2026;02-10-2026;TRF RECEBIDA SALARIO;1.450,00;3.415,44
03-10-2026;03-10-2026;PAGAMENTO SERVICOS EDP;-62,10;3.353,34`,
cgd: `Data mov.;Data-valor;Descrição;Montante(EUR);Saldo(EUR)
01-10-2026;01-10-2026;COMPRA PINGO DOCE;-23,40;1.200,10
05-10-2026;05-10-2026;TRF A CREDITO SALARIO;1.300,00;2.500,10`,
caixabank: `Fecha operación;Fecha valor;Concepto;Importe;Saldo
01/10/2026;01/10/2026;COMPRA MERCADONA VALENCIA;-45,30;1.954,70
03/10/2026;03/10/2026;NOMINA EMPRESA SL;1.800,00;3.754,70`,
ing_es: `F. VALOR,CATEGORÍA,SUBCATEGORÍA,DESCRIPCIÓN,COMENTARIO,IMPORTE (€),SALDO (€)
01/10/2026,Alimentación,Supermercado,Mercadona,,-45.30,1954.70
03/10/2026,Nómina,Nómina,Empresa SL,,1800.00,3754.70`,
fr: `Date;Libellé;Débit;Crédit
01/10/2026;CARTE CARREFOUR PARIS;23,45;
02/10/2026;VIR SALAIRE EMPLOYEUR;;2 150,00
04/10/2026;PRLV LOYER;850,00;`,
it: `Data;Descrizione;Importo;Valuta
01/10/2026;PAGAMENTO POS ESSELUNGA;-45,30;EUR
02/10/2026;ACCREDITO STIPENDIO;1.800,00;EUR`,
bunq: `Date,Interest Date,Amount,Account,Counterparty,Name,Description
2026-10-01,2026-10-01,-23.45,NL12BUNQ0123456789,NL20INGB0123456789,Albert Heijn,Groceries
2026-10-02,2026-10-02,2150.00,NL12BUNQ0123456789,NL20RABO0123456789,Werkgever BV,Salaris`,
tr: `Date,Type,Description,Amount,Balance
2026-10-01,CARD,Starbucks Wien,-4.50,100.50
2026-10-02,DEPOSIT,Einzahlung,500.00,600.50`,
};

describe("CSV de bancos em euro", () => {
  const casos: [string, number][] = [
    ["revolut", 4], ["n26", 3], ["sparkasse", 3], ["ingnl", 3], ["millennium", 3], ["cgd", 2],
    ["caixabank", 2], ["ing_es", 2], ["fr", 3], ["it", 2], ["bunq", 2], ["tr", 2],
  ];
  for (const [banco, esperado] of casos) {
    it(`${banco}: lê todas as ${esperado} linhas`, () => {
      expect(parseStatement(CSV[banco], "auto", 2026)).toHaveLength(esperado);
    });
  }

  it("a coluna 'Data valor' / 'Value Date' não é o valor em dinheiro", () => {
    const [primeira] = parseStatement(CSV.millennium, "auto", 2026);
    expect(primeira).toEqual({ date: "2026-10-01", description: "COMPRA CONTINENTE LISBOA", amount: -34.56 });
    const [n26] = parseStatement(CSV.n26, "auto", 2026);
    expect(n26).toMatchObject({ date: "2026-10-01", amount: -34.2 });
  });

  it("Sparkasse: data com ponto e ano de dois dígitos, descrição pelo Verwendungszweck, milhar com ponto", () => {
    expect(parseStatement(CSV.sparkasse, "auto", 2026)).toEqual([
      { date: "2026-10-01", description: "EDEKA Berlin", amount: -45.67 },
      { date: "2026-10-02", description: "Gehalt 10/2026", amount: 2350 },
      { date: "2026-10-05", description: "Miete Oktober", amount: -950 },
    ]);
  });

  it("ING Holanda: 'Af' é saída e 'Bij' é entrada, data AAAAMMDD", () => {
    expect(parseStatement(CSV.ingnl, "auto", 2026).map((t) => [t.date, t.amount])).toEqual([
      ["2026-10-01", -23.45],
      ["2026-10-02", 2150],
      ["2026-10-04", -850],
    ]);
  });

  it("francês: colunas Débit e Crédit, milhar com espaço ('2 150,00')", () => {
    expect(parseStatement(CSV.fr, "auto", 2026).map((t) => t.amount)).toEqual([-23.45, 2150, -850]);
  });

  it("o tipo do arquivo é reconhecido pelo cabeçalho do banco de lá", () => {
    for (const banco of ["revolut", "n26", "sparkasse", "ingnl", "millennium", "caixabank"]) {
      expect(detectDocKind(CSV[banco]).kind, banco).toBe("extrato");
    }
  });
});

const PDF: Record<string, { t: string; n: number }> = {
revolut_en: { n: 4, t: `Revolut Bank UAB
EUR Statement
Generated on the 13 Oct 2026
Account transactions from 1 October 2026 to 13 October 2026
Date Description Money out Money in Balance
1 Oct 2026 Lidl Berlin €23.45 €976.55
2 Oct 2026 Top-Up by *1234 €500.00 €1,476.55
4 Oct 2026 To Maria Silva €200.00 €1,276.55
5 Oct 2026 Uber *Trip €12.80 €1,263.75` },
revolut_pt: { n: 4, t: `Revolut Bank UAB
Extrato em EUR
Transações da conta de 1 de outubro de 2026 a 13 de outubro de 2026
Data Descrição Dinheiro saído Dinheiro entrado Saldo
1 de out. de 2026 Lidl Berlin 23,45 € 976,55 €
2 de out. de 2026 Reforço por *1234 500,00 € 1.476,55 €
4 de out. de 2026 Para Maria Silva 200,00 € 1.276,55 €
5 de out. de 2026 Uber *Trip 12,80 € 1.263,75 €` },
millennium_pdf: { n: 3, t: `Millennium bcp
Extrato Combinado
DATA MOV. DATA VALOR DESCRIÇÃO DÉBITO CRÉDITO SALDO
01.10 01.10 COMPRA CONTINENTE LISBOA 34,56 1.965,44
02.10 02.10 TRF RECEBIDA SALARIO 1.450,00 3.415,44
03.10 03.10 PAGAMENTO SERVICOS EDP 62,10 3.353,34` },
n26_de: { n: 3, t: `N26 Bank GmbH
Kontoauszug
Datum Beschreibung Betrag Saldo
01.10.2026 REWE Markt -34,20 € 965,80 €
02.10.2026 Arbeitgeber GmbH Gehalt Oktober 2.450,00 € 3.415,80 €
03.10.2026 Netflix -12,99 € 3.402,81 €` },
};

describe("PDF de extrato em euro", () => {
  for (const banco of Object.keys(PDF)) {
    it(`${banco}: lê todas as linhas`, () => {
      expect(parseStatement(PDF[banco].t, "pdf", 2026)).toHaveLength(PDF[banco].n);
    });
  }

  it("Revolut em inglês: € colado no número e 1,234.56 viram saída e entrada certas", () => {
    expect(parseStatement(PDF.revolut_en.t, "pdf", 2026).map((t) => [t.date, t.amount])).toEqual([
      ["2026-10-01", -23.45],
      ["2026-10-02", 500],
      ["2026-10-04", -200],
      ["2026-10-05", -12.8],
    ]);
  });

  it("Revolut em português: '1 de out. de 2026' e '23,45 €'", () => {
    expect(parseStatement(PDF.revolut_pt.t, "pdf", 2026).map((t) => t.amount)).toEqual([-23.45, 500, -200, -12.8]);
  });

  it("documento que já funciona não passa pela tradução", () => {
    expect(normalizarTextoEuropeu("01/10/2026 PADARIA 12,50\n02/10/2026 MERCADO 99,90")).toBeNull();
  });
});

const WISE_EN = `Wise Payments Ltd.
1st Floor, Worship Square, 65 Clifton Street
London
EUR Statement
1 October 2026 [GMT+02:00] - 13 October 2026 [GMT+02:00]
Generated on: 13 October 2026
Account Holder
JOAO SILVA
IBAN
BE19 9059 0026 7212
EUR on 13 October 2026 [GMT+02:00] 1,094.94 EUR
Description Incoming Outgoing Amount
Card transaction of 39.65 EUR issued by Lidl Lisboa
LISBOA
-39.65 1,094.94
13 October 2026 | Card ending in 6675 | JOAO SILVA | Transaction: CARD-4466018143
Received money from ACME LDA with reference SALARY 1,200.00 1,134.59
12 October 2026 | Transaction: TRANSFER-6265180947
500.00 BRL converted to 86.29 EUR 86.29 -65.41
12 October 2026 | Transaction: BALANCE-6265180947
Card transaction of 3.40 EUR issued by Cafe Central -3.40 -151.70
11 October 2026 | Card ending in 6675 | JOAO SILVA | Transaction: CARD-4463860152
Wise Payments Limited is authorised by the Financial Conduct Authority`;

describe("Wise em inglês", () => {
  it("é reconhecido, lê as 4 linhas e fecha no centavo com os saldos impressos", () => {
    expect(isWiseStatement(WISE_EN)).toBe(true);
    const r = parseStatementComLeitor(WISE_EN, "pdf", 2026);
    expect(r.leitor).toBe("wise");
    expect(r.txns.map((t) => [t.date, t.amount])).toEqual([
      ["2026-10-13", -39.65],
      ["2026-10-12", 1200],
      ["2026-10-12", 86.29],
      ["2026-10-11", -3.4],
    ]);
    expect(saldosDoExtratoWise(WISE_EN)).toEqual({ inicial: -148.3, final: 1094.94 });
    expect(conferirLeitura(WISE_EN, "extrato", r.txns)).toMatchObject({ status: "fechou", esperado: 1243.24 });
  });

  it("faltando uma linha, a conferência acusa", () => {
    const r = parseStatementComLeitor(WISE_EN, "pdf", 2026);
    expect(conferirLeitura(WISE_EN, "extrato", r.txns.slice(1)).status).toBe("nao-fechou");
  });
});
