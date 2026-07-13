/**
 * Extração de texto de arquivos de importação (extrato/carteira) no servidor.
 * O cliente manda o PRÓPRIO File dentro de FormData — nunca base64 numa string de action:
 * o React limita o total de caracteres de string dos argumentos a ~1 milhão ("Maximum array
 * nesting exceeded"), então qualquer arquivo >1 MB derrubava a action. Como File/Blob viaja
 * como anexo multipart, não conta nesse limite (só no bodySizeLimit, configurado à parte).
 *
 * As libs pesadas (xlsx, pdf-parse) são carregadas sob demanda (dynamic import), NUNCA no
 * topo: o pdf-parse (via pdfjs) pode falhar ao inicializar em serverless, e um import
 * estático derrubaria TODA a importação — inclusive CSV/OFX, que nem usam essas libs.
 */

export type UploadEncoding = "text" | "xlsx" | "pdf";

/** Erro esperado de leitura de arquivo — o cliente mostra a mensagem direto pro usuário. */
export class UploadReadError extends Error {}

/** Excel → CSV com TODAS as planilhas concatenadas — extratos de banco (ex.: BTG) espalham
 * os ativos em várias abas (Fundos, Renda Fixa, Renda Variável); ler só a primeira perderia
 * tudo (a primeira costuma ser a capa). */
async function xlsxToCsv(buffer: Buffer): Promise<string> {
  let XLSX: typeof import("xlsx");
  try {
    XLSX = await import("xlsx");
  } catch {
    throw new UploadReadError("Não consegui abrir o Excel neste servidor. Tente exportar como CSV.");
  }
  const workbook = XLSX.read(buffer, { type: "buffer" });
  return workbook.SheetNames.map((name) => XLSX.utils.sheet_to_csv(workbook.Sheets[name], { FS: ";" })).join("\n");
}

/** PDF → texto cru (todas as páginas). */
async function pdfToText(buffer: Buffer): Promise<string> {
  let PDFParse: typeof import("pdf-parse").PDFParse;
  try {
    ({ PDFParse } = await import("pdf-parse"));
  } catch {
    throw new UploadReadError(
      "Não consegui ler PDF neste servidor. Envie o extrato em CSV ou Excel (a maioria dos bancos exporta nesses formatos).",
    );
  }
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await parser.destroy();
  }
}

/**
 * Lê o upload de um FormData ({ file, encoding }) e normaliza num par { text, source }
 * que os parsers entendem.
 * - text: CSV/OFX — decodifica os bytes como UTF-8
 * - xlsx: Excel → CSV
 * - pdf: PDF → texto cru (source "pdf" para o parser de linhas)
 */
export async function extractUploadFromForm(
  formData: FormData,
): Promise<{ text: string; source: "auto" | "pdf" }> {
  const file = formData.get("file");
  const encoding = String(formData.get("encoding") ?? "text") as UploadEncoding;
  if (!(file instanceof Blob)) {
    throw new UploadReadError("Nenhum arquivo recebido. Tente selecionar o arquivo de novo.");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (encoding === "xlsx") return { text: await xlsxToCsv(buffer), source: "auto" };
  if (encoding === "pdf") return { text: await pdfToText(buffer), source: "pdf" };
  return { text: buffer.toString("utf-8"), source: "auto" };
}
