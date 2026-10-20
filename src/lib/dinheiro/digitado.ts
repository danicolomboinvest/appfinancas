/**
 * Dinheiro digitado num campo: a regra única do app (14/10/2026).
 *
 * Todo campo de valor funciona como a maquininha: cada dígito entra pela direita, e os dois
 * últimos são sempre os centavos. "1234,56", "1.234,56", "1234.56" e "123456" dão R$ 1.234,56;
 * "0,99" dá R$ 0,99. Como o campo mostra o valor sempre com as duas casas ("1.234,56"), apagar
 * um dígito tira o último centavo, e o que ela vê é sempre o que vai ser salvo.
 *
 * Antes cada tela tinha seu jeito, e várias liam só os dígitos como REAIS: quem digitava
 * "1234,56" numa dívida via R$ 123.456 (100 vezes mais), e o teclado do iPhone nem mostrava a
 * vírgula. Uma cliente pediu reembolso por isso ("não dava pra colocar os centavos").
 */

/** Centavos inteiros do texto digitado, ou null se não há nenhum dígito. */
/**
 * O maior valor que o app aceita (20/10/2026): 10 bilhões na moeda dela. Em reais nunca chega
 * perto; em pesos argentinos cobre um imóvel (antes o teto de 100 milhões cortava em silêncio um
 * financiamento de ARS 150 milhões). As colunas de dinheiro do banco vão até 10^16.
 */
export const MAIOR_VALOR = 10_000_000_000;

export function centavosDoTexto(texto: string, semCentavos = false): number | null {
  const digitos = texto.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (digitos === "") return null;
  // 13 dígitos = R$ 99 bilhões: acima disso o Number perde a conta, e nenhum valor real chega lá.
  // Peso chileno (semCentavos): os dígitos são pesos inteiros, e o "centavo" interno é sempre 00.
  return semCentavos ? Number(digitos.slice(0, 11)) * 100 : Number(digitos.slice(0, 13));
}

/** O valor em reais (1234.56) do texto digitado, ou null se o campo está vazio. */
export function reaisDoTexto(texto: string): number | null {
  const c = centavosDoTexto(texto);
  return c === null ? null : c / 100;
}

/** Reais com no máximo 2 casas, sem o erro do ponto flutuante (0.1 + 0.2). */
export function emCentavos(reais: number): number {
  return Math.round(reais * 100);
}

/**
 * Reais de um texto livre que chega no servidor (FormData) ou de um campo sem máscara.
 *
 * Aceita o hidden do CurrencyField ("1234.56", "1234.5", "1234"), o jeito brasileiro ("1.234,56",
 * "1234,56", "0,99") e o milhar sem centavos ("1.234" = mil duzentos e trinta e quatro).
 * Ponto seguido de 1 ou 2 dígitos no fim é decimal; seguido de 3, é milhar. Devolve null
 * quando não é um número.
 */
export function reaisDoCampo(texto: string): number | null {
  const t = texto.replace(/[^\d.,-]/g, "");
  if (!/\d/.test(t)) return null;
  let normal: string;
  if (t.includes(",")) normal = t.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d+\.\d{1,2}$/.test(t)) normal = t;
  else normal = t.replace(/\./g, "");
  const n = Number(normal);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}
