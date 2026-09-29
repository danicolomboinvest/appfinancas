import { describe, expect, it } from "vitest";
import { celulaCsv, dataCsv, dinheiroCsv, montarCsv, quantidadeCsv, TIPO_DO_LANCAMENTO } from "../csv-brasil";

/** O CSV exportado abria numa coluna só e com "MÃªs" no Excel em português. */
describe("CSV pro Excel brasileiro", () => {
  it("começa com BOM, separa com ; e quebra linha no padrão do Windows", () => {
    const csv = montarCsv(["Mês", "Valor"], [["9", "2500,50"]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.slice(1)).toBe("Mês;Valor\r\n9;2500,50");
  });

  it("aspas só quando o texto tem ; aspas ou quebra de linha", () => {
    expect(celulaCsv("Mercado, padaria")).toBe("Mercado, padaria");
    expect(celulaCsv("Aluguel; condomínio")).toBe('"Aluguel; condomínio"');
    expect(celulaCsv('Loja "boa"')).toBe('"Loja ""boa"""');
    expect(celulaCsv("linha\nnova")).toBe('"linha\nnova"');
  });

  it("dinheiro com 2 casas e vírgula decimal, sem milhar", () => {
    expect(dinheiroCsv(2500.5)).toBe("2500,50");
    expect(dinheiroCsv("1234567.891")).toBe("1234567,89");
    expect(dinheiroCsv({ toString: () => "10" })).toBe("10,00");
  });

  it("quantidade sem zeros sobrando", () => {
    expect(quantidadeCsv("10.500000")).toBe("10,5");
    expect(quantidadeCsv(100)).toBe("100");
  });

  it("data do lançamento em dd/mm/aaaa, no dia que o app mostra", () => {
    expect(dataCsv(new Date("2026-09-05T00:00:00Z"))).toBe("05/09/2026");
    expect(dataCsv(new Date("2026-09-05T12:00:00Z"))).toBe("05/09/2026");
    expect(dataCsv(null)).toBe("");
  });

  it("tipo em português, não o enum", () => {
    expect(TIPO_DO_LANCAMENTO.EXPENSE).toBe("Gasto");
    expect(TIPO_DO_LANCAMENTO.INVESTMENT_CONTRIBUTION).toBe("Aporte");
    expect(TIPO_DO_LANCAMENTO.INCOME).toBe("Renda");
  });
});
