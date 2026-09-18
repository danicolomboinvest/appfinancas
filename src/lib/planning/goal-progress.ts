/**
 * Quanto uma meta já tem guardado, a regra que amarra Fluxo, Carteira e Metas.
 *
 * A conta precisa errar em nenhum dos dois sentidos:
 * - Contar o aporte E o ativo em que ele entrou dobra o mesmo dinheiro (aportei R$ 1.000 pra
 *   viagem, disse que foi pro CDB da viagem, e a meta pulava R$ 2.000).
 * - Descontar todo aporte que tenha destino some com dinheiro real (se o aporte da viagem foi
 *   parar no ITUB4, que não é da viagem, ele continua sendo dinheiro guardado pra viagem).
 *
 * Então: vale o valor dos ativos DA meta, mais a parte de cada aporte da meta que não entrou
 * num ativo dessa mesma meta.
 *
 * Fica aqui, puro e sem banco, porque é a regra que precisa ser testada de verdade — o
 * repositório só traz os números e chama esta função.
 */

export type GoalContribution = {
  amount: number;
  /** Pedaços deste aporte que foram pra algum ativo, com a meta do ativo de destino. */
  allocations: { amount: number; assetGoalId: string | null }[];
};

export function goalProgress(goalId: string, assetsValueOfGoal: number, contributions: GoalContribution[]): number {
  const naoContado = contributions.reduce((sum, c) => {
    const jaNoAtivoDaMeta = c.allocations
      .filter((a) => a.assetGoalId === goalId)
      .reduce((s, a) => s + a.amount, 0);
    return sum + Math.max(0, c.amount - jaNoAtivoDaMeta);
  }, 0);
  return Math.round((assetsValueOfGoal + naoContado) * 100) / 100;
}
