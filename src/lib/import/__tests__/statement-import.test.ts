import { describe, it, expect } from "vitest";
import { parseStatement, parseOfx, parseCsv, parseTextLines, parseBrazilianNumber, normalizeDate } from "../statement-parser";
import { classify, normalizeMerchant } from "../classify";

describe("parseBrazilianNumber", () => {
  it("handles BR decimal comma with thousand dots", () => {
    expect(parseBrazilianNumber("1.234,56")).toBe(1234.56);
    expect(parseBrazilianNumber("-1.234,56")).toBe(-1234.56);
    expect(parseBrazilianNumber("R$ 100,00")).toBe(100);
    expect(parseBrazilianNumber("1234.56")).toBe(1234.56);
  });
});

describe("normalizeDate", () => {
  it("normalizes BR, ISO and OFX dates", () => {
    expect(normalizeDate("12/05/2026")).toBe("2026-05-12");
    expect(normalizeDate("2026-05-12")).toBe("2026-05-12");
    expect(normalizeDate("20260512120000")).toBe("2026-05-12");
  });
});

describe("parseOfx", () => {
  it("extracts transactions from OFX STMTTRN blocks", () => {
    const ofx = `<OFX><BANKTRANLIST>
      <STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260512<TRNAMT>-45.90<MEMO>IFOOD *IFD SAO PAULO</STMTTRN>
      <STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260510<TRNAMT>3000.00<MEMO>SALARIO</STMTTRN>
    </BANKTRANLIST></OFX>`;
    const txns = parseOfx(ofx);
    expect(txns).toHaveLength(2);
    expect(txns[0]).toEqual({ date: "2026-05-12", description: "IFOOD *IFD SAO PAULO", amount: -45.9 });
    expect(txns[1].amount).toBe(3000);
  });
});

describe("parseCsv", () => {
  it("parses CSV with headers and BR numbers (semicolon)", () => {
    const csv = `Data;Descrição;Valor
12/05/2026;Uber viagem;-24,50
10/05/2026;Salário;3000,00`;
    const txns = parseCsv(csv);
    expect(txns).toHaveLength(2);
    expect(txns[0]).toEqual({ date: "2026-05-12", description: "Uber viagem", amount: -24.5 });
    expect(txns[1].amount).toBe(3000);
  });

  it("handles quoted fields containing the delimiter", () => {
    const csv = `date,description,amount
2026-05-12,"Posto Shell, Centro",-150.00`;
    const txns = parseCsv(csv);
    expect(txns[0].description).toBe("Posto Shell, Centro");
    expect(txns[0].amount).toBe(-150);
  });

  it("falls back to positional columns without a recognizable header", () => {
    const csv = `12/05/2026;Farmacia Drogasil;-30,00`;
    const txns = parseCsv(csv);
    expect(txns).toHaveLength(1);
    expect(txns[0].description).toBe("Farmacia Drogasil");
  });

  it("parses a BTG-style statement: header after metadata, US numbers, skips balances", () => {
    const csv = [
      ";Extrato de conta corrente;;;;;;;;15/07/2026",
      ";Cliente:;Daniela Colombo",
      ";Período do extrato:;17/04/2026 a 15/07/2026",
      ";Data e hora;Categoria;Transação;;;Descrição;;;;Valor",
      ";17/04/2026 00:32;Contas;Pagamento de fatura;;;Fatura do cartão;;;;-14,097.44",
      ";17/04/2026 23:59;;;;;Saldo Diário;;;;87.53",
      ";02/05/2026 20:25;Seguro;Pix recebido;;;Dani Colombo Invest;;;;5,000.00",
    ].join("\n");
    const txns = parseCsv(csv);
    expect(txns).toHaveLength(2); // fatura + pix; o "Saldo Diário" é ignorado
    expect(txns[0]).toEqual({
      date: "2026-04-17",
      description: "Pagamento de fatura · Fatura do cartão",
      amount: -14097.44, // formato americano lido corretamente
    });
    expect(txns[1].amount).toBe(5000);
  });
});

