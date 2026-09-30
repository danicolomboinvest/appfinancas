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
 * A partir de quando um aporte marcado é dinheiro NOVO em cima do "Já guardado" digitado.
 *
 * Até 28/09/2026 o formulário de edição preenchia "Já guardado" com o total calculado (ativos +
 * aportes), então nas metas antigas o digitado JÁ INCLUI os aportes feitos até ali: em 6 de 8
 * metas de produção com os dois, o digitado era o vinculado. A correção do formulário foi ao ar
 * na noite de 28/09 (push às 19h30 de Brasília); o corte fica em 21h de Brasília, depois do
 * deploy, pra nenhuma edição feita no formulário antigo ter engolido um aporte "novo".
 */
export const APORTES_SOMAM_DESDE = new Date("2026-09-29T00:00:00.000Z");

/**
 * Quanto a meta mostra como "já guardado", juntando o "Já guardado" digitado com o que o app
 * enxerga (ativos da meta + aportes).
 *
 * Só o maior dos dois (a regra anterior) travava a meta: com R$ 5.000 digitados e R$ 500 por
 * mês marcados, ela ficava parada em R$ 5.000 até o 10º aporte e virava "atrasada" no 6º mês,
 * mesmo com a pessoa fazendo tudo o que o app pediu. Somar tudo também não serve: nas metas
 * antigas o digitado já contém os aportes de antes (ver `APORTES_SOMAM_DESDE`), e o CDB que ela
 * digitou como "Já guardado" e depois ligou à meta contaria duas vezes.
 *
 * Então: o digitado + os aportes marcados depois do corte são um piso ("o que eu tinha + o que
 * marquei desde então"), e o que o app enxerga (todos os aportes e ativos, pela regra de
 * `goalProgress`) vale quando passa disso. Ligar o CDB que já era o "Já guardado" continua sem
 * dobrar (ele só entra no lado do app), e cada aporte novo move a meta.
 *
 * Sem nada digitado, vale só o que o app enxerga — igual a sempre.
 */
export function goalCurrentAmount(
  goalId: string,
  openingBalance: number,
  assetsValueOfGoal: number,
  contributions: (GoalContribution & { createdAt: Date })[],
): number {
  const enxergado = goalProgress(goalId, assetsValueOfGoal, contributions);
  if (!(openingBalance > 0)) return enxergado;
  const novos = contributions
    .filter((c) => c.createdAt.getTime() >= APORTES_SOMAM_DESDE.getTime())
    .reduce((s, c) => s + c.amount, 0);
  return Math.round(Math.max(openingBalance + novos, enxergado) * 100) / 100;
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
