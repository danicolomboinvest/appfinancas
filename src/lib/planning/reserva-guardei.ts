/**
 * O botão "Guardei este mês" da reserva de emergência: as contas, sem banco e sem React.
 *
 * Antes, a reserva só crescia se a pessoa abrisse o formulário e reescrevesse o "Já tenho
 * guardado" na mão, somando de cabeça. Quem guardou os R$ 300 combinados queria só dizer
 * "guardei" — igual ao que as metas já tinham. O botão lança o guardado no mês (como dinheiro
 * guardado, não como gasto) e soma o mesmo valor na reserva.
 */

/** A chave do mês ("2026-09"), a mesma forma que o check-in das metas usa. */
export function chaveDoMesDaReserva(agora: Date): string {
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
}

export type ReservaParaGuardar = {
  targetAmount: number;
  currentAmount: number;
  monthlyContribution: number;
};

/**
 * Quanto o "Guardei" lança. Sem valor digitado, é o combinado por mês da própria reserva —
 * lido do banco na hora, nunca o número que veio da tela. Com "outro valor", é o que ela
 * digitou. Não corta no que falta pra completar: o dinheiro que ela guardou é o que ela
 * guardou, e a reserva pode passar da meta (a tela mostra "Pronta!").
 *
 * Devolve null quando não há o que lançar (combinado zerado, valor inválido ou menor que
 * R$ 1, o mesmo piso das outras ações que lançam guardado sozinhas).
 */
export function valorDoGuardei(reserva: ReservaParaGuardar, informado?: number | null): number | null {
  const bruto = informado ?? reserva.monthlyContribution;
  if (!Number.isFinite(bruto)) return null;
  const valor = Math.round(bruto * 100) / 100;
  return valor >= 1 ? valor : null;
}

/**
 * O botão aparece? Só com a reserva montada, um valor por mês combinado e a reserva ainda
 * sem completar. Reserva completa não pede mais "guardei": a tela comemora.
 */
export function mostraGuardei(reserva: ReservaParaGuardar | null): boolean {
  if (!reserva) return false;
  if (reserva.targetAmount > 0 && reserva.currentAmount >= reserva.targetAmount) return false;
  return valorDoGuardei(reserva) !== null;
}

/**
 * "Tempo até completar" em português de gente: "1 mês", "3 meses". Zero é a reserva pronta
 * (vira a frase do tema), e null é "não fecha" (o valor por mês não alcança a meta).
 * Antes aparecia "1 meses" e "0 meses".
 */
export function mesesAteCompletar(meses: number | null): { tipo: "pronta" } | { tipo: "naoFecha" } | { tipo: "meses"; texto: string } {
  if (meses === null) return { tipo: "naoFecha" };
  if (meses <= 0) return { tipo: "pronta" };
  return { tipo: "meses", texto: `${meses} ${meses === 1 ? "mês" : "meses"}` };
}
