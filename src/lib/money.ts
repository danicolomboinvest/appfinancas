/**
 * Moeda do app — um lugar só que sabe formatar dinheiro.
 *
 * Até aqui o app tinha "R$" cravado em 151 lugares e 48 cópias da mesma função `formatBRL`,
 * então a preferência de moeda que já existia em Configurações não mudava nada na tela (a
 * própria tela avisava que era "para uma próxima atualização"). Com a formatação centralizada,
 * trocar a moeda passa a valer no app inteiro.
 *
 * IMPORTANTE, e vale repetir onde a pessoa escolhe: trocar a moeda NÃO converte valor nenhum.
 * Quem lançou 3.000 vê "€ 3.000" em vez de "R$ 3.000" — o número é o mesmo. Converter exigiria
 * saber a cotação do dia de CADA lançamento passado, e chutar isso mexeria no histórico
 * financeiro da pessoa. A moeda aqui é rótulo, não câmbio.
 */

export const CURRENCIES = {
  BRL: { label: "Real", symbol: "R$" },
  USD: { label: "Dólar", symbol: "US$" },
  EUR: { label: "Euro", symbol: "€" },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export const DEFAULT_CURRENCY: CurrencyCode = "BRL";

export function isCurrencyCode(value: string): value is CurrencyCode {
  return value in CURRENCIES;
}

/** Nunca confia no que veio do banco: moeda antiga/inválida cai no padrão em vez de quebrar a tela. */
export function toCurrencyCode(value: string | null | undefined): CurrencyCode {
  return value && isCurrencyCode(value) ? value : DEFAULT_CURRENCY;
}

export function currencySymbol(currency: CurrencyCode): string {
  return CURRENCIES[currency].symbol;
}

export type MoneyOptions = {
  /** Esconde os centavos (R$ 1.235). Usado em gráficos e cards, onde centavo é ruído. */
  round?: boolean;
  /** Abrevia (R$ 38 mi). Usado em eixo de gráfico, onde não cabe o número inteiro. */
  compact?: boolean;
  /** Só o número, sem símbolo — para quando o símbolo já está desenhado ao lado (inputs). */
  bare?: boolean;
};

/**
 * O idioma da formatação é sempre pt-BR, mesmo em euro ou dólar — de propósito.
 *
 * O público do app é brasileiro; quem mora fora continua lendo "1.234,56" sem tropeçar, e só o
 * símbolo muda. Usar en-US no dólar traria "1,234.56", trocando ponto e vírgula de lugar bem no
 * meio de uma tela de finanças, que é onde esse tipo de troca mais confunde.
 */
export function formatMoney(
  value: number,
  currency: CurrencyCode,
  options: MoneyOptions = {},
): string {
  const { round = false, compact = false, bare = false } = options;

  if (bare) {
    return value.toLocaleString("pt-BR", {
      minimumFractionDigits: round ? 0 : 2,
      maximumFractionDigits: round ? 0 : 2,
    });
  }

  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency,
    ...(compact
      ? { notation: "compact" as const, maximumFractionDigits: 1 }
      : {}),
    // Os dois juntos: só `maximumFractionDigits` não tira os centavos, porque o mínimo
    // padrão de uma moeda é 2 casas e o Intl respeita o mínimo.
    ...(round && !compact
      ? { minimumFractionDigits: 0, maximumFractionDigits: 0 }
      : {}),
  });
}

/** Assinatura pronta pra ser guardada numa variável e chamada como `money(valor)`. */
export type MoneyFormatter = (value: number, options?: MoneyOptions) => string;

export function makeMoneyFormatter(currency: CurrencyCode): MoneyFormatter {
  return (value, options) => formatMoney(value, currency, options);
}
