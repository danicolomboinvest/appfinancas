import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { extractUploadFromForm } from "../extract-text";
import { parseStatement } from "../statement-parser";

function formCom(bytes: Uint8Array<ArrayBuffer>, nome: string, encoding: "text" | "xlsx"): FormData {
  const form = new FormData();
  form.set("file", new File([bytes], nome));
  form.set("encoding", encoding);
  return form;
}

/** Texto → bytes em Latin-1 (um byte por caractere), como os bancos que exportam em Windows-1252. */
function latin1(texto: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from([...texto].map((c) => c.charCodeAt(0)));
}

describe("CSV em Latin-1 (Windows-1252)", () => {
  // Amostra FICTÍCIA com o cabeçalho de duas colunas que os bancos brasileiros usam.
  const CSV = [
    "Data;Histórico;Docto.;Crédito (R$);Débito (R$);Saldo (R$)",
    "01/09/2026;PIX RECEBIDO;123;100,00;;1.100,00",
    "02/09/2026;PADARIA SÃO JOÃO;124;;12,50;1.087,50",
    "03/09/2026;FARMÁCIA;125;;40,00;1.047,50",
  ].join("\n");

  it("lê os acentos e as três linhas, igual ao mesmo arquivo em UTF-8", async () => {
    const { text } = await extractUploadFromForm(formCom(latin1(CSV), "extrato.csv", "text"));
    expect(text).not.toContain("�");
    const txns = parseStatement(text);
    expect(txns).toEqual([
      { date: "2026-09-01", description: "PIX RECEBIDO", amount: 100 },
      { date: "2026-09-02", description: "PADARIA SÃO JOÃO", amount: -12.5 },
      { date: "2026-09-03", description: "FARMÁCIA", amount: -40 },
    ]);
  });

  it("UTF-8 continua sendo lido como UTF-8", async () => {
    const { text } = await extractUploadFromForm(formCom(new TextEncoder().encode(CSV), "extrato.csv", "text"));
    expect(text).toBe(CSV);
  });
});

describe("data de verdade do Excel", () => {
  it("sai como DD/MM/AAAA, não no formato americano, e cai no dia certo", async () => {
    // 30/06/2026 como número de série do Excel, com o formato "data abreviada" (código 14).
    const serial = (Date.UTC(2026, 5, 30) - Date.UTC(1899, 11, 30)) / 86_400_000;
    const ws: XLSX.WorkSheet = {
      "!ref": "A1:C2",
      A1: { t: "s", v: "Data" },
      B1: { t: "s", v: "Descrição" },
      C1: { t: "s", v: "Valor" },
      A2: { t: "n", v: serial, z: "m/d/yy" },
      B2: { t: "s", v: "MERCADO" },
      C2: { t: "n", v: -10.5 },
    };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Extrato");
    const bytes = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const { text } = await extractUploadFromForm(formCom(new Uint8Array(bytes), "extrato.xlsx", "xlsx"));
    expect(text).toContain("30/06/2026");
    expect(parseStatement(text)).toEqual([{ date: "2026-06-30", description: "MERCADO", amount: -10.5 }]);
  });
});
