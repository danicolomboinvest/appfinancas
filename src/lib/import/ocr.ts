import path from "node:path";
import { OCR_MARCA } from "./ocr-marca";

/**
 * Lê PDF que é só uma imagem (extrato "impresso como foto", escaneado): desenha cada página e
 * passa o OCR (tesseract.js, em português) dentro do próprio servidor — o arquivo da cliente não
 * sai do app.
 *
 * O texto volta com a OCR_MARCA na frente, pra só ser aceito por leitor que confere o que leu.
 */

/** Páginas além disto não são lidas: cada uma custa uns 3 s e extrato de 1 mês cabe em poucas. */
const MAX_PAGINAS = 8;
/** 3x deixa o texto miúdo de extrato legível (1,5x lia "1.241,70" como "1241700"). */
const ESCALA = 3;

const PASTA_IDIOMA = path.join(process.cwd(), "node_modules", "@tesseract.js-data", "por", "4.0.0_best_int");

export async function lerPdfPorImagem(buffer: Buffer, password?: string): Promise<string | null> {
  const { PDFParse } = await import("pdf-parse");
  const { createWorker } = await import("tesseract.js");
  const parser = new PDFParse({ data: new Uint8Array(buffer), password });
  const worker = await createWorker("por", 1, { langPath: PASTA_IDIOMA, gzip: true, cachePath: "/tmp" });
  try {
    await worker.setParameters({ preserve_interword_spaces: "1" });
    const fotos = await parser.getScreenshot({
      scale: ESCALA,
      imageBuffer: true,
      imageDataUrl: false,
      first: MAX_PAGINAS,
    } as never);
    let texto = "";
    for (const pagina of fotos.pages.slice(0, MAX_PAGINAS)) {
      const r = await worker.recognize(Buffer.from(pagina.data));
      texto += `${r.data.text}\n`;
    }
    return texto.trim() ? `${OCR_MARCA}\n${texto}` : null;
  } finally {
    await worker.terminate();
    await parser.destroy();
  }
}
