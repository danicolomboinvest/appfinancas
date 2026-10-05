/**
 * O estado do guia do Money Reset fica na sessionStorage: ele atravessa telas (o + abre a
 * gaveta, o Raio-X é outra página) e some quando a aba fecha. O evento acorda o componente.
 */

export const CHAVE_DO_GUIA = "mr-guia";
export const EVENTO_DO_GUIA = "mr:guia";

export type EstadoDoGuia = { dia: number; passo: number };

export function lerGuia(): EstadoDoGuia | null {
  try {
    const raw = window.sessionStorage.getItem(CHAVE_DO_GUIA);
    if (!raw) return null;
    const g = JSON.parse(raw) as EstadoDoGuia;
    return typeof g.dia === "number" && typeof g.passo === "number" ? g : null;
  } catch {
    return null;
  }
}

export function gravarGuia(g: EstadoDoGuia | null) {
  try {
    if (g) window.sessionStorage.setItem(CHAVE_DO_GUIA, JSON.stringify(g));
    else window.sessionStorage.removeItem(CHAVE_DO_GUIA);
  } catch {
    // Sem storage (aba privada): o guia vive só nesta tela.
  }
  window.dispatchEvent(new Event(EVENTO_DO_GUIA));
}

export function iniciarGuia(dia: number) {
  gravarGuia({ dia, passo: 0 });
}
