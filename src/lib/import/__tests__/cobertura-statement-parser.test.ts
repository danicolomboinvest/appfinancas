import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeDate, parseAmountFlexible, parseCsv, parseOfx, parseStatementComLeitor, parseTextLines } from "../statement-parser";

// Cobertura extra (set/2026). Arquivos FICTÍCIOS, escritos à mão no formato dos bancos.
// Os `it.fails` são BUGS CONHECIDOS: descrevem o comportamento certo e hoje falham.

describe("parseAmountFlexible: os jeitos de escrever valor", () => {
  it("parênteses e D no fim são saída; C no fim é entrada", () => {
    expect(parseAmountFlexible("(1.234,56)")).toBe(-1234.56);
    expect(parseAmountFlexible("1.234,56 D")).toBe(-1234.56);
    expect(parseAmountFlexible("1.234,56D")).toBe(-1234.56);
    expect(parseAmountFlexible("1.234,56 C")).toBe(1234.56);
  });

  it("decide BR x americano pelo último separador", () => {
    expect(parseAmountFlexible("-14,097.44")).toBe(-14097.44);
    expect(parseAmountFlexible("1.234")).toBe(1234);
    expect(parseAmountFlexible("1,5")).toBe(1.5);
    expect(parseAmountFlexible("R$ 250")).toBe(250);
  });

  it("vazio e traço sozinho não são valor", () => {
    expect(parseAmountFlexible("")).toBeNaN();
    expect(parseAmountFlexible("-")).toBeNaN();
  });

  // Algumas planilhas (exportação contábil/SAP) põem o menos DEPOIS do número.
  it("'50,00-' é saída de 50, não linha jogada fora", () => {
    expect(parseAmountFlexible("50,00-")).toBe(-50);
  });
});

describe("normalizeDate: bordas", () => {
  it("data com hora (BTG) e OFX com fuso", () => {
    expect(normalizeDate("05/09/2026 14:32")).toBe("2026-09-05");
    expect(normalizeDate("20260905120000[-3:BRT]")).toBe("2026-09-05");
  });

  it("o que não reconhece volta como veio (e o import cai no mês atual)", () => {
    expect(normalizeDate("ontem")).toBe("ontem");
    expect(normalizeDate("  ")).toBe("");
  });

  it("dia ou mês fora da faixa não vira data BR", () => {
    expect(normalizeDate("32/01/2026")).toBe("32/01/2026");
    expect(normalizeDate("10/13/2026")).toBe("10/13/2026");
  });

  // Aceita dia 31 em qualquer mês: "2026-02-31" é gravado como 3 de março (new Date rola).
  it("31/02 não é data válida", () => {
    expect(normalizeDate("31/02/2026")).toBe("31/02/2026");
  });
});

describe("parseOfx: bordas", () => {
  const ofx = (trn: string) => `OFXHEADER:100\n<OFX><BANKTRANLIST>\n<STMTTRN>\n${trn}\n</STMTTRN>\n</BANKTRANLIST></OFX>`;

  it("sem MEMO usa NAME; sem nenhum dos dois vira 'Lançamento'", () => {
    expect(parseOfx(ofx("<TRNAMT>-10.00\n<DTPOSTED>20260910\n<NAME>PADARIA EXEMPLO"))[0].description).toBe("PADARIA EXEMPLO");
    expect(parseOfx(ofx("<TRNAMT>-10.00\n<DTPOSTED>20260910"))[0].description).toBe("Lançamento");
  });

  it("pula bloco sem valor ou com valor ilegível", () => {
    expect(parseOfx(ofx("<DTPOSTED>20260910\n<MEMO>SEM VALOR"))).toEqual([]);
    expect(parseOfx(ofx("<TRNAMT>abc\n<DTPOSTED>20260910\n<MEMO>X"))).toEqual([]);
  });

  it("tags fechadas na mesma linha (OFX em XML) também são lidas", () => {
    expect(parseOfx(ofx("<TRNAMT>150.00</TRNAMT><DTPOSTED>20260901</DTPOSTED><MEMO>SALARIO EXEMPLO</MEMO>"))).toEqual([
      { date: "2026-09-01", description: "SALARIO EXEMPLO", amount: 150 },
    ]);
  });

  // `tag()` devolve "" (não null) pro MEMO vazio, e o `??` não cai pro NAME.
  it("MEMO vazio usa o NAME, não descrição em branco", () => {
    expect(parseOfx(ofx("<TRNAMT>-10.00\n<DTPOSTED>20260910\n<NAME>PADARIA EXEMPLO\n<MEMO>"))[0].description).toBe("PADARIA EXEMPLO");
  });

  it("'&amp;' do OFX vira '&' na descrição", () => {
    expect(parseOfx(ofx("<TRNAMT>-10.00\n<DTPOSTED>20260910\n<MEMO>P&amp;B LTDA"))[0].description).toBe("P&B LTDA");
  });

  // O OFX usa parseBrazilianNumber, que acha que a vírgula é decimal: R$ 1.234,56 vira R$ 1,23.
  // O CSV já usa parseAmountFlexible, que resolve isso.
  it("OFX com separador de milhar americano ('-1,234.56') lê 1.234,56", () => {
    expect(parseOfx(ofx("<TRNAMT>-1,234.56\n<DTPOSTED>20260910\n<MEMO>X"))[0].amount).toBe(-1234.56);
  });
});

