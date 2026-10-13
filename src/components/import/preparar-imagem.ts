"use client";

import { escalaDoPrint, prepararPixels } from "@/lib/import/preparar-print";
import { UPLOAD_MAX_BYTES } from "@/lib/import/limites";

/**
 * Prepara o print da fatura no próprio aparelho antes do envio (ver lib/import/preparar-print):
 * tamanho certo para o OCR, cinza com contraste, tela escura vira clara. De quebra, a foto em HEIC
 * do iPhone vira PNG (o navegador abre o HEIC, o OCR do servidor não).
 *
 * Qualquer falha devolve o arquivo original: o servidor ainda tenta ler.
 */
export async function prepararImagem(arquivo: File): Promise<Blob> {
  try {
    const bitmap = await abrir(arquivo);
    const escala = escalaDoPrint(bitmap.width);
    const largura = Math.max(1, Math.round(bitmap.width * escala));
    const altura = Math.max(1, Math.round(bitmap.height * escala));
    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return arquivo;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, largura, altura);
    if ("close" in bitmap) bitmap.close();
    const dados = ctx.getImageData(0, 0, largura, altura);
    const pronto = prepararPixels(dados.data, largura, altura);
    ctx.putImageData(new ImageData(new Uint8ClampedArray(pronto.pixels), largura, altura), 0, 0);
    const png = await paraBlob(canvas, "image/png");
    // PNG grande demais (foto muito comprida): JPEG em cinza fica bem menor e o OCR lê igual.
    const blob = png && png.size <= UPLOAD_MAX_BYTES ? png : await paraBlob(canvas, "image/jpeg", 0.9);
    return blob && blob.size <= UPLOAD_MAX_BYTES ? blob : arquivo;
  } catch {
    return arquivo;
  }
}

async function abrir(arquivo: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(arquivo);
    } catch {
      // Safari antigo não abre HEIC por aqui; a tag <img> abre.
    }
  }
  const url = URL.createObjectURL(arquivo);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function paraBlob(canvas: HTMLCanvasElement, tipo: string, qualidade?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, tipo, qualidade));
}

/** O dia de hoje no aparelho ("AAAA-MM-DD"): "Hoje" e "Ontem" do print são do fuso dela, não do servidor. */
export function hojeNoAparelho(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
