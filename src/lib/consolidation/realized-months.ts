import { nowInBrazil } from "@/lib/date/brazil-now";

/**
 * Quantos meses de `year` já ocorreram (ou estão em curso) na data de hoje, usado para
 * separar "realizado até agora" de meses futuros que só têm lançamentos por causa de
 * despesas recorrentes lançadas antecipadamente (ver `getYearlySummary`).
 */
export function monthsElapsedInYear(year: number, today: Date = nowInBrazil()): number {
  const currentYear = today.getFullYear();
  if (year < currentYear) return 12;
  if (year > currentYear) return 0;
  return today.getMonth() + 1;
}

/**
 * Qual mês comparar com qual na seta "vs. mês passado" da Visão geral. Só mês FECHADO contra
 * mês fechado: o mês em andamento (dia 2, salário ainda não caiu) contra o mês anterior inteiro
 * dava "Renda ↓ 100%" em vermelho e "Gastos ↓ 85%" em verde todo começo de mês.
 * - Ano passado: dezembro contra novembro.
 * - Ano corrente: o último mês fechado contra o anterior a ele. Em janeiro nenhum mês do ano
 *   fechou ainda, então não há comparação (`null`), e num ano futuro também não.
 */
export function mesesDaComparacao(
  year: number,
  today: Date = nowInBrazil(),
): { atual: { year: number; month: number }; anterior: { year: number; month: number } } | null {
  const currentYear = today.getFullYear();
  if (year > currentYear) return null;
  const atualMonth = year < currentYear ? 12 : today.getMonth();
  if (atualMonth < 1) return null;
  const anterior = new Date(year, atualMonth - 2, 1);
  return { atual: { year, month: atualMonth }, anterior: { year: anterior.getFullYear(), month: anterior.getMonth() + 1 } };
}
