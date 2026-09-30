/**
 * A regra do botão de apagar em dois toques (DeleteButton), separada do componente pra ser
 * testável sem navegador.
 *
 * Por que dois toques: apagar uma meta ou uma ficha não tem volta, e o público do app tem
 * muita gente que toca sem querer ao rolar a tela. Um "tem certeza?" do navegador (confirm)
 * assusta, tem cara de erro e no app instalado aparece com o endereço do site em cima; aqui o
 * próprio botão vira "Sim, remover" e aparece um "Cancelar" do lado.
 */

export type EstadoConfirmacao =
  | { fase: "parado" }
  /** `armadoEm`: quando o 1º toque aconteceu (ms), pra ignorar o 2º toque de um duplo toque acidental. */
  | { fase: "confirmando"; armadoEm: number };

export type EventoConfirmacao =
  | { tipo: "toque"; agora: number }
  | { tipo: "cancelar" }
  /** O tempo pra confirmar acabou: volta ao normal sozinho, sem apagar. */
  | { tipo: "expirou" };

/**
 * Um duplo toque rápido (dedo que "quica" na tela) não pode valer como confirmação. Abaixo
 * deste intervalo o 2º toque é ignorado; a pessoa que leu "Sim, remover" leva bem mais que isso.
 */
export const INTERVALO_MINIMO_MS = 400;

/** Quanto tempo o botão fica esperando a confirmação antes de desarmar sozinho. */
export const TEMPO_PRA_CONFIRMAR_MS = 8000;

export const PARADO: EstadoConfirmacao = { fase: "parado" };

/**
 * Próximo estado e se é pra apagar agora. Só apaga no 2º toque, com o botão armado há pelo
 * menos INTERVALO_MINIMO_MS; qualquer outra coisa (cancelar, expirar) volta ao normal sem apagar.
 */
export function proximoEstado(
  estado: EstadoConfirmacao,
  evento: EventoConfirmacao,
): { estado: EstadoConfirmacao; apagar: boolean } {
  if (evento.tipo === "cancelar" || evento.tipo === "expirou") return { estado: PARADO, apagar: false };
  if (estado.fase === "parado") return { estado: { fase: "confirmando", armadoEm: evento.agora }, apagar: false };
  if (evento.agora - estado.armadoEm < INTERVALO_MINIMO_MS) return { estado, apagar: false };
  return { estado: PARADO, apagar: true };
}