describe("parseStatement dispatch", () => {
  it("routes OFX vs CSV by content", () => {
    expect(parseStatement("<STMTTRN><TRNAMT>-1.00<MEMO>x</STMTTRN>")).toHaveLength(1);
    expect(parseStatement("data;desc;valor\n01/01/2026;x;-1,00")).toHaveLength(1);
  });
});

describe("parseTextLines (PDF-extracted text)", () => {
  it("finds date + amount per line and ignores lines without a date", () => {
    const text = `Extrato Conta Corrente
12/07/2026  IFOOD *IFD SAO PAULO      -45,90
10/07/2026  SALARIO EMPRESA XYZ     5.000,00
Saldo final                          4.929,60`;
    const txns = parseTextLines(text);
    expect(txns).toHaveLength(2); // "Saldo final" tem valor mas não tem data → ignorado
    expect(txns[0]).toEqual({ date: "2026-07-12", description: "IFOOD *IFD SAO PAULO", amount: -45.9 });
  });

  it("marks credit lines as income via keyword", () => {
    const txns = parseTextLines("10/07/2026 SALARIO EMPRESA 5.000,00");
    expect(txns[0].amount).toBe(5000); // positivo (salário = crédito)
  });

  it("routes source=pdf through the text-line parser", () => {
    expect(parseStatement("01/01/2026 UBER 24,50", "pdf")).toHaveLength(1);
  });
});

describe("normalizeMerchant", () => {
  it("reduces a noisy description to a stable merchant key", () => {
    expect(normalizeMerchant("IFOOD *IFD1234 12/05 SAO PAULO")).toContain("ifood");
    expect(normalizeMerchant("Pagamento cartao UBER 99")).toBe("uber");
  });
});

describe("classify", () => {
  it("classifies common merchants via builtin rules", () => {
    expect(classify("IFOOD *IFD SAO PAULO")).toEqual({ parentCategory: "ALIMENTACAO", subcategory: "Delivery" });
    expect(classify("UBER *TRIP")).toEqual({ parentCategory: "TRANSPORTE", subcategory: "Aplicativo" });
    expect(classify("NETFLIX.COM")).toEqual({ parentCategory: "LAZER", subcategory: "Streaming" });
    expect(classify("DROGASIL 123")).toEqual({ parentCategory: "SAUDE", subcategory: "Farmácia" });
  });

  it("returns null for unknown merchants (review queue)", () => {
    expect(classify("PAGAMENTO XPTO LTDA")).toBeNull();
  });

  it("prefers a learned user rule over builtin", () => {
    const rules = [{ pattern: "xpto", parentCategory: "EDUCACAO" as const, subcategory: "Cursos" }];
    expect(classify("XPTO LTDA 12/05", rules)).toEqual({ parentCategory: "EDUCACAO", subcategory: "Cursos" });
  });
});

/**
 * Excel de banco chega aqui com TODAS as abas coladas uma na outra (é o xlsxToCsv que faz
 * isso, senão fatura internacional e parcelas ficavam de fora). Cada aba traz o seu cabeçalho,
 * e as colunas raramente ficam na mesma posição. Amostras FICTÍCIAS, nada de arquivo de cliente.
 */
