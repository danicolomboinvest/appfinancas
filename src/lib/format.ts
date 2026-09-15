/** Formata um número (já na escala 0-100) como percentual em pt-BR (vírgula decimal). */
export function formatPercentNumber(value: number, decimals = 1): string {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

/** Formata um total de horas fracionárias como "Xh Ymin" (ex.: 4.1 -> "4h 6min"). */
export function formatHours(totalHours: number): string {
  const hours = Math.floor(totalHours);
  const minutes = Math.round((totalHours - hours) * 60);
  if (hours === 0) return `${minutes}min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}min`;
}
