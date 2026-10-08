"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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
  const { showToast, showError } = useToast();
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
      setStatus(r);
      if (r === "on") showToast(t.cfgPushLigadoToast);
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

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center gap-2">
        <BellRing size={18} className="text-accent-strong" />
        <p className="text-sm font-semibold text-ink">{t.cfgPushTitulo}</p>
      </div>
      <p className="text-xs leading-relaxed text-ink-muted">
        {t.cfgPushDica} {devices > 0 && t.cfgPushLigadoEm(devices)}
      </p>
      {status === "checking" && <p className="text-xs text-ink-faint">{t.cfgPushVerificando}</p>}
      {status === "ios-not-installed" && <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink">{t.cfgPushIos}</p>}
      {status === "unsupported" && <p className="text-xs text-ink-faint">{t.cfgPushNaoSuportado}</p>}
      {status === "blocked" && <p className="text-xs text-danger">{t.cfgPushBloqueado}</p>}
      {status === "off" && (
        <Button type="button" size="sm" onClick={enable} disabled={busy} className="w-fit">
          {busy ? t.cfgPushLigando : t.cfgPushLigar}
        </Button>
      )}
      {status === "on" && (
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success">{t.cfgPushLigadoAqui}</span>
          <button type="button" onClick={disable} disabled={busy} className="text-xs text-ink-muted underline-offset-2 hover:underline">
            {t.cfgPushDesligar}
          </button>
        </div>
      )}
    </Card>
  );
}
