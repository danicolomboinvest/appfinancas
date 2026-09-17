/**
 * Diagnóstico do texto que saiu de um PDF, pra dar uma resposta certa quando o arquivo não
 * serve, em vez de "não identifiquei ativos".
 *
 * Caso real: o "Extrato da Conta Investimento" da EQI/BTG aberto no iPhone e salvo como PDF
 * (Compartilhar › Imprimir) sai com os NÚMEROS em fonte de verdade e os NOMES dos ativos
 * desenhados como traços. O texto extraído tem 300 linhas de valores e nenhuma palavra —
 * nenhum leitor de texto vai achar um nome de ativo ali, e a pessoa precisa saber disso.
 */
export type PdfTextQuality = "ok" | "empty" | "numbers-only";

export function pdfTextQuality(text: string): PdfTextQuality {
  const readable = text.replace(/[^\p{L}\p{N}]/gu, "").length;
  if (readable < 12) return "empty";
  const words = new Set((text.match(/\p{L}{3,}/gu) ?? []).map((w) => w.toLowerCase()));
  const numbers = (text.match(/\d[\d.]*,\d{2}\b/g) ?? []).length;
  // Muitos valores e quase nenhuma palavra distinta (o rodapé "Ouvidoria" sobra sozinho).
  if (numbers >= 15 && words.size <= 5) return "numbers-only";
  return "ok";
}

export const NUMBERS_ONLY_MESSAGE =
  "Esse PDF veio da impressão pelo celular: os números estão lá, mas os nomes dos ativos viraram desenho, e sem nome não dá pra montar a carteira. Na corretora (EQI/BTG, XP…), exporte o extrato em Excel (.xlsx) — esse o app lê — ou baixe o PDF original pelo computador.";