describe("parseCsv: bordas", () => {
  it("colunas Crédito e Débito separadas: débito sai, crédito entra", () => {
    const csv = ["Data;Histórico;Crédito;Débito", "01/09/2026;SALARIO EXEMPLO;3.000,00;", "02/09/2026;MERCADO EXEMPLO;;150,90", "03/09/2026;TARIFA;;-12,00"].join("\n");
    expect(parseCsv(csv, 2026).map((t) => t.amount)).toEqual([3000, -150.9, -12]);
  });

  it("coluna D/C decide o sinal quando o valor vem sem sinal", () => {
    const csv = ["Data;Descrição;Valor;D/C", "01/09/2026;PADARIA EXEMPLO;25,00;D", "02/09/2026;PIX RECEBIDO;100,00;C"].join("\n");
    expect(parseCsv(csv, 2026).map((t) => t.amount)).toEqual([-25, 100]);
  });

  it("prefere 'Valor (em R$)' a 'Valor (em US$)'", () => {
    const csv = ["Data,Estabelecimento,Valor (em US$),Valor (em R$)", "05/09/2026,LOJA EXTERIOR,10.00,55.20"].join("\n");
    expect(parseCsv(csv, 2026)).toEqual([{ date: "2026-09-05", description: "LOJA EXTERIOR", amount: 55.2 }]);
  });

  it("junta 'Transação' e 'Descrição' quando diferem, e pula linha de saldo", () => {
    const csv = ["Data;Transação;Descrição;Valor", "01/09/2026;Pix enviado;MARIA EXEMPLO;-50,00", "01/09/2026;Saldo do dia;-;1.000,00"].join("\n");
    expect(parseCsv(csv, 2026)).toEqual([{ date: "2026-09-01", description: "Pix enviado · MARIA EXEMPLO", amount: -50 }]);
  });

  it("valor zero e linha de dado antes do cabeçalho são ignorados", () => {
    const csv = ["Conta: 0000-0", "Data;Descrição;Valor", "01/09/2026;ESTORNO ZERADO;0,00", "02/09/2026;LOJA EXEMPLO;-9,90"].join("\n");
    expect(parseCsv(csv, 2026)).toEqual([{ date: "2026-09-02", description: "LOJA EXEMPLO", amount: -9.9 }]);
  });

  it("CRLF do Windows e linhas em branco não atrapalham", () => {
    const csv = "Data;Descrição;Valor\r\n\r\n01/09/2026;LOJA EXEMPLO;-9,90\r\n";
    expect(parseCsv(csv, 2026)).toHaveLength(1);
  });

  // A data sem ano fica crua ("10/09") e, na gravação, cai no MÊS ATUAL (import-actions.ts:636).
  // O texto de PDF já usa o refYear pra isso; o CSV não usa.
  it("data 'DD/MM' sem ano no CSV usa o ano de referência", () => {
    const csv = ["Data;Descrição;Valor", "10/08;PADARIA EXEMPLO;-50,00"].join("\n");
    expect(parseCsv(csv, 2026)[0].date).toBe("2026-08-10");
  });

  // NON_TRANSACTION_RE (/\bsaldo\b/) testa a DESCRIÇÃO do lançamento: um Pix de verdade que
  // cita "saldo" some calado.
  it("lançamento que só cita 'saldo' na descrição não some", () => {
    const csv = ["Data;Descrição;Valor", "10/09/2026;Pix enviado - Quitação saldo devedor;-500,00"].join("\n");
    expect(parseCsv(csv, 2026)).toHaveLength(1);
  });
});

