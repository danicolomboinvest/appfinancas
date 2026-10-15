/**
 * Sobrou = entrou − gastou − guardou. Uma conta só em todo o app (versão nova, 11/10/2026,
 * regra 3.7 do documento de implementação): o Resumo, o gráfico do mês, a Visão geral e o
 * e-mail do resumo usam esta função, e nenhum lugar refaz a conta por conta própria.
 *
 * - Guardou = os aportes do mês (lançamentos INVESTMENT_CONTRIBUTION).
 * - Na tela: positivo é "sobrou R$ X", zero é "empatou", negativo é "faltou R$ X". Nunca "−R$".
 * - "Livre" é outra coisa (plano − gastou) e mora no orçamento (month-budget-summary.ts).
 *
 * Ana, outubro até o dia 7: 7.700 − 4.059 − 900 = R$ 2.741. Setembro: 7.700 − 6.600 − 900 = R$ 200.
 */
export type ValoresDoMes = { entrou: number; gastou: number; guardou: number };

/** Arredonda para centavos: soma de Decimal convertida em número não pode virar "0,30000000004". */
function centavos(n: number): number {
  return Math.round(n * 100) / 100;
}

export function sobrouDoMes({ entrou, gastou, guardou }: ValoresDoMes): number {
  return centavos(entrou - gastou - guardou);
}

/**
 * O sobrou em reais inteiros, para quem usa o número fora do formatador (o atalho "O que sobrou"
 * das Dívidas). Math.round, como o Resumo mostra (money com round: true arredonda para o mais
 * perto). Antes as Dívidas cortavam com Math.floor: sobrou R$ 199,60 era R$ 200 no Resumo e
 * R$ 199 nas Dívidas.
 */
export function sobrouEmReais(valor: number): number {
  return Math.round(centavos(valor)) || 0;
}

/** "vazio": o mês não tem lançamento nenhum (não é um empate, é um mês que ainda não começou). */
export type SituacaoDoSobrou = "sobrou" | "empatou" | "faltou" | "vazio";

/**
 * A palavra e o valor sem sinal, prontos para a tela: nunca "−R$". Mês sem nenhum lançamento
 * continua "Sobrou R$ 0" (11/10/2026: "Empatou R$ 0" num mês vazio confundia a dona).
 */
export function lerSobrou(valor: number, semLancamento = false): { situacao: SituacaoDoSobrou; rotulo: "Sobrou" | "Empatou" | "Faltou"; valor: number } {
  const v = centavos(valor);
  if (semLancamento && v === 0) return { situacao: "vazio", rotulo: "Sobrou", valor: 0 };
  if (v > 0) return { situacao: "sobrou", rotulo: "Sobrou", valor: v };
  if (v < 0) return { situacao: "faltou", rotulo: "Faltou", valor: -v };
  return { situacao: "empatou", rotulo: "Empatou", valor: 0 };
}

/** O mês não tem nada: nem entrada, nem gasto, nem aporte. */
export function mesSemLancamento(m: { totalIncome: number; totalExpense: number; totalInvestment: number }): boolean {
  return m.totalIncome === 0 && m.totalExpense === 0 && m.totalInvestment === 0;
}

/** Atalho para quem já tem o resumo do mês (totalIncome/totalExpense/totalInvestment). */
export function sobrouDoResumo(m: { totalIncome: number; totalExpense: number; totalInvestment: number }): number {
  return sobrouDoMes({ entrou: m.totalIncome, gastou: m.totalExpense, guardou: m.totalInvestment });
}
