/**
 * "Ritmo do mês" do Fluxo: quanto do orçamento já saiu contra quanto do mês já passou.
 *
 * Antes era `totalExpense / planejado`, e isso acusava "gastando rápido" no dia 3 de quem é
 * organizado: o aluguel e o plano de saúde lançados em janeiro com "Repetir até dezembro", as
 * parcelas que a importação da fatura cria pros meses seguintes e o boleto do dia 25 lançado no
 * dia 10 contavam como dinheiro que já correu. O Foco já descontava isso e, no mesmo dia, dizia
 * o contrário — duas telas brigando.
 *
 * Aqui, igual ao Foco: o que foi criado ANTES do mês começar é conta marcada, sai dos dois lados
 * (do gasto e do plano); e o resto só conta até hoje (lançamento sem data — compra de fatura —
 * já aconteceu, entra).
 */
export type EntradaDoRitmo = {
  category: string;
  amount: number;
  /** Dia do lançamento ("YYYY-MM-DD"), ou null (compra de fatura, sem dia). */
  entryDay: string | null;
  createdAt: Date;
};

export function ritmoDoMes({
  entries,
  planejado,
  year,
  month,
  today,
  monthElapsed,
}: {
  entries: EntradaDoRitmo[];
  planejado: number;
  year: number;
  month: number;
  /** Hoje no Brasil, "YYYY-MM-DD". */
  today: string;
  monthElapsed: number;
}): { budgetUsed: number; monthElapsed: number } | null {
  if (!(planejado > 0)) return null;
  // 03:00 UTC = meia-noite em Brasília (mesma fronteira de somarGastosPreCriados).
  const inicioDoMes = Date.UTC(year, month - 1, 1, 3);
  let fixo = 0;
  let variavel = 0;
  for (const e of entries) {
    if (e.category !== "EXPENSE") continue;
    if (e.createdAt.getTime() < inicioDoMes) fixo += e.amount;
    else if (e.entryDay === null || e.entryDay <= today) variavel += e.amount;
  }
  const planoVariavel = planejado - Math.max(0, fixo);
  // O orçamento inteiro já é conta marcada: não sobra ritmo pra medir (e dividir por zero daria
  // "Infinity%" na barra).
  if (planoVariavel <= 0) return null;
  return { budgetUsed: Math.max(0, variavel) / planoVariavel, monthElapsed };
}
