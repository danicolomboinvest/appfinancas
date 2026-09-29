import { nowInBrazil } from "./brazil-now";

/**
 * "Hoje" no calendário de Brasília, como meia-noite UTC — o mesmo formato em que o Prisma
 * devolve uma coluna `@db.Date` (pagamento de provento, data do lançamento).
 *
 * `new Date().setHours(...)` usa o fuso do servidor, que em produção é UTC: das 21h à meia-noite
 * de Brasília o servidor já está no dia seguinte, e o provento de AMANHÃ aparecia como "Caiu na
 * conta" (e o de hoje sumia dos "Próximos"). Comparar com esta data resolve nos dois sentidos:
 * `lte hoje` inclui o dia de hoje inteiro, `gte hoje` também.
 */
export function brazilTodayUtc(instant: Date = new Date()): Date {
  const b = nowInBrazil(instant);
  return new Date(Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()));
}

/** Soma dias numa data à meia-noite UTC (sem horário de verão no caminho). */
export function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
