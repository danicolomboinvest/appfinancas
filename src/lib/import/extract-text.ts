/**
 * Extração de texto de arquivos de importação (extrato/carteira) no servidor.
 * O cliente manda o PRÓPRIO File dentro de FormData, nunca base64 numa string de action:
 * o React limita o total de caracteres de string dos argumentos a ~1 milhão ("Maximum array
 * nesting exceeded"), então qualquer arquivo >1 MB derrubava a action. Como File/Blob viaja
 * como anexo multipart, não conta nesse limite (só no bodySizeLimit, configurado à parte).
 *
 * As libs pesadas (xlsx, pdf-parse) são carregadas sob demanda (dynamic import), NUNCA no
 * topo: o pdf-parse (via pdfjs) pode falhar ao inicializar em serverless, e um import
 * estático derrubaria TODA a importação, inclusive CSV/OFX, que nem usam essas libs.
 */

export type UploadEncoding = "text" | "xlsx" | "pdf";

/** Erro esperado de leitura de arquivo, o cliente mostra a mensagem direto pro usuário. */
export class UploadReadError extends Error {}

/** O arquivo Excel está protegido por senha: o cliente pede a senha e reenvia o mesmo arquivo. */
export class PasswordRequiredError extends Error {}

/**
 * Muitos bancos exportam o extrato em Excel PROTEGIDO POR SENHA (arquivo criptografado, não é um
 * ZIP normal). O leitor de Excel não abre esses arquivos. Aqui: detecta a criptografia; se não
 * veio senha, sinaliza pro app pedir uma; com a senha, descriptografa e devolve o Excel "cru"
 * pra leitura normal. A senha é usada só neste instante, nunca fica salva nem é registrada.
 */
async function decryptIfProtected(buffer: Buffer, password: string | undefined): Promise<Buffer> {
  let office: { isEncrypted: (b: Buffer) => boolean; decrypt: (b: Buffer, o: { password: string }) => Promise<Buffer> };
  try {
    const mod = (await import("officecrypto-tool")) as unknown as {
      default?: typeof office;
      isEncrypted?: (b: Buffer) => boolean;
      decrypt?: (b: Buffer, o: { password: string }) => Promise<Buffer>;
    };
    office = (mod.default ?? mod) as typeof office;
  } catch {
    return buffer; // biblioteca indisponível: segue com o arquivo cru
  }

  let encrypted = false;
  try {
    encrypted = office.isEncrypted(buffer);
  } catch {
    encrypted = false;
  }
  if (!encrypted) return buffer;

  if (!password) throw new PasswordRequiredError("Este arquivo está protegido por senha.");
  try {
    return await office.decrypt(buffer, { password });
  } catch {
    throw new UploadReadError("Senha incorreta. Confira a senha do arquivo e tente de novo.");
  }
}

/** Excel → CSV com TODAS as planilhas concatenadas, extratos de banco (ex.: BTG) espalham
 * os ativos em várias abas (Fundos, Renda Fixa, Renda Variável); ler só a primeira perderia
 * tudo (a primeira costuma ser a capa). Descriptografa antes, se o arquivo tiver senha. */
async function xlsxToCsv(buffer: Buffer, password: string | undefined): Promise<string> {
  const decrypted = await decryptIfProtected(buffer, password);
  let XLSX: typeof import("xlsx");
  try {
    XLSX = await import("xlsx");
  } catch {
    throw new UploadReadError("Não consegui abrir o Excel neste servidor. Tente exportar como CSV.");
  }
  const workbook = XLSX.read(decrypted, { type: "buffer" });
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
 * - text: CSV/OFX, decodifica os bytes como UTF-8
 * - xlsx: Excel → CSV
 * - pdf: PDF → texto cru (source "pdf" para o parser de linhas)
 */
export async function extractUploadFromForm(
  formData: FormData,
): Promise<{ text: string; source: "auto" | "pdf" }> {
  const file = formData.get("file");
  const encoding = String(formData.get("encoding") ?? "text") as UploadEncoding;
  const passwordRaw = formData.get("password");
  const password = typeof passwordRaw === "string" && passwordRaw !== "" ? passwordRaw : undefined;
  if (!(file instanceof Blob)) {
    throw new UploadReadError("Nenhum arquivo recebido. Tente selecionar o arquivo de novo.");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (encoding === "xlsx") return { text: await xlsxToCsv(buffer, password), source: "auto" };
  if (encoding === "pdf") return { text: await pdfToText(buffer), source: "pdf" };
  return { text: buffer.toString("utf-8"), source: "auto" };
}
