/** Extrai ano/mês da rota atual (/mensal/2026/7). Fora dessas telas, cai no mês corrente —
 * assim o registro pelo botão central sempre lança no mês certo, esteja onde estiver no app. */
export function currentYearMonthFromPath(pathname: string): { year: number; month: number } {
  const match = pathname.match(/^\/mensal\/(\d+)(?:\/(\d+))?/);
  const now = new Date();
  const year = match?.[1] ? Number(match[1]) : now.getFullYear();
  const month = match?.[2] ? Number(match[2]) : now.getMonth() + 1;
  return { year, month };
}
