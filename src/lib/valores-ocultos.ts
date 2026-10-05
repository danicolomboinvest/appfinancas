/**
 * "Ocultar valores" (05/10/2026): um toque no olho do topo esconde todo valor em dinheiro do app,
 * para abrir o app no ônibus ou na frente de alguém. Fica num cookie para o servidor também
 * escrever "R$ ••••" (a maior parte dos números sai pronta do servidor), e vale só neste aparelho.
 */
export const COOKIE_VALORES_OCULTOS = "spi-ocultar";

export function gravarValoresOcultos(ocultos: boolean) {
  document.cookie = `${COOKIE_VALORES_OCULTOS}=${ocultos ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
}