describe("parseCsv com várias abas coladas (Excel de banco)", () => {
  it("não perde as linhas da segunda aba quando a coluna de valor muda de lugar", () => {
    const aba1 = ["Data;Estabelecimento;Valor", "01/09/2026;LOJA A;10,00", "02/09/2026;LOJA B;20,00"];
    const aba2 = [
      "Data;Estabelecimento;Cidade;Valor (em R$)",
      "03/09/2026;LOJA C;VITORIA;30,00",
      "04/09/2026;LOJA D;VITORIA;40,00",
      "05/09/2026;LOJA E;VITORIA;50,00",
    ];

    const lidos = parseCsv([...aba1, ...aba2].join("\n"));

    expect(lidos).toHaveLength(5);
    expect(lidos.map((t) => t.amount)).toEqual([10, 20, 30, 40, 50]);
  });

  it("não troca data por descrição quando a segunda aba inverte as colunas", () => {
    const aba1 = ["Data;Estabelecimento;Valor", "01/09/2026;LOJA A;10,00"];
    const aba2 = ["Estabelecimento;Data;Valor (em R$)", "LOJA C;03/09/2026;30,00"];

    const lidos = parseCsv([...aba1, ...aba2].join("\n"));

    expect(lidos).toEqual([
      { date: "2026-09-01", description: "LOJA A", amount: 10 },
      { date: "2026-09-03", description: "LOJA C", amount: 30 },
    ]);
  });

  it("acha a tabela mesmo depois de um preâmbulo longo (carta e resumo da fatura)", () => {
    const preambulo = [
      "Ola, Cliente Ficticio.;;",
      "RUA INVENTADA 100 AP 1, BAIRRO, CIDADE;;",
      ...Array.from({ length: 45 }, (_, i) => `Resumo da fatura linha ${i + 1};;`),
    ];
    const tabela = [
      "Data;Estabelecimento;Valor",
      ...Array.from({ length: 12 }, (_, i) => `0${(i % 9) + 1}/09/2026;LOJA FICTICIA ${i + 1};${(i + 1) * 10},00`),
    ];

    expect(parseCsv([...preambulo, ...tabela].join("\n"))).toHaveLength(12);
  });

  it("não confunde um lançamento com cabeçalho só porque a descrição fala em valor e data", () => {
    const csv = [
      "Data;Historico;Valor",
      "01/09/2026;PAGTO VALOR DATA ANTERIOR;-100,00",
      "02/09/2026;MERCADO;-50,00",
    ].join("\n");

    expect(parseCsv(csv).map((t) => t.amount)).toEqual([-100, -50]);
  });
});

describe("fatura do Santander em Excel (duas colunas, data colada na descrição)", () => {
  // Amostra FICTÍCIA com a mesma forma do arquivo real: a planilha vira CSV com duas colunas,
  // a primeira traz "DD/MM" grudado na descrição e a segunda o valor com ponto decimal
  // (às vezes sem centavos). Os 13 gastos de uma cliente ficaram de fora por causa disso.
  it("lê o arquivo com a linha de cabeçalho 'DATA DESCRICAO;R$'", () => {
    const csv = `DATA DESCRICAO;R$
28/07  MERCADO BOM PRECO;103.81
29/07  POSTO SOL *COMBUSTIVEL - 02/02;250
30/07  PADARIA CENTRAL;12.5`;
    const txns = parseCsv(csv, 2026);
    expect(txns).toHaveLength(3);
    expect(txns[0]).toEqual({ date: "2026-07-28", description: "MERCADO BOM PRECO", amount: 103.81 });
    expect(txns[1]).toEqual({ date: "2026-07-29", description: "POSTO SOL *COMBUSTIVEL - 02/02", amount: 250 });
    expect(txns[2]).toEqual({ date: "2026-07-30", description: "PADARIA CENTRAL", amount: 12.5 });
  });

  it("lê o mesmo arquivo quando a linha de cabeçalho não veio", () => {
    const csv = `28/07  MERCADO BOM PRECO;103.81
29/07  POSTO SOL *COMBUSTIVEL - 02/02;250
30/07  PADARIA CENTRAL;12.5`;
    const txns = parseCsv(csv, 2026);
    expect(txns).toHaveLength(3);
    expect(txns.map((t) => t.date)).toEqual(["2026-07-28", "2026-07-29", "2026-07-30"]);
    expect(txns[0].description).toBe("MERCADO BOM PRECO");
  });

  it("não confunde uma compra sem centavos com uma linha de cabeçalho", () => {
    const csv = `28/07  DATA CENTER HOSPEDAGEM;250
29/07  PADARIA CENTRAL;12.5`;
    expect(parseCsv(csv, 2026)).toHaveLength(2);
  });
});

describe("coluna de descrição quando o cabeçalho da data também diz 'lançamento'", () => {
  it("usa Histórico como descrição, não a própria coluna de data", () => {
    const csv = `Data Lançamento;Histórico;Valor
12/05/2026;Uber viagem;-24,50`;
    const txns = parseCsv(csv, 2026);
    expect(txns).toEqual([{ date: "2026-05-12", description: "Uber viagem", amount: -24.5 }]);
  });
});
