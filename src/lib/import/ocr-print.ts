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

/** Largura e altura de um PNG ou JPEG, lidas do cabeçalho; null se não for nenhum dos dois. */
export function dimensoesDaImagem(imagem: Buffer): { largura: number; altura: number } | null {
  if (imagem.length > 24 && imagem.readUInt32BE(0) === 0x89504e47) return { largura: imagem.readUInt32BE(16), altura: imagem.readUInt32BE(20) };
  if (imagem.length < 4 || imagem[0] !== 0xff || imagem[1] !== 0xd8) return null;
  for (let i = 2; i + 9 < imagem.length; ) {
    if (imagem[i] !== 0xff) return null;
    const marca = imagem[i + 1];
    if (marca >= 0xc0 && marca <= 0xcf && marca !== 0xc4 && marca !== 0xc8 && marca !== 0xcc) return { largura: imagem.readUInt16BE(i + 7), altura: imagem.readUInt16BE(i + 5) };
    i += 2 + imagem.readUInt16BE(i + 2);
  }
  return null;
}

const temValor = (segmentos: Segmento[]) => segmentos.some((s) => /\d,\d{2}\b/.test(s.texto));
const encostam = (a: Segmento, b: Segmento) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * Os pedaços da segunda leitura (só a coluna da direita) que a primeira não tinha. A segunda
 * devolve a posição na imagem inteira, então os valores caem na altura da compra certa.
 */
export function juntarColunaDaDireita(primeira: Segmento[], direita: Segmento[]): Segmento[] {
  return [...primeira, ...direita.filter((d) => !primeira.some((p) => encostam(p, d)))];
}

export async function lerSegmentosDoPrint(imagem: Buffer): Promise<{ segmentos: Segmento[]; texto: string }> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("por", 1, { langPath: PASTA_IDIOMA, gzip: true, cachePath: "/tmp" });
  const ler = async (rectangle?: { left: number; top: number; width: number; height: number }) => {
    const r = await worker.recognize(imagem, rectangle ? { rectangle } : {}, { text: true, blocks: true });
    const blocos = (r.data.blocks ?? []) as unknown as Bloco[];
    return { segmentos: blocos.flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((l) => segmentosDaLinha(l.words)))), texto: r.data.text ?? "" };
  };
  try {
    // Modo "texto esparso" (11): lê cada pedaço solto da tela (a data à esquerda, o valor à
    // direita, o "2/3" embaixo). No modo automático o OCR pulava a coluna de datas e valores
    // curtos: 144 de 152 compras certas nos prints de teste, contra 152 de 152 assim.
    await worker.setParameters({ preserve_interword_spaces: "1", tessedit_pageseg_mode: "11" as never });
    const lido = await ler();
    // Valor em cinza claro na direita (24/10/2026, 9 prints de uma cliente em uma noite): o OCR lia
    // datas e nomes e pulava a coluna inteira dos valores, e nenhuma compra entrava. Lida sozinha,
    // a coluna aparece. Só quando a primeira leitura não achou valor nenhum.
    const dim = temValor(lido.segmentos) ? null : dimensoesDaImagem(imagem);
    if (!dim || dim.largura < 200) return lido;
    const left = Math.floor(dim.largura * 0.55);
    const direita = await ler({ left, top: 0, width: dim.largura - left, height: dim.altura });
    if (!temValor(direita.segmentos)) return lido;
    return { segmentos: juntarColunaDaDireita(lido.segmentos, direita.segmentos), texto: `${lido.texto}\n${direita.texto}` };
  } finally {
    await worker.terminate();
  }
}
