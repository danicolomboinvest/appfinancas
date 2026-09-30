/**
 * Decide se um toque num link merece a barrinha de "carregando" do topo (ver nav-progress).
 *
 * Função pura, separada do componente, pra poder ser testada sem navegador: a regra tem muitos
 * casos de borda (abrir em outra aba, link externo, âncora na mesma página) e errar qualquer um
 * deixa a barra parada em 90% pra sempre — pior do que não ter barra nenhuma.
 */
export type ToqueNoLink = {
  /** O atributo `href` cru do <a> (pode ser relativo, "#ancora", "mailto:"...). */
  href: string | null;
  /** O atributo `target` do <a>. "_blank" abre outra aba: esta tela não sai do lugar. */
  target: string | null;
  /** O <a> tem `download`: baixa um arquivo, não troca de tela. */
  download: boolean;
  /** Botão do mouse (0 = principal). No toque do celular é sempre 0. */
  button: number;
  /** Ctrl, Cmd, Shift ou Alt apertado: o navegador abre em outra aba/janela. */
  comModificador: boolean;
};

/**
 * Devolve o caminho de destino quando o toque vai trocar de TELA dentro do app, ou `null`
 * quando não vai (e aí a barra não pode acender, porque nada vai apagá-la depois).
 *
 * Só conta troca de caminho (`pathname`). Um link que muda só o `?view=anual` continua na
 * mesma tela, e o fim da navegação não teria como ser percebido por aqui.
 */
export function destinoDaNavegacao(toque: ToqueNoLink, local: { origin: string; pathname: string }): string | null {
  if (toque.button !== 0 || toque.comModificador || toque.download) return null;
  if (toque.target && toque.target !== "_self") return null;
  const href = toque.href?.trim();
  if (!href || href.startsWith("#")) return null;

  let url: URL;
  try {
    url = new URL(href, `${local.origin}${local.pathname}`);
  } catch {
    return null;
  }
  // mailto:, tel:, WhatsApp e qualquer outro site saem do app: a tela atual não espera nada.
  if (url.origin !== local.origin) return null;
  if (url.pathname === local.pathname) return null;
  return url.pathname;
}
