/**
 * O teclado do iPhone (Safari e a WebView do app) não encolhe a página: só a "janela visível"
 * (`visualViewport`) fica menor. Uma folha presa no fundo da tela fica atrás do teclado e o campo
 * some (11/10/2026, cadastro de dívida). A altura do teclado é o que falta entre a tela inteira e a
 * janela visível; ela entra no padding de baixo da folha, e a folha rola até o campo.
 *
 * Puro, para testar: quem chama passa as medidas.
 */
export function alturaDoTeclado(medidas: { alturaDaJanela: number; alturaVisivel: number; topoVisivel: number }): number {
  const falta = medidas.alturaDaJanela - medidas.alturaVisivel - medidas.topoVisivel;
  // Menos de 80 px é a barra do Safari aparecendo ou sumindo, não teclado.
  return falta > 80 ? Math.round(falta) : 0;
}

/** Campo que abre teclado (botão, checkbox e rádio não abrem). */
export function abreTeclado(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  if (tag !== "INPUT") return false;
  const tipo = ((el as HTMLInputElement).type || "text").toLowerCase();
  return !["button", "submit", "reset", "checkbox", "radio", "range", "color", "file", "hidden", "image"].includes(tipo);
}
