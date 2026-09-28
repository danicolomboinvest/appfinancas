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

import { normalizeLetterSpacedText } from "./letter-spaced";

export type UploadEncoding = "text" | "xlsx" | "pdf";

/**
 * Erro esperado de leitura de arquivo, o cliente mostra a mensagem direto pro usuário.
 * `detail` é a causa técnica: NÃO vai pra tela, vai só pro registro de diagnóstico. Sem isso a
 * checagem diária lia "Não consegui ler PDF neste servidor" e não tinha como saber se o motivo
 * era a biblioteca faltando, o arquivo do worker faltando ou um PDF quebrado — três defeitos
 * diferentes com a mesma cara.
 */
export class UploadReadError extends Error {
  readonly detail?: string;
  constructor(message: string, detail?: string) {
    super(message);
    this.detail = detail;
  }
}

/** Causa técnica enxuta de um erro qualquer, pro registro de diagnóstico. */
function causa(err: unknown): string {
  const raw = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  return raw.replace(/\s+/g, " ").slice(0, 160);
}

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
  // Data de verdade do Excel (célula com o formato "data abreviada") sai por padrão no jeito
  // americano, "6/30/26", e nenhum leitor entendia: o lançamento caía no mês corrente. Com
  // dateNF ela sai como a pessoa vê no Brasil, "30/06/2026".
  const workbook = XLSX.read(decrypted, { type: "buffer", dateNF: "dd/mm/yyyy" });
  return workbook.SheetNames.map((name) => XLSX.utils.sheet_to_csv(workbook.Sheets[name], { FS: ";" })).join("\n");
}

const PDF_INDISPONIVEL =
  "Não consegui ler PDF neste servidor. Envie o extrato em CSV ou Excel (a maioria dos bancos exporta nesses formatos).";

/**
 * Dá ao pdf.js os objetos de navegador que ele espera existir só por estar sendo carregado.
 *
 * Em produção a biblioteca nem chegava a abrir: `ReferenceError: DOMMatrix is not defined`, 36
 * tentativas de 9 clientes em um único dia, todo PDF falhando. Aqui no Mac isso não acontece —
 * o pacote tem várias versões de si mesmo (uma pra Node, uma pra navegador) e o empacotador da
 * Vercel escolhe outra, que assume estar num navegador de verdade.
 *
 * Os três objetos abaixo só são usados pra DESENHAR a página. Extrair texto não desenha nada,
 * então uma casca vazia basta pra biblioteca carregar e o texto sair. Não substitui nada que já
 * exista: onde os objetos são de verdade (um navegador), eles continuam sendo os de verdade.
 */
function prepararAmbienteDoPdf(): void {
  const g = globalThis as Record<string, unknown>;
  g.DOMMatrix ??= class {};
  g.Path2D ??= class {};
  g.ImageData ??= class {};
}

/**
 * O PDF está trancado com senha (ou a senha que veio não abriu).
 *
 * Fatura de cartão em PDF quase sempre vem assim: Banco do Brasil (Ourocard), Bradesco e as
 * lojas mandam o arquivo pedindo CPF ou data de nascimento pra abrir. O pdfjs sinaliza isso com
 * um erro de nome próprio, e é só isso que dá pra usar — a biblioteca não expõe o código do
 * erro, só o nome e a frase.
 */
function ehArquivoTrancado(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.name === "PasswordException" || /^(no password given|incorrect password)/i.test(err.message);
}

/** Senha faltando e senha errada têm a mesma cara pro código, mas não pra quem está na tela. */
function ehSenhaErrada(err: unknown): boolean {
  return err instanceof Error && /incorrect\s*password/i.test(err.message);
}

/** PDF → texto cru (todas as páginas). Descriptografa se vier senha. */
async function pdfToText(buffer: Buffer, password: string | undefined): Promise<string> {
  prepararAmbienteDoPdf();
  let PDFParse: typeof import("pdf-parse").PDFParse;
  try {
    ({ PDFParse } = await import("pdf-parse"));
  } catch (err) {
    throw new UploadReadError(PDF_INDISPONIVEL, `biblioteca não carregou · ${causa(err)}`);
  }
  const parser = new PDFParse({ data: buffer, password });
  try {
    const result = await parser.getText();
    // Fatura escrita letra por letra ("R $ 2 4 0 , 0 0") volta a ser texto normal aqui, antes de
    // qualquer leitor olhar pra ela — senão nem o tipo do documento seria reconhecido.
    return normalizeLetterSpacedText(result.text ?? "");
  } catch (err) {
    // Arquivo trancado não é servidor quebrado. Dizer "manda em Excel" aqui era mandar a pessoa
    // procurar um arquivo que o banco nem oferece — a fatura sai em PDF e só em PDF. O Excel
    // protegido já pedia a senha; o PDF passa pela MESMA tela, pelo mesmo caminho.
    if (ehArquivoTrancado(err)) {
      throw new PasswordRequiredError(
        ehSenhaErrada(err)
          ? "Senha incorreta. Confira a senha do arquivo e tente de novo."
          : "Este arquivo está protegido por senha.",
      );
    }
    // O pdfjs abre o PDF num "worker" que é um arquivo à parte (pdf.worker.mjs). Quando esse
    // arquivo não vem junto no servidor, a falha aparece só aqui, na hora de ler — e não no
    // import acima. Por isso o motivo precisa ir junto pro diagnóstico.
    throw new UploadReadError(PDF_INDISPONIVEL, `leitura do PDF falhou · ${causa(err)}`);
  } finally {
    await parser.destroy();
  }
}

/**
 * Lê o upload de um FormData ({ file, encoding }) e normaliza num par { text, source }
 * que os parsers entendem.
 * - text: CSV/OFX, decodifica os bytes como UTF-8 (ou Windows-1252, ver decodificarTexto)
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
  // Arquivo de 0 bytes: o download no celular não terminou. Sem isto o PDF caía em "não consegui
  // ler PDF neste servidor, mande em Excel" — culpando o app e mandando atrás de outro formato.
  if (buffer.length === 0) {
    throw new UploadReadError(
      "O arquivo chegou vazio (0 KB) — o download provavelmente não terminou. Baixe de novo no app do banco e envie outra vez.",
      "arquivo com 0 bytes",
    );
  }
  if (encoding === "xlsx") return { text: semNulo(await xlsxToCsv(buffer, password)), source: "auto" };
  if (encoding === "pdf") return { text: semNulo(await pdfToText(buffer, password)), source: "pdf" };
  return { text: semNulo(decodificarTexto(buffer)), source: "auto" };
}

/**
 * CSV/OFX → texto. Muito banco brasileiro exporta em Latin-1 (Windows-1252), não em UTF-8, e
 * lido como UTF-8 cada acento virava "�": o cabeçalho "Histórico;Crédito;Débito" deixava de ser
 * reconhecido, as saídas sumiam e toda descrição virava "Lançamento". Byte que não é UTF-8
 * válido só acontece nesses arquivos, então é esse o sinal pra ler de novo como Windows-1252
 * (que cobre o Latin-1 e o CHARSET:1252 do OFX).
 */
export function decodificarTexto(buffer: Buffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

/**
 * Tira o caractere NULO (código 0, invisível). Alguns arquivos de banco trazem esse caractere
 * no meio do texto: a revisão mostrava os lançamentos normalmente, mas o banco de dados recusa
 * gravar texto com ele e a importação inteira caía na hora de confirmar.
 */
function semNulo(text: string): string {
  return text.includes("\u0000") ? text.replace(/\u0000/g, "") : text;
}
