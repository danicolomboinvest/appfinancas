/** Quantos dias faltam no mês corrente, contando hoje como um deles (ex.: dia 10 de um mês
 * de 31 dias → 22 dias restantes, incluindo hoje). */
export function computeDaysRemainingInMonth(today: Date): number {
  const year = today.getFullYear();
  const month = today.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  return lastDay - today.getDate() + 1;
}

/**
 * Limite diário = (planejado do mês - já gasto) / dias restantes. Pode dar negativo quando o
 * orçamento já estourou, quem exibe decide como tratar (ex.: mostrar "estourou em R$X").
 * Retorna null quando não há orçamento definido (nada pra dividir) ou não sobram dias.
 */
export function computeDailySpendingLimit(totalPlanned: number, totalSpent: number, daysRemaining: number): number | null {
  if (totalPlanned <= 0 || daysRemaining <= 0) return null;
  return (totalPlanned - totalSpent) / daysRemaining;
}
