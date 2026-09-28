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

/**
 * Quanto a meta mostra como "já guardado": o MAIOR entre o que a pessoa digitou em "Já
 * guardado" e o que o app enxerga (ativos + aportes).
 *
 * Antes o digitado só valia enquanto não houvesse nada vinculado: bastava tocar em "Marcar
 * aporte" uma vez que os R$ 5.000 que ela já tinha guardado sumiam, a meta caía pro valor do
 * aporte e o "guardar por mês" subia. Somar os dois também não serve: até setembro/2026 o
 * formulário de edição preenchia "Já guardado" com o total calculado, então em 6 de 8 metas
 * de produção com os dois o digitado JÁ É o vinculado, e somar mostraria o dobro. O maior dos
 * dois nunca perde o que ela digitou e nunca conta o mesmo dinheiro duas vezes.
 */
export function goalCurrentAmount(openingBalance: number, progress: number): number {
  return Math.round(Math.max(Math.max(0, openingBalance), progress) * 100) / 100;
}

/**
 * Filtro dos aportes que já podem contar na meta: só os de meses que já começaram (no
 * calendário do Brasil).
 *
 * O "Repetir todo mês" cria as cópias até dezembro de uma vez, e cada cópia leva a meta junto.
 * Sem esse corte, R$ 500 marcado em setembro virava R$ 2.000 guardados na hora — meta pequena
 * aparecia "atingida" com dinheiro que ainda nem saiu da conta.
 */
export function aportesJaOcorridosWhere(today: Date) {
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  return { OR: [{ year: { lt: year } }, { year, month: { lte: month } }] };
}
