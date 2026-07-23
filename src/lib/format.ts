/** Formata um número (já na escala 0-100) como percentual em pt-BR (vírgula decimal). */
export function formatPercentNumber(value: number, decimals = 1): string {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

/** Formata um valor em R$ por extenso (ex.: R$ 1.234,56). */
export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Formata um valor em R$ de forma compacta (ex.: R$ 38 mi), usado em eixos de gráfico. */
export function formatCompactBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  });
}

/** Formata um total de horas fracionárias como "Xh Ymin" (ex.: 4.1 -> "4h 6min"). */
export function formatHours(totalHours: number): string {
  const hours = Math.floor(totalHours);
  const minutes = Math.round((totalHours - hours) * 60);
  if (hours === 0) return `${minutes}min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}min`;
}
