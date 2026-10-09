import type { Ritmo } from "@/lib/profiles/voice-base";

/**
 * O cartão do topo da Foco (01/10/2026): "Essa semana você pode gastar". A Dani achou a Foco
 * cheia de texto e sem nada que se destacasse; o topo virou um número grande com a cor do ritmo,
 * os dias da semana e uma previsão de como o mês fecha. Puro: a página só desenha.
 */

/** A mesma régua da Visão mensal (FlowIndicators): até 5 pontos acima do mês é "limite". */
export function ritmoDoMes(usado: number, decorrido: number): Ritmo {
  if (usado > decorrido + 0.05) return "rapido";
  if (usado > decorrido) return "limite";
  return "dentro";
}

/**
 * Como o mês fecha se ela seguir gastando no ritmo de até agora: o orçamento menos o gasto
 * projetado para o mês inteiro. Antes de 15% do mês (3, 4 dias) a média ainda mente: null.
 *
 * `gastoUnico` é a compra avulsa grande (o hotel da viagem, a TV): entra uma vez só. Só o resto
 * corre pelos dias que faltam. Sem isso, o hotel de R$ 1.812 lançado no dia 8 virava R$ 7 mil
 * de "ritmo" no fim do mês (09/10/2026).
 */
export function previsaoDoMes(planejado: number, gastoTotal: number, decorrido: number, gastoUnico = 0): number | null {
  if (!(planejado > 0) || decorrido < 0.15 || decorrido >= 1) return null;
  const unico = Math.min(Math.max(0, gastoUnico), gastoTotal);
  return Math.round(planejado - unico - (gastoTotal - unico) / decorrido);
}

/**
 * A partir de quanto uma compra avulsa é "grande" e não ritmo do dia a dia: R$ 500, ou 10% do
 * que corre no mês, o que for maior. Café, mercado e Uber nunca chegam lá; a viagem chega.
 */
export function limiarCompraGrande(planoVariavel: number): number {
  return Math.max(500, planoVariavel * 0.1);
}

/** Segunda = 0 … domingo = 6, e quantos dias faltam até domingo contando hoje. */
/**
 * O livre da semana, a partir do orçamento (07/10/2026). A Dani: "o Foco precisa ser com base no
 * orçamento". O por dia é o do Orçamento (o que sobra ÷ os dias que faltam no mês) e a semana é esse
 * por dia vezes os dias até domingo, os mesmos tracinhos de S a D do cartão. Antes a semana era 7
 * dias de orçamento e o por dia dividia isso pelos dias até domingo: numa quarta, R$ 181 por dia no
 * Foco contra R$ 130 no Orçamento. No fim do mês (menos dias que até domingo), é o que sobra inteiro.
 */
export function livreAteDomingo(restante: number, diasRestantes: number, diasAteDomingo = 7): number {
  const dias = Math.max(1, diasRestantes);
  return dias <= diasAteDomingo ? restante : (restante / dias) * diasAteDomingo;
}

export function diaDaSemana(data: Date): { indice: number; diasAteDomingo: number } {
  const indice = (data.getDay() + 6) % 7;
  return { indice, diasAteDomingo: 7 - indice };
}
