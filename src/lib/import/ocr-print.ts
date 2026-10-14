import path from "node:path";
import type { Segmento } from "./print-fatura";

/**
 * OCR de UM print da fatura aberta, no servidor, com o mesmo tesseract (português) que lê o PDF
 * que é só imagem (lib/import/ocr.ts). A imagem não sai do app.
 *
 * Devolve os pedaços de texto com a posição de cada um: a leitura da lista (print-fatura.ts)
 * monta cada compra pela posição, porque o OCR lê a coluna dos nomes e a dos valores separadas.
 * Uma imagem por chamada: cada uma leva ~1 a 3 s, e a tela manda uma de cada vez.
 */

const PASTA_IDIOMA = path.join(process.cwd(), "node_modules", "@tesseract.js-data", "por", "4.0.0_best_int");

type Palavra = { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } };
type Bloco = { paragraphs: { lines: { words: Palavra[] }[] }[] };

/**
 * "R$" e "2.927,05" com confiança 0 (14/10/2026, print do BTG/EQI): o texto vinha certo, mas o
 * tesseract dá nota baixa à linha inteira quando o "-" fica solto na frente do valor, e o corte
 * por confiança jogava o valor fora (sobrava só o "-"). Pedaço com cara de valor fica sempre.
 */
function pareceValor(texto: string): boolean {
  return /^[-+−–]?(r\$|rs)$|^[-+−–]?(r\$)?\d{1,3}(\.\d{3})*,\d{2}$/i.test(texto.trim());
}

/** Uma linha do OCR vira um pedaço por trecho contínuo: "Padaria Pão" e "R$ 23,50" lá na direita ficam separados. */
export function segmentosDaLinha(palavras: Palavra[]): Segmento[] {
  const ws = palavras.filter((w) => w.text.trim() && (w.confidence >= 20 || pareceValor(w.text))).sort((a, b) => a.bbox.x0 - b.bbox.x0);
  const segs: Segmento[] = [];
  for (const w of ws) {
    const h = w.bbox.y1 - w.bbox.y0;
    const ultimo = segs[segs.length - 1];
    if (ultimo && w.bbox.x0 - ultimo.x1 < h * 1.6) {
      ultimo.texto += ` ${w.text}`;
      ultimo.x1 = w.bbox.x1;
      ultimo.y0 = Math.min(ultimo.y0, w.bbox.y0);
      ultimo.y1 = Math.max(ultimo.y1, w.bbox.y1);
    } else segs.push({ texto: w.text, x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 });
  }
  return segs;
}

export async function lerSegmentosDoPrint(imagem: Buffer): Promise<{ segmentos: Segmento[]; texto: string }> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("por", 1, { langPath: PASTA_IDIOMA, gzip: true, cachePath: "/tmp" });
  try {
    // Modo "texto esparso" (11): lê cada pedaço solto da tela (a data à esquerda, o valor à
    // direita, o "2/3" embaixo). No modo automático o OCR pulava a coluna de datas e valores
    // curtos: 144 de 152 compras certas nos prints de teste, contra 152 de 152 assim.
    await worker.setParameters({ preserve_interword_spaces: "1", tessedit_pageseg_mode: "11" as never });
    const r = await worker.recognize(imagem, {}, { text: true, blocks: true });
    const blocos = (r.data.blocks ?? []) as unknown as Bloco[];
    const segmentos = blocos.flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((l) => segmentosDaLinha(l.words))));
    return { segmentos, texto: r.data.text ?? "" };
  } finally {
    await worker.terminate();
  }
}
