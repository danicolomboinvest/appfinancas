import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { desembrulharLinhasCsv } from "../planilha-linha-csv";
import { parseStatementComLeitor } from "../statement-parser";

// Amostra fictícia: CSV de fatura (date,title,amount) colado inteiro na coluna A do Excel.
const CELULAS = [
  "date,title,amount",
  '2026-10-17,Pagamento recebido,"- 100,00"',
  '2026-10-17,Padaria Exemplo,"12,50"',
  '2026-10-16,Mercado Exemplo - Parcela 1/3,"90,00"',
  '2026-10-15,Loja Teste,"37,90"',
];

function linhasDaAba() {
  const aba = XLSX.utils.aoa_to_sheet(CELULAS.map((c) => [c]));
  return XLSX.utils.sheet_to_json<unknown[]>(aba, { header: 1, raw: false, blankrows: false });
}

describe("desembrulharLinhasCsv", () => {
  it("devolve o CSV original quando cada célula da coluna A é uma linha", () => {
    expect(desembrulharLinhasCsv(linhasDaAba())).toBe(CELULAS.join("\n"));
  });

  it("o texto desembrulhado é lido como fatura", async () => {
    const r = (await parseStatementComLeitor(desembrulharLinhasCsv(linhasDaAba())!)) as { txns: unknown[] };
    expect(r.txns.length).toBe(4);
  });

  it("não mexe em planilha de verdade (várias colunas)", () => {
    expect(desembrulharLinhasCsv([["Data", "Descrição", "Valor"], ["17/10/2026", "Café", "4,50"]])).toBeNull();
  });

  it("não mexe em lista de uma coluna que não é CSV", () => {
    expect(desembrulharLinhasCsv([["Nome"], ["Ana"], ["Bia"]])).toBeNull();
  });
});
