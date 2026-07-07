/**
 * Quantos meses de `year` já ocorreram (ou estão em curso) na data de hoje — usado para
 * separar "realizado até agora" de meses futuros que só têm lançamentos por causa de
 * despesas recorrentes lançadas antecipadamente (ver `getYearlySummary`).
 */
export function monthsElapsedInYear(year: number, today: Date = new Date()): number {
  const currentYear = today.getFullYear();
  if (year < currentYear) return 12;
  if (year > currentYear) return 0;
  return today.getMonth() + 1;
}
