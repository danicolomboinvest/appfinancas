/**
 * PDF em que CADA LETRA vem separada por um espaço.
 *
 * Algumas faturas (Unicred e outras cooperativas) são geradas com a fonte posicionando letra por
 * letra. O texto que sai do PDF fica assim:
 *
 *   2 1 / o u t 5 7 9 9 5 4 7 8 L U C A S P a r c . 1 1 / 1 5 <tab> R $ 2 4 0 , 0 0
 *
 * Nenhum leitor reconhece uma data ou um valor escritos desse jeito. A fatura inteira de uma
 * cliente — 16 compras, R$ 2.950 — virou zero lançamentos; ela tentou quatro vezes, em dois dias,
 * nas duas telas, e o app só respondia que não conhecia o formato.
 *
 * O espaço entre duas letras da MESMA palavra e o espaço entre duas palavras são idênticos no
 * arquivo: não dá pra recuperar onde a palavra terminava. Então a gente junta tudo e reabre o
 * espaço onde a própria escrita denuncia a virada — dígito ao lado de letra ("out57995478") e
 * minúscula seguida de maiúscula ("PagamentoRecebido"). A data e o valor saem exatos; a descrição
 * sai legível, que é o que a pessoa precisa pra reconhecer o gasto.
 */

/** Quanto de uma linha precisa ser letra solta pra ela contar como espaçada. */
const PROPORCAO_DE_LETRAS_SOLTAS = 0.6;
/** Linha curta ("APP Cartão Unicred VISA") não é evidência de nada: 4 palavras normais passariam. */
const MINIMO_DE_PEDACOS = 6;
/** E o arquivo INTEIRO precisa ter cara disso, senão um PDF normal com uma linha esquisita
 * (uma sigla soletrada, um código de barras) teria essa linha destruída à toa. */
const PROPORCAO_DE_LINHAS_ESPACADAS = 0.4;

function pedacos(texto: string): string[] {
  return texto.split(/[ \t]+/).filter((p) => p !== "");
}

function linhaEhEspacada(linha: string): boolean {
  const partes = pedacos(linha);
  if (partes.length < MINIMO_DE_PEDACOS) return false;
  const soltas = partes.filter((p) => p.length === 1).length;
  return soltas / partes.length >= PROPORCAO_DE_LETRAS_SOLTAS;
}

/** O arquivo todo foi escrito letra por letra? */
export function isLetterSpacedText(texto: string): boolean {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (linhas.length === 0) return false;
  const espacadas = linhas.filter(linhaEhEspacada).length;
  return espacadas / linhas.length >= PROPORCAO_DE_LINHAS_ESPACADAS;
}

/**
 * Onde reabrir o espaço depois de juntar: letra colada em número, número colado em letra, e
 * minúscula seguida de maiúscula. "R$" colado no número NÃO conta ($ não é letra), senão o valor
 * se partiria em dois.
 */
const VIRADA_DE_PALAVRA = /(?<=\p{L})(?=\d)|(?<=\d)(?=\p{L})|(?<=\p{Ll})(?=\p{Lu})/gu;

function juntarPedacos(trecho: string): string {
  return trecho.split(" ").join("").replace(VIRADA_DE_PALAVRA, " ");
}

/**
 * Desfaz o espaçamento letra a letra, linha por linha. As tabulações separam as colunas do PDF
 * (descrição de um lado, valor do outro) e ficam onde estão. Linhas que já estão normais passam
 * intactas.
 */
export function unspaceLetters(texto: string): string {
  return texto
    .split(/\r?\n/)
    .map((linha) => (linhaEhEspacada(linha) ? linha.split("\t").map(juntarPedacos).join("\t") : linha))
    .join("\n");
}

/** Normaliza só quando o arquivo inteiro está espaçado; caso contrário devolve o texto original. */
export function normalizeLetterSpacedText(texto: string): string {
  return isLetterSpacedText(texto) ? unspaceLetters(texto) : texto;
}
