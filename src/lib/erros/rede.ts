/**
 * Foi a internet mesmo? (12/10/2026) Só quando o aparelho diz que está sem rede ou o envio nem
 * saiu ("Failed to fetch", "Load failed", "NetworkError"). Qualquer outra falha é nossa, e dizer
 * "confira a internet" mandava a cliente procurar o problema no lugar errado.
 *
 * Mora num arquivo próprio (13/10/2026) para o detector de versão nova usar sem ciclo de import.
 */
export function ehFalhaDeRede(erro: unknown, online: boolean | undefined = typeof navigator !== "undefined" ? navigator.onLine : undefined): boolean {
  if (online === false) return true;
  const texto = erro instanceof Error ? `${erro.name} ${erro.message}` : String(erro ?? "");
  return /failed to fetch|load failed|networkerror|network request failed|internet connection appears to be offline|err_internet_disconnected/i.test(texto);
}
