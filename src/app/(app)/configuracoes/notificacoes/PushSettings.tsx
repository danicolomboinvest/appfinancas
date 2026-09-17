"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/toast-context";
import { removePushSubscriptionAction, savePushSubscriptionAction } from "./push-actions";

type Status = "checking" | "unsupported" | "ios-not-installed" | "blocked" | "off" | "on";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/**
 * "Avisos no celular": liga a notificação do navegador neste aparelho. Sem app na loja, é o
 * site instalado na tela de início que recebe a mensagem — no iPhone, só depois de instalar.
 */
export function PushSettings({ publicKey, devices }: { publicKey: string | null; devices: number }) {
  const { showToast } = useToast();
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
        next = sub ? "on" : "off";
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
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "blocked" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource });
      const json = sub.toJSON();
      const res = await savePushSubscriptionAction({ endpoint: sub.endpoint, keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" } }, navigator.userAgent);
      if (!res.ok) throw new Error("save failed");
      setStatus("on");
      showToast("Avisos ligados neste aparelho.");
    } catch (err) {
      console.error(err);
      showToast("Não consegui ligar os avisos aqui. Tente de novo.");
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
        <p className="text-sm font-semibold text-ink">Avisos no celular</p>
      </div>
      <p className="text-xs leading-relaxed text-ink-muted">
        Uma mensagem no celular, como as de um app: quando uma categoria está perto de estourar e ainda falta metade do mês,
        ou uma meta ficou pra trás. Sem e-mail. {devices > 0 && `Ligado em ${devices} aparelho${devices === 1 ? "" : "s"}.`}
      </p>
      {status === "checking" && <p className="text-xs text-ink-faint">Verificando este aparelho…</p>}
      {status === "ios-not-installed" && (
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink">
          No iPhone, os avisos só funcionam com o app instalado na tela de início. Toque em Compartilhar › Adicionar à Tela de Início, abra por lá e volte aqui.
        </p>
      )}
      {status === "unsupported" && <p className="text-xs text-ink-faint">Este navegador não recebe notificações. No celular, instale o app na tela de início.</p>}
      {status === "blocked" && <p className="text-xs text-danger">Você bloqueou as notificações deste site. Libere nas configurações do navegador pra ligar de novo.</p>}
      {status === "off" && (
        <Button type="button" size="sm" onClick={enable} disabled={busy} className="w-fit">
          {busy ? "Ligando…" : "Ligar avisos neste aparelho"}
        </Button>
      )}
      {status === "on" && (
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success">Ligado aqui</span>
          <button type="button" onClick={disable} disabled={busy} className="text-xs text-ink-muted underline-offset-2 hover:underline">
            Desligar neste aparelho
          </button>
        </div>
      )}
    </Card>
  );
}