describe("parseTextLines (PDF genérico): bordas", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T12:00:00"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("descrição que desce uma ou duas linhas antes do valor", () => {
    const txt = ["12/09/2026 PIX ENVIADO", "MARIA EXEMPLO", "CPF ***", "150,00"].join("\n");
    expect(parseTextLines(txt, 2026)).toEqual([{ date: "2026-09-12", description: "PIX ENVIADO MARIA EXEMPLO CPF ***", amount: -150 }]);
  });

  it("desiste da descrição que passa de 3 linhas sem valor", () => {
    const txt = ["12/09/2026 CABEÇALHO", "a", "b", "c", "d", "99,00"].join("\n");
    expect(parseTextLines(txt, 2026)).toEqual([]);
  });

  it("D e C no fim da linha dão o sinal; menos tipográfico (U+2212) também", () => {
    expect(parseTextLines("10/09/2026 TED EXEMPLO 200,00 C", 2026)[0].amount).toBe(200);
    expect(parseTextLines("10/09/2026 DEBITO EXEMPLO 200,00 D", 2026)[0]).toEqual({ date: "2026-09-10", description: "DEBITO EXEMPLO", amount: -200 });
    expect(parseTextLines("10/09/2026 PAGAMENTO RECEBIDO −R$ 80,00", 2026)[0].amount).toBe(-80);
  });

  it("linha de saldo, total e limite não vira lançamento", () => {
    const txt = ["10/09/2026 SALDO DO DIA 1.000,00", "10/09/2026 TOTAL DA FATURA 500,00", "10/09/2026 LIMITE DISPONIVEL 2.000,00", "10/09/2026 LOJA EXEMPLO 10,00"].join("\n");
    expect(parseTextLines(txt, 2026).map((t) => t.description)).toEqual(["LOJA EXEMPLO"]);
  });

  it("mês por nome ('12 AGO', '21/out') e o algarismo solto antes da data (Santander)", () => {
    expect(parseTextLines("12 AGO LOJA EXEMPLO 10,00", 2026)[0].date).toBe("2026-08-12");
    expect(parseTextLines("21/out LOJA EXEMPLO 10,00", 2025)[0].date).toBe("2025-10-21");
    expect(parseTextLines("2 05/09 LOJA EXEMPLO 10,00", 2026)[0]).toEqual({ date: "2026-09-05", description: "LOJA EXEMPLO", amount: -10 });
  });

  it("data sem ano mais de 45 dias no futuro é do ano passado (extrato de dezembro lido em setembro)", () => {
    expect(parseTextLines("20/12 LOJA EXEMPLO 10,00", 2026)[0].date).toBe("2025-12-20");
    expect(parseTextLines("10/11 LOJA EXEMPLO 10,00", 2026)[0].date).toBe("2026-11-10");
  });

  it("palavra de entrada sem sinal vira entrada; o resto é saída", () => {
    const txt = ["01/09/2026 SALARIO EXEMPLO 3.000,00", "02/09/2026 RENDIMENTO 1,23", "03/09/2026 PADARIA 8,00"].join("\n");
    expect(parseTextLines(txt, 2026).map((t) => t.amount)).toEqual([3000, 1.23, -8]);
  });

  // moneyRe (statement-parser.ts:428) exige o ponto de milhar e não tem borda à esquerda: em
  // "1500,00" ele casa só "500,00". O gasto de R$ 1.500 entra como R$ 500, e o "1" fica na descrição.
  it("valor sem ponto de milhar ('1500,00') é lido inteiro", () => {
    expect(parseTextLines("12/08/2026 LOJA EXEMPLO 1500,00", 2026)).toEqual([{ date: "2026-08-12", description: "LOJA EXEMPLO", amount: -1500 }]);
  });

  // CREDIT_HINTS (statement-parser.ts:345) tem "crédito": pagar o cartão de crédito ou a parcela
  // do crédito pessoal vira ENTRADA. E como vira renda, parecePagamentoDeFatura (que só olha
  // gasto) nem chega a ver a linha.
  it("'PAGAMENTO CARTAO DE CREDITO' sem sinal é saída, não renda", () => {
    expect(parseTextLines("15/09/2026 PAGAMENTO CARTAO DE CREDITO 1.500,00", 2026)[0].amount).toBe(-1500);
    expect(parseTextLines("15/09/2026 PARCELA CREDITO PESSOAL 300,00", 2026)[0].amount).toBe(-300);
  });

  // O traço que separa descrição e valor é lido como sinal de menos e ganha da palavra "salário".
  it("'SALARIO EMPRESA - 3.000,00' é entrada (o traço é separador, não sinal)", () => {
    expect(parseTextLines("05/09/2026 SALARIO EMPRESA EXEMPLO - 3.000,00", 2026)[0].amount).toBe(3000);
  });

  // "2 MAIONESE" (quantidade + item) é lido como "2 de MAIo": vira um lançamento novo em maio e
  // a compra de cima perde o valor.
  it("linha que começa com quantidade + palavra parecida com mês não vira data", () => {
    const txt = ["12/08/2026 MERCADO EXEMPLO", "2 MAIONESE 15,90"].join("\n");
    const r = parseTextLines(txt, 2026);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ date: "2026-08-12", amount: -15.9 });
  });
});

