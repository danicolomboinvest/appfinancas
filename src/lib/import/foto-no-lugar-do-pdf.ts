/**
 * Foto no lugar do PDF (30/10/2026): em 14 dias, 31 pessoas subiram uma imagem (ou um PDF que é
 * só imagem) onde o app esperava o arquivo de texto do banco, 77 vezes, e ouviam "parece ser
 * escaneado ou uma foto, exporte em Excel". O app tem um leitor de print da fatura (OCR) que lê
 * justamente isso: aqui fica a decisão de qual leitor usar, e o caminho que leva a imagem (ou
 * as páginas do PDF desenhadas) até ele. Só o que a tela também usa: a leitura em si (OCR,
 * desenhar o PDF) fica em foto-no-lugar-do-pdf-servidor.ts, que o navegador não carrega.
 */

export type LeitorDoArquivo = "print" | "arquivo";

/** O que a pessoa vê quando nem o leitor de print achou uma fatura na imagem. */
export const MSG_FOTO_SEM_FATURA = "Não achei uma fatura nessa imagem. Mande o PDF do banco ou um print da tela do app, sem zoom, uma tela por vez.";

/** A linha de instrução ao lado do botão de arquivo. */
export const INSTRUCAO_PRINT = "Print da tela do app do banco, sem zoom, uma tela por vez";

/** Páginas do PDF que vão para o leitor de print: fatura cabe em poucas; cada uma custa uns 3 s de OCR. */
export const MAX_PAGINAS_COMO_PRINT = 4;

/** Os primeiros bytes dizem o que o arquivo é, mesmo com o nome ou o tipo errados ("IMG_1234" sem extensão). */
export function pareceImagemPelosBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return true; // PNG
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true; // JPEG
  const ascii = (de: number, ate: number) => String.fromCharCode(...bytes.subarray(de, ate));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return true;
  if (ascii(4, 8) === "ftyp" && /^(heic|heix|hevc|hevx|heif|mif1|msf1)$/.test(ascii(8, 12))) return true; // HEIC/HEIF
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return true; // BMP
  return false;
}

/**
 * Qual leitor lê este arquivo. Imagem (pelo tipo, pela extensão ou pelos bytes) e PDF que é só
 * imagem vão para o leitor de print da fatura; o resto segue pelos leitores de texto de sempre.
 */
export function qualLeitor(arquivo: { nome?: string | null; tipo?: string | null; bytes?: Uint8Array | null; pdfSoImagem?: boolean }): LeitorDoArquivo {
  if (arquivo.pdfSoImagem) return "print";
  if (/^image\//i.test(arquivo.tipo ?? "")) return "print";
  if (/\.(png|jpe?g|heic|heif|webp|bmp)$/i.test(arquivo.nome ?? "")) return "print";
  if (arquivo.bytes && pareceImagemPelosBytes(arquivo.bytes)) return "print";
  return "arquivo";
}

/** "YYYY-MM-DD" de hoje em Brasília: a data de envio que o leitor de print usa para o ano das compras. */
export function hojeParaOPrint(agora: Date = new Date()): string {
  return new Date(agora.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}
