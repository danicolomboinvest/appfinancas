/** O texto da pergunta "parece já estar no app" (lib/import/ja-no-app), igual em toda a tela.
 * Separado para a tela não carregar o critério inteiro. */
export const TEXTO_JA_NO_APP = "Essa movimentação parece já estar no app. Importar mesmo assim?";

/** "3 parecem já estar no app": o título da pergunta agrupada. */
export function tituloDoGrupo(n: number): string {
  return n === 1 ? "Parece já estar no app" : `${n} parecem já estar no app`;
}
