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
import { pdfTextQuality, textoEmbaralhado } from "./pdf-quality";
import { linhasPorPosicao, precisaRemontarPorPosicao } from "./pdf-por-posicao";

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
export class PasswordRequiredError extends Error {
  /** A senha veio e não abriu (a tela pede de novo, com "Senha incorreta"). */
  readonly senhaErrada: boolean;
  constructor(message: string, senhaErrada = false) {
    super(message);
    this.senhaErrada = senhaErrada;
  }
}

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
    // Pede a senha de novo, como o PDF (14/10/2026). Como erro de leitura, o Excel da lista de
    // vários arquivos saía da espera da senha e virava "erro": a caixa da senha sumia e não
    // tinha como tentar outra sem mandar os arquivos de novo.
    throw new PasswordRequiredError("Senha incorreta. Confira a senha do arquivo e tente de novo.", true);
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

const PDF_ESTRAGADO = "Esse PDF não abriu: parece que o download veio incompleto. Baixe de novo no app do banco e envie outra vez.";

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
async function prepararAmbienteDoPdf(): Promise<void> {
  const g = globalThis as Record<string, unknown>;
  if (g.DOMMatrix && g.Path2D && g.ImageData) return;
  // Os de verdade primeiro (os do @napi-rs/canvas, que o próprio pdf.js usaria). A casca vazia
  // bastava pra extrair texto, mas quebrava a leitura por imagem (OCR): desenhar uma página com
  // traços chama `new Path2D().moveTo(...)`, e a casca não tem moveTo ("path2d.moveTo is not a
  // function", 13/10/2026). Como a casca entrava antes, o pdf.js nem tentava pôr os dele.
  try {
    const canvas = (await import("@napi-rs/canvas")) as unknown as Record<string, unknown>;
    g.DOMMatrix ??= canvas.DOMMatrix;
    g.Path2D ??= canvas.Path2D;
    g.ImageData ??= canvas.ImageData;
  } catch {
    // Sem o canvas no servidor: a casca vazia ainda deixa o texto sair.
  }
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
/**
 * PDF com "lixo" antes do começo de verdade: uma fatura do Inter chegou com a primeira METADE do
 * arquivo só de zeros (451 KB) e o PDF inteiro, perfeito, logo depois. O leitor procura o começo
 * ("%PDF-") só no início do arquivo e desistia com "Invalid Root reference" — a pessoa ouvia
 * "não consegui ler PDF neste servidor" duas vezes, com um arquivo que dava pra ler. Aqui o
 * arquivo passa a começar onde o PDF começa.
 */
function semLixoAntesDoPdf(buffer: Buffer): Buffer {
  const inicio = buffer.indexOf("%PDF-");
  // Cópia, não uma "janela" do mesmo buffer: o pdf.js lê o buffer por baixo a partir do zero.
  return inicio > 0 ? Buffer.from(buffer.subarray(inicio)) : buffer;
}

async function pdfToText(buffer: Buffer, password: string | undefined): Promise<string> {
  await prepararAmbienteDoPdf();
  let PDFParse: typeof import("pdf-parse").PDFParse;
  try {
    ({ PDFParse } = await import("pdf-parse"));
  } catch (err) {
    throw new UploadReadError(PDF_INDISPONIVEL, `biblioteca não carregou · ${causa(err)}`);
  }
  const parser = new PDFParse({ data: semLixoAntesDoPdf(buffer), password });
  try {
    const result = await parser.getText();
    // Fatura escrita letra por letra ("R $ 2 4 0 , 0 0") volta a ser texto normal aqui, antes de
    // qualquer leitor olhar pra ela — senão nem o tipo do documento seria reconhecido.
    const texto = normalizeLetterSpacedText(result.text ?? "");
    // Extrato guardado por coluna (o do app do Itaú): remonta as linhas pela posição na página.
    if (precisaRemontarPorPosicao(texto)) {
      const remontado = await textoPorPosicao(parser).catch(() => null);
      if (remontado) return remontado;
    }
    return texto;
  } catch (err) {
    // Arquivo trancado não é servidor quebrado. Dizer "manda em Excel" aqui era mandar a pessoa
    // procurar um arquivo que o banco nem oferece — a fatura sai em PDF e só em PDF. O Excel
    // protegido já pedia a senha; o PDF passa pela MESMA tela, pelo mesmo caminho.
    if (ehArquivoTrancado(err)) {
      throw new PasswordRequiredError(
        ehSenhaErrada(err)
          ? "Senha incorreta. Confira a senha do arquivo e tente de novo."
          : "Este arquivo está protegido por senha.",
        ehSenhaErrada(err),
      );
    }
    // Arquivo que não é PDF por dentro (download cortado, ou outro arquivo com o nome .pdf): o
    // problema é o arquivo, não o servidor. "Não consegui ler PDF neste servidor" mandava a
    // pessoa procurar CSV quando bastava baixar de novo (14/10/2026).
    if (err instanceof Error && err.name === "InvalidPDFException") {
      throw new UploadReadError(PDF_ESTRAGADO, `PDF inválido · ${causa(err)}`);
    }
    // O pdfjs abre o PDF num "worker" que é um arquivo à parte (pdf.worker.mjs). Quando esse
    // arquivo não vem junto no servidor, a falha aparece só aqui, na hora de ler — e não no
    // import acima. Por isso o motivo precisa ir junto pro diagnóstico.
    throw new UploadReadError(PDF_INDISPONIVEL, `leitura do PDF falhou · ${causa(err)}`);
  } finally {
    await parser.destroy();
  }
}

/** O texto do PDF linha a linha pela posição de cada pedaço na página (pdf-por-posicao.ts). */
async function textoPorPosicao(parser: import("pdf-parse").PDFParse): Promise<string | null> {
  type Doc = {
    numPages: number;
    getPage(n: number): Promise<{ getTextContent(): Promise<{ items: { str?: string; transform?: number[] }[] }> }>;
  };
  // O documento já aberto pelo getText; o pdf-parse não expõe as posições, só o texto pronto.
  const doc = await (parser as unknown as { load(): Promise<Doc> }).load();
  const paginas: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const conteudo = await (await doc.getPage(n)).getTextContent();
    const pedacos = conteudo.items
      .filter((i) => typeof i.str === "string" && Array.isArray(i.transform))
      .map((i) => ({ str: i.str as string, x: i.transform![4], y: i.transform![5] }));
    paginas.push(linhasPorPosicao(pedacos).join("\n"));
  }
  const texto = paginas.join("\n\n");
  return texto.trim() ? texto : null;
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
      "O arquivo chegou vazio (0 KB), o download provavelmente não terminou. Baixe de novo no app do banco e envie outra vez.",
      "arquivo com 0 bytes",
    );
  }
  if (encoding === "xlsx") return { text: semNulo(await xlsxToCsv(buffer, password)), source: "auto" };
  if (encoding === "pdf") {
    const texto = await pdfToText(buffer, password);
    // PDF que é só imagem (extrato impresso como foto) ou com o texto embaralhado pela fonte: lê
    // por OCR aqui mesmo no servidor. Falhou ou não leu nada? segue com o texto que saiu, que
    // mostra a mensagem de sempre.
    if (pdfTextQuality(texto) === "empty" || textoEmbaralhado(texto)) {
      try {
        const { lerPdfPorImagem } = await import("./ocr");
        const porImagem = await lerPdfPorImagem(buffer, password);
        if (porImagem) return { text: semNulo(porImagem), source: "pdf" };
      } catch (err) {
        console.error("leitura por imagem falhou", causa(err));
      }
    }
    return { text: semNulo(texto), source: "pdf" };
  }
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
