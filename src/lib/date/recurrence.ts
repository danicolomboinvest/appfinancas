/**
 * Data das cópias de um lançamento recorrente: "aluguel todo dia 5" tem que cair no dia 5 de
 * cada mês seguinte, e não perder a data no caminho.
 */

/**
 * Mesmo dia do mês, no mês de destino. Dia que não existe lá (31 em fevereiro, 31 em abril)
 * encosta no último dia daquele mês — `new Date(2026, 1, 31)` sozinho viraria 3 de março,
 * jogando a despesa pro mês errado e furando a consolidação, que é por year/month.
 *
 * Meio-dia, mesma convenção do resto do app: às 00:00 a conversão pro fuso do servidor (UTC)
 * puxaria a data pro dia anterior.
 */
export function sameDayInMonth(reference: Date, year: number, month: number): Date {
  // O campo no banco é @db.Date; ler em UTC evita escorregar um dia conforme o fuso do servidor.
  const day = reference.getUTCDate();
  const lastDayOfTarget = new Date(year, month, 0).getDate();
  const safeDay = Math.min(day, lastDayOfTarget);
  return new Date(`${year}-${String(month).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}T12:00:00`);
}
