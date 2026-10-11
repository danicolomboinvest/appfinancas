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

export type SituacaoDoSobrou = "sobrou" | "empatou" | "faltou";

/** A palavra e o valor sem sinal, prontos para a tela: nunca "−R$". */
export function lerSobrou(valor: number): { situacao: SituacaoDoSobrou; rotulo: "Sobrou" | "Empatou" | "Faltou"; valor: number } {
  const v = centavos(valor);
  if (v > 0) return { situacao: "sobrou", rotulo: "Sobrou", valor: v };
  if (v < 0) return { situacao: "faltou", rotulo: "Faltou", valor: -v };
  return { situacao: "empatou", rotulo: "Empatou", valor: 0 };
}

/** Atalho para quem já tem o resumo do mês (totalIncome/totalExpense/totalInvestment). */
export function sobrouDoResumo(m: { totalIncome: number; totalExpense: number; totalInvestment: number }): number {
  return sobrouDoMes({ entrou: m.totalIncome, gastou: m.totalExpense, guardou: m.totalInvestment });
}
