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

/** "-- 3 of 9 --": a marca de página que o leitor de PDF põe sozinho, não é texto do arquivo. */
const MARCA_DE_PAGINA_RE = /^\s*-- \d+ of \d+ --\s*$/gm;

export function pdfTextQuality(text: string): PdfTextQuality {
  // Sem tirar a marca, um PDF escaneado de 9 páginas tinha "1of9 … 9of9" = 36 letras e números,
  // passava por "ok" e nunca ia para a leitura por imagem (fatura de prints em 07/10/2026).
  const readable = text.replace(MARCA_DE_PAGINA_RE, "").replace(/[^\p{L}\p{N}]/gu, "").length;
  if (readable < 12) return "empty";
  const words = new Set((text.match(/\p{L}{3,}/gu) ?? []).map((w) => w.toLowerCase()));
  const numbers = (text.match(/\d[\d.]*,\d{2}\b/g) ?? []).length;
  // Muitos valores e quase nenhuma palavra distinta (o rodapé "Ouvidoria" sobra sozinho).
  if (numbers >= 15 && words.size <= 5) return "numbers-only";
  return "ok";
}

export const NUMBERS_ONLY_MESSAGE =
  "Esse PDF veio da impressão pelo celular: os números estão lá, mas os nomes dos ativos viraram desenho, e sem nome não dá para montar a carteira. Na corretora (EQI/BTG, XP…), exporte o extrato em Excel (.xlsx), esse o app lê, ou baixe o PDF original pelo computador.";

/**
 * O texto saiu "embaralhado": a fonte do PDF não diz qual letra é cada desenho, e cada letra vira
 * outro símbolo ("30@0 90;F0:4;@<?" no lugar de "data lançamentos"). Visto num extrato do Itaú e
 * numa fatura em 13/10/2026. Pra quem lê, o arquivo é perfeito; pro texto, é cifra. O caminho é
 * o mesmo do PDF escaneado: ler a página como imagem.
 *
 * Sinal: muito símbolo de pontuação no meio das "palavras" e nenhuma das palavras que todo
 * extrato ou fatura tem.
 */
export function textoEmbaralhado(text: string): boolean {
  const semEspaco = text.replace(/\s/g, "");
  if (semEspaco.length < 200) return false;
  const simbolos = (semEspaco.match(/[<>?@;'"!=[\]{}#&%^~`|\\+*()]/g) ?? []).length;
  if (simbolos / semEspaco.length < 0.06) return false;
  const palavras = new Set((text.match(/\p{L}{3,}/gu) ?? []).map((w) => w.toLowerCase()));
  const comuns = ["saldo", "data", "valor", "total", "conta", "extrato", "pagamento", "compra", "fatura", "banco", "cliente", "para"];
  return comuns.filter((w) => palavras.has(w)).length <= 1;
}
