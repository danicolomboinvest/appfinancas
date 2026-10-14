/**
 * O menu do "…" fecha quando a página rola (14/10/2026). Mas o fim do embalo do dedo, ou a página
 * que se ajusta logo depois do toque, também solta um "rolou" de poucos pixels, e o menu fechava
 * no mesmo instante em que abria: o "…" parecia não responder. Só fecha rolagem de verdade.
 */
export const ROLAGEM_QUE_FECHA = 32;

export function rolouDeVerdade(antes: number, agora: number): boolean {
  return Math.abs(agora - antes) > ROLAGEM_QUE_FECHA;
}
