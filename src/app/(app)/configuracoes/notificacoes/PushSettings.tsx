"use client";

import { useEffect, useState } from "react";
import { Interruptor } from "@/components/ui/Interruptor";
import { useToast } from "@/components/ui/toast-context";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { isMyPushSubscriptionAction, removePushSubscriptionAction } from "./push-actions";
import { ligarAvisos } from "@/components/push/ligar-avisos";

type Status = "checking" | "unsupported" | "ios-not-installed" | "blocked" | "off" | "on";

/**
 * "Avisos no celular": liga a notificação do navegador neste aparelho. Sem app na loja, é o
 * site instalado na tela de início que recebe a mensagem — no iPhone, só depois de instalar.
 */
export function PushSettings({ publicKey, devices }: { publicKey: string | null; devices: number }) {
  const { showError } = useToast();
  const { titulos: t } = useProfileTheme().voz;
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
      let next: Status = "off";
      if (!publicKey || !supported) next = isIOS && !standalone ? "ios-not-installed" : "unsupported";
      else if (Notification.permission === "denied") next = "blocked";
      else {
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        const sub = await reg?.pushManager.getSubscription();
        // O navegador ter inscrição não basta: ela pode ser de outra conta que usou este
        // aparelho. "Ligado" só quando é desta; senão ela vê "Ligar", e ligar passa pra ela.
        next = sub && (await isMyPushSubscriptionAction(sub.endpoint).catch(() => false)) ? "on" : "off";
      }
      if (alive) setStatus(next);
    })();
    return () => {
      alive = false;
    };
  }, [publicKey]);

  async function enable() {
    if (!publicKey) return;
    setBusy(true);
    try {
      const r = await ligarAvisos(publicKey);
      // Sem aviso (14/10/2026): o próprio controle mostra que ligou.
      setStatus(r);
    } catch (err) {
      console.error(err);
      showError(t.cfgPushFalhouToast);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscriptionAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("off");
    } finally {
      setBusy(false);
    }
  }

  // Versão nova (protótipo, #configuracoes-notificacoes): uma linha com a chave "Avisos neste
  // aparelho"; o motivo de não dar (iPhone sem instalar, bloqueado) aparece embaixo, pequeno.
  const ligado = status === "on";
  const pode = status === "on" || status === "off";
  const motivo =
    status === "checking"
      ? t.cfgPushVerificando
      : status === "ios-not-installed"
        ? t.cfgPushIos
        : status === "unsupported"
          ? t.cfgPushNaoSuportado
          : status === "blocked"
            ? t.cfgPushBloqueado
            : null;
  return (
    <div>
      <Interruptor
        ligado={ligado}
        desabilitado={!pode || busy}
        aoMudar={(v) => (v ? enable() : disable())}
        titulo="Avisos neste aparelho"
        sub={`Quando uma categoria está perto de estourar ou uma meta atrasa.${devices > 0 ? ` ${t.cfgPushLigadoEm(devices)}` : ""}`}
      />
      {motivo && <p className={`px-4 pb-3 text-xs ${status === "blocked" ? "text-danger" : "text-ink-muted"}`}>{motivo}</p>}
    </div>
  );
}
