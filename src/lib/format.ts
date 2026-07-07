/** Formata um número (já na escala 0-100) como percentual em pt-BR (vírgula decimal). */
export function formatPercentNumber(value: number, decimals = 1): string {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

/** Formata um valor em R$ de forma compacta (ex.: R$ 38 mi) — usado em eixos de gráfico. */
export function formatCompactBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  });
}
