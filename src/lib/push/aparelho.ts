/**
 * Inscrição de avisos (Web Push) deste navegador, do lado do cliente.
 *
 * Tira a inscrição do navegador e devolve o endpoint que ela tinha, pro servidor apagar a
 * linha dele. Usado ao sair da conta. Nunca lança: sair da conta não pode travar porque o
 * navegador não tem service worker ou recusou a operação.
 */
export async function desinscreverAvisosDesteAparelho(): Promise<string | undefined> {
  try {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return undefined;
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return undefined;
    const endpoint = sub.endpoint;
    await sub.unsubscribe().catch(() => undefined);
    return endpoint;
  } catch {
    return undefined;
  }
}
