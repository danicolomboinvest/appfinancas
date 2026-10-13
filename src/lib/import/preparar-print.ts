/**
 * Preparo do print da fatura antes do OCR (13/10/2026). Roda no aparelho, num canvas, antes do
 * envio: a imagem viaja menor e já do jeito que o OCR lê melhor.
 *
 * - Tons de cinza com contraste esticado: o cinza claro da linha "Parcela 2/3" fica legível.
 * - Tela escura (modo escuro, C6, XP) vira clara: o tesseract lê texto escuro em fundo claro.
 * - Tamanho: largura entre 1.100 e 1.600 px. Print de iPhone (1.170 a 1.290) já está nessa faixa;
 *   foto da câmera (3.000 px) diminui e print pequeno (Android de 720 px) aumenta.
 *
 * Pura (só números), para testar sem navegador.
 */

export const LARGURA_MIN = 1100;
export const LARGURA_MAX = 1600;

/** A escala que deixa a largura do print entre LARGURA_MIN e LARGURA_MAX. */
export function escalaDoPrint(largura: number): number {
  if (largura < LARGURA_MIN) return Math.min(2, LARGURA_MIN / largura);
  if (largura > LARGURA_MAX) return LARGURA_MAX / largura;
  return 1;
}

/** RGBA → RGBA em cinza, claro no fundo, com contraste esticado. Devolve um array novo. */
export function prepararPixels(rgba: Uint8ClampedArray, largura: number, altura: number): { pixels: Uint8ClampedArray; largura: number; altura: number; escuro: boolean } {
  const n = largura * altura;
  const cinza = new Uint8Array(n);
  const histograma = new Uint32Array(256);
  let soma = 0;
  for (let i = 0; i < n; i++) {
    const y = Math.round(0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]);
    cinza[i] = y;
    soma += y;
  }
  const escuro = n > 0 && soma / n < 110;
  for (let i = 0; i < n; i++) {
    if (escuro) cinza[i] = 255 - cinza[i];
    histograma[cinza[i]]++;
  }
  // Estica entre o 1% mais escuro e o 1% mais claro (o texto chega no preto, o fundo no branco).
  const corte = n * 0.01;
  let lo = 0;
  for (let acc = 0; lo < 255 && (acc += histograma[lo]) < corte; lo++);
  let hi = 255;
  for (let acc = 0; hi > 0 && (acc += histograma[hi]) < corte; hi--);
  if (hi - lo < 30) {
    lo = 0;
    hi = 255;
  }
  const saida = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const v = Math.max(0, Math.min(255, Math.round(((cinza[i] - lo) * 255) / (hi - lo))));
    saida[i * 4] = v;
    saida[i * 4 + 1] = v;
    saida[i * 4 + 2] = v;
    saida[i * 4 + 3] = 255;
  }
  return { pixels: saida, largura, altura, escuro };
}
