/**
 * O número que o histórico de importações mostra ao lado de cada lote.
 *
 * Antes era a soma de tudo que o lote criou: renda, gasto e aporte juntos, e na fatura também as
 * parcelas projetadas pros meses seguintes. O extrato com salário de R$ 5.000 e R$ 3.000 de gastos
 * aparecia como R$ 8.000; a fatura de R$ 1.000 com uma compra em 10x de R$ 100 aparecia como
 * R$ 1.900. Ela via um número maior que o arquivo e achava que a importação tinha duplicado.
 *
 * - Fatura: só os gastos do mês da fatura (o primeiro mês em que o lote gravou algo; as parcelas
 *   projetadas caem nos seguintes). Estorno já está negativo e desconta. É o total da fatura.
 * - Extrato (e Open Finance): o saldo com sinal, como na tela de confirmação. Renda soma; gasto
 *   e aporte subtraem.
 */
export type LancamentoDoLote = { amount: number; category: string; year: number; month: number };

export function totalDoLote(docType: string, lancamentos: LancamentoDoLote[]): number {
  if (docType === "fatura") {
    if (lancamentos.length === 0) return 0;
    const mesDaFatura = Math.min(...lancamentos.map((e) => e.year * 12 + e.month));
    const total = lancamentos
      .filter((e) => e.category === "EXPENSE" && e.year * 12 + e.month === mesDaFatura)
      .reduce((soma, e) => soma + e.amount, 0);
    return Math.round(total * 100) / 100;
  }
  const saldo = lancamentos.reduce((soma, e) => soma + (e.category === "INCOME" ? e.amount : -e.amount), 0);
  return Math.round(saldo * 100) / 100;
}