describe("parseStatementComLeitor: quem leu", () => {
  it("PDF que nenhum banco reconhece cai no leitor genérico (leitor null)", () => {
    const r = parseStatementComLeitor("Extrato Banco Exemplo\n10/09/2026 LOJA EXEMPLO 10,00", "pdf", 2026);
    expect(r.leitor).toBeNull();
    expect(r.txns).toHaveLength(1);
  });

  it("CSV e OFX nunca têm leitor dedicado", () => {
    expect(parseStatementComLeitor("Data;Descrição;Valor\n10/09/2026;X;-1,00").leitor).toBeNull();
    expect(parseStatementComLeitor("<OFX><STMTTRN><TRNAMT>-1.00<DTPOSTED>20260910<MEMO>X</STMTTRN>").txns).toHaveLength(1);
  });

  it("arquivo vazio dá lista vazia, sem erro", () => {
    expect(parseStatementComLeitor("", "pdf").txns).toEqual([]);
    expect(parseStatementComLeitor("").txns).toEqual([]);
  });
});

describe("data impossível e linha sem data (01/10/2026)", () => {
  const ofxBloco = (dt: string, valor: string) => `<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>${dt}<TRNAMT>${valor}<MEMO>X</STMTTRN>`;

  it("OFX com DTPOSTED zerado é linha de saldo, não renda no 'ano 2'", () => {
    const ofx = `<OFX>${ofxBloco("20260910", "-10.00")}${ofxBloco("00000000", "6636.33")}</OFX>`;
    expect(parseOfx(ofx).map((t) => t.date)).toEqual(["2026-09-10"]);
  });

  it("planilha com data: o quadro de limite do fim (sem data) não vira lançamento do mês", () => {
    const csv = [
      "data;lançamento;ag./origem;valor (R$);saldos (R$)",
      "01/09/2026;PIX RECEBIDO PESSOA;;100,00;",
      "02/09/2026;PADARIA EXEMPLO;;-20,00;",
      "03/09/2026;MERCADO EXEMPLO;;-30,00;",
      ";(+) LIMITE DA CONTA TOTAL;;15.500,00;",
      ";JUROS DO LIMITE DA CONTA;;0,20;",
    ].join("\n");
    expect(parseCsv(csv).map((t) => t.description)).toEqual(["PIX RECEBIDO PESSOA", "PADARIA EXEMPLO", "MERCADO EXEMPLO"]);
  });
});
