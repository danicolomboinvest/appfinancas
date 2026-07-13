/**
 * Extração de texto de arquivos binários (Excel e PDF) para importação de extrato/carteira.
 * Só roda no servidor — as libs (xlsx, pdf-parse) são pesadas e não devem ir pro cliente.
 * O cliente manda os bytes em base64; aqui viram texto (CSV para Excel, texto cru para PDF).
 *
 * IMPORTANTE: xlsx e pdf-parse são carregados sob demanda (dynamic import), NUNCA no topo.
 * O pdf-parse (via pdfjs) falha ao inicializar em alguns ambientes serverless (ex.: versão de
 * Node sem `Promise.withResolvers`), e um import estático derrubaria TODA a importação —
 * inclusive CSV/OFX, que nem usam essas libs. Carregando por dentro, só o caminho que precisa
 * da lib é que pode falhar, e a falha vira mensagem amigável em vez de erro 500.
 */

export type UploadEncoding = "text" | "xlsx" | "pdf";

/** Erro esperado de leitura de arquivo — o cliente mostra a mensagem direto pro usuário. */
export class UploadReadError extends Error {}

function base64ToBuffer(base64: string): Buffer {
  return Buffer.from(base64, "base64");
}

/** Excel → CSV (primeira planilha), reaproveitando o parser de CSV já existente. */
export async function xlsxToCsv(base64: string): Promise<string> {
  let XLSX: typeof import("xlsx");
  try {
    XLSX = await import("xlsx");
  } catch {
    throw new UploadReadError("Não consegui abrir o Excel neste servidor. Tente exportar como CSV.");
  }
  const workbook = XLSX.read(base64ToBuffer(base64), { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return "";
  const sheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_csv(sheet, { FS: ";" });
}

/** PDF → texto cru (todas as páginas). */
export async function pdfToText(base64: string): Promise<string> {
  let PDFParse: typeof import("pdf-parse").PDFParse;
  try {
    ({ PDFParse } = await import("pdf-parse"));
  } catch {
    throw new UploadReadError(
      "Não consegui ler PDF neste servidor. Envie o extrato em CSV ou Excel (a maioria dos bancos exporta nesses formatos).",
    );
  }
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
  if (encoding === "xlsx") return { text: await xlsxToCsv(content), source: "auto" };
  if (encoding === "pdf") return { text: await pdfToText(content), source: "pdf" };
  return { text: content, source: "auto" };
}
