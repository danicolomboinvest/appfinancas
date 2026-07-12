import * as XLSX from "xlsx";
import { PDFParse } from "pdf-parse";

/**
 * Extração de texto de arquivos binários (Excel e PDF) para importação de extrato/carteira.
 * Só roda no servidor — as libs (xlsx, pdf-parse) são pesadas e não devem ir pro cliente.
 * O cliente manda os bytes em base64; aqui viram texto (CSV para Excel, texto cru para PDF).
 */

export type UploadEncoding = "text" | "xlsx" | "pdf";

function base64ToBuffer(base64: string): Buffer {
  return Buffer.from(base64, "base64");
}

/** Excel → CSV (primeira planilha), reaproveitando o parser de CSV já existente. */
export function xlsxToCsv(base64: string): string {
  const workbook = XLSX.read(base64ToBuffer(base64), { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return "";
  const sheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_csv(sheet, { FS: ";" });
}

/** PDF → texto cru (todas as páginas). */
export async function pdfToText(base64: string): Promise<string> {
  const parser = new PDFParse({ data: base64ToBuffer(base64) });
  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await parser.destroy();
  }
}

/**
 * Normaliza qualquer upload num par { text, source } que os parsers entendem.
 * - text: já é texto (CSV/OFX) — passa direto
 * - xlsx: base64 do Excel → CSV
 * - pdf: base64 do PDF → texto cru (source "pdf" para o parser de linhas)
 */
export async function extractUploadText(
  content: string,
  encoding: UploadEncoding,
): Promise<{ text: string; source: "auto" | "pdf" }> {
  if (encoding === "xlsx") return { text: xlsxToCsv(content), source: "auto" };
  if (encoding === "pdf") return { text: await pdfToText(content), source: "pdf" };
  return { text: content, source: "auto" };
}
