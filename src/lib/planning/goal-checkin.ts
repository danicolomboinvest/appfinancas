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
