import { computeGoalPlan, type GoalCalcInput } from "./goal";

/**
 * Check-in mensal de meta: "você guardou o aporte sugerido?" — sem isso, o status (no ritmo /
 * atrasada) é só matemática projetada a partir do valor guardado, e ninguém nunca CONFIRMA que
 * o aporte do mês realmente aconteceu. Uma meta pode aparecer "no ritmo" por meses seguidos só
 * porque a defasagem de um aporte perdido ainda não foi grande o suficiente pra virar
 * "atrasada" na projeção — sem o check-in, isso fica sem checar.
 *
 * Mesma janela do Resumo Mensal (getRecapEligibility): pergunta sobre o mês CORRENTE só perto
 * do fim (dia >= 25, quase fechado) ou sobre o mês ANTERIOR no começo do novo mês (dia <= 7,
 * já fechado de verdade). No meio do mês não faz sentido perguntar "fez o aporte?" de um mês
 * que ainda nem acabou.
 */
export function getGoalCheckinEligibility(
  now: Date,
  checkinDismissedMonth: string | null,
): { eligible: boolean; year: number; month: number; monthKey: string } {
  const day = now.getDate();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  if (day <= 7) {
    const prev = new Date(year, month - 2, 1);
    year = prev.getFullYear();
    month = prev.getMonth() + 1;
  } else if (day < 25) {
    return { eligible: false, year, month, monthKey: `${year}-${String(month).padStart(2, "0")}` };
  }
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  return { eligible: checkinDismissedMonth !== monthKey, year, month, monthKey };
}

/** "2026-08" → "agosto", pro texto do prompt ("fez o aporte de agosto?"). */
export function monthKeyLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "long" });
}

/**
 * O aporte do mês já está feito? Vale o "Marcar aporte" (checkinDismissedMonth) OU qualquer
 * aporte vinculado à meta naquele mês — lançado no Fluxo, importado do extrato ou vindo do
 * "Repetir todo mês". Olhar só o botão deixava "Marcar aporte de setembro" aceso depois de ela
 * lançar o aporte no Fluxo, e o toque de "confirmar" criava um segundo aporte igual.
 */
export function aporteDoMesFeito(input: {
  checkinDismissedMonth: string | null;
  monthKey: string;
  temAporteNoMes: boolean;
}): boolean {
  return input.checkinDismissedMonth === input.monthKey || input.temAporteNoMes;
}

/**
 * Depois do aporte do mês marcado, o card não pode continuar pedindo "guardar R$ X este mês":
 * a conta refeita com o saldo novo e os MESMOS meses (o mês atual ainda conta) dava um valor
 * menor que ela lia como dívida de setembro. O que interessa agora é o mês que vem: a mesma
 * conta, feita como se já fosse dia 1º do mês seguinte.
 *
 * null quando não há próximo aporte a pedir: o prazo acaba antes do mês que vem, ou o que já
 * está guardado basta.
 */
export function proximoAporte(input: GoalCalcInput & { now: Date }): { monthKey: string; amount: number } | null {
  const inicio = new Date(input.now.getFullYear(), input.now.getMonth() + 1, 1);
  if (input.targetDate.getTime() < inicio.getTime()) return null;
  const plan = computeGoalPlan({ ...input, now: inicio });
  if (plan.status === "ACHIEVED" || plan.requiredMonthlyContribution <= 0) return null;
  const monthKey = `${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, "0")}`;
  return { monthKey, amount: plan.requiredMonthlyContribution };
}
