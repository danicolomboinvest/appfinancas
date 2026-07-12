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
