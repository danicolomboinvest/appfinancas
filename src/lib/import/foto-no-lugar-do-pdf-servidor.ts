import type { PrintLido } from "@/lib/import/print-fatura";
import { MAX_PAGINAS_COMO_PRINT } from "./foto-no-lugar-do-pdf";

/**
 * A parte de servidor de "foto no lugar do PDF" (ver foto-no-lugar-do-pdf.ts): desenhar as páginas
 * do PDF e passar as imagens pelo leitor de print da fatura (OCR). Fica fora do arquivo da decisão
 * porque a tela importa aquele, e o tesseract e o pdf-parse não entram no navegador.
 */

/** Cada página do PDF desenhada como PNG (as primeiras), para o leitor de print. */
export async function paginasDoPdfComoImagens(buffer: Buffer, password?: string, max = MAX_PAGINAS_COMO_PRINT): Promise<Buffer[]> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer), password });
  try {
    const fotos = await parser.getScreenshot({ scale: 2, imageBuffer: true, imageDataUrl: false, first: max } as never);
    return fotos.pages.slice(0, max).map((p) => Buffer.from(p.data));
  } finally {
    await parser.destroy();
  }
}

/**
 * As imagens pelo leitor de print da fatura, uma a uma (a mesma leitura de `lerPrintDaFaturaAction`:
 * OCR, e a imagem ampliada quando a primeira passada não acha nada). Nenhuma com compra: null.
 */
export async function lerImagensComoPrints(imagens: Buffer[], envio: string): Promise<{ prints: PrintLido[]; banco: string | null } | null> {
  const { ampliarParaOcr, lerSegmentosDoPrint } = await import("@/lib/import/ocr-print");
  const { lerQualquerPrint } = await import("@/lib/import/print-testando");
  const { bancoDoPrint } = await import("@/lib/import/print-fatura");
  const prints: PrintLido[] = [];
  let banco: string | null = null;
  for (const imagem of imagens) {
    let { segmentos } = await lerSegmentosDoPrint(imagem);
    let lido = lerQualquerPrint(segmentos, envio);
    if (!lido) {
      try {
        segmentos = (await lerSegmentosDoPrint(await ampliarParaOcr(imagem))).segmentos;
        lido = lerQualquerPrint(segmentos, envio);
      } catch (err) {
        console.error("foto no lugar do PDF: ampliar falhou", err instanceof Error ? err.message : err);
      }
    }
    if (!lido || lido.linhas.length === 0) continue;
    prints.push(lido);
    banco ??= bancoDoPrint(segmentos.map((x) => x.texto));
  }
  return prints.length > 0 ? { prints, banco } : null;
}
