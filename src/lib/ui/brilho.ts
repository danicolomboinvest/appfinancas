/**
 * O brilho da linha (14/10/2026, "B como regra"): quando a ação muda algo que está na tela, a
 * própria linha acende por 1,2 s em vez de abrir um aviso. A classe `.brilho` está no
 * globals.css (sem movimento para quem pede menos movimento).
 *
 * Dois jeitos de usar:
 * - `brilhar(elemento)`: acende uma linha que já está na tela.
 * - `brilharQuandoAparecer("meta-123")`: acende a linha com `data-brilho="meta-123"` assim que
 *   ela aparecer (a folha fecha, a tela recarrega e o item novo entra na lista).
 */

export const DURACAO_DO_BRILHO = 1200;

export function brilhar(el: Element | null | undefined) {
  if (!el) return;
  el.classList.remove("brilho");
  // Força o navegador a recomeçar a animação quando a mesma linha brilha duas vezes seguidas.
  void (el as HTMLElement).offsetWidth;
  el.classList.add("brilho");
  window.setTimeout(() => el.classList.remove("brilho"), DURACAO_DO_BRILHO + 100);
}

/** Seletor da linha marcada com `data-brilho`. */
export function seletorDoBrilho(chave: string) {
  return `[data-brilho="${typeof CSS !== "undefined" && CSS.escape ? CSS.escape(chave) : chave}"]`;
}

/**
 * Espera a linha com `data-brilho={chave}` aparecer (até `espera` ms) e acende. Se ela já está
 * na tela, acende na hora. Serve para o item novo, que só chega depois do refresh da tela.
 */
export function brilharQuandoAparecer(chave: string, espera = 5000) {
  if (typeof document === "undefined") return;
  const achar = () => document.querySelector(seletorDoBrilho(chave));
  const ja = achar();
  if (ja) {
    brilhar(ja);
    return;
  }
  const observador = new MutationObserver(() => {
    const el = achar();
    if (!el) return;
    observador.disconnect();
    window.clearTimeout(limite);
    // Um quadro depois, para a linha já estar pintada no lugar dela.
    requestAnimationFrame(() => brilhar(el));
  });
  observador.observe(document.body, { childList: true, subtree: true });
  const limite = window.setTimeout(() => observador.disconnect(), espera);
}
