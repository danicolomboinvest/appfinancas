/**
 * Dentro do app da loja (Capacitor, iPhone e Android) ou no navegador?
 *
 * Por que importa (11/10/2026): o app do iPhone que está na loja não declara as permissões de
 * câmera e de fotos (NSCameraUsageDescription e NSPhotoLibraryUsageDescription). Lá, um campo de
 * arquivo de imagem oferece "Tirar foto", e o iOS fecha o app no toque. Até a versão nova do app
 * chegar à loja, o envio de imagem fica só no navegador.
 */
type JanelaComCapacitor = { Capacitor?: { isNativePlatform?: () => boolean } };

export function ehAppNativo(janela: unknown): boolean {
  try {
    return Boolean((janela as JanelaComCapacitor | null)?.Capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
}

/** O texto no lugar do envio de imagem, dentro do app. */
export const FOTO_SO_NO_NAVEGADOR = "Para trocar a foto, abra o SPI pelo navegador";
