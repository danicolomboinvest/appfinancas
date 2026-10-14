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

/**
 * Valor em vermelho e em verde (o extrato do Itaú pinta saída e entrada) some do OCR: na
 * conversão pra preto e branco do tesseract, o vermelho claro cai pro lado do fundo. Em 13/10/2026
 * isso tirou o valor de 20 de 59 linhas de um extrato. Aqui cada pixel vira o seu canal mais
 * escuro (vermelho, verde e preto ficam escuros) e o fundo claro vira branco (as listras cinza
 * entre as linhas também somem). Página em preto e branco não muda.
 */
export function pixelsEmCinza(rgba: Uint8ClampedArray): void {
  for (let i = 0; i < rgba.length; i += 4) {
    const menor = Math.min(rgba[i], rgba[i + 1], rgba[i + 2]);
    const v = menor > 200 ? 255 : menor;
    rgba[i] = v;
    rgba[i + 1] = v;
    rgba[i + 2] = v;
  }
}

async function paginaEmCinza(png: Buffer): Promise<Buffer> {
  try {
    const canvas = await import("@napi-rs/canvas");
    const img = await canvas.loadImage(png);
    const tela = canvas.createCanvas(img.width, img.height);
    const ctx = tela.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const dados = ctx.getImageData(0, 0, img.width, img.height);
    pixelsEmCinza(dados.data);
    ctx.putImageData(dados, 0, 0);
    return tela.toBuffer("image/png");
  } catch {
    return png; // sem o canvas: a página vai como veio
  }
}

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
      const r = await worker.recognize(await paginaEmCinza(Buffer.from(pagina.data)));
      texto += `${r.data.text}\n`;
    }
    return texto.trim() ? `${OCR_MARCA}\n${texto}` : null;
  } finally {
    await worker.terminate();
    await parser.destroy();
  }
}
