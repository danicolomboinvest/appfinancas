"use client";

import { savePushSubscriptionAction } from "@/app/(app)/configuracoes/notificacoes/push-actions";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/**
 * Este aparelho pode receber aviso e ainda ninguém perguntou? (navegador com push, permissão
 * ainda não respondida). Fora do app da loja: lá dentro o aviso do navegador não chega.
 */
export function podeOferecerAvisos(): boolean {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return false;
  if (/SPIFinanceApp-iOS/.test(navigator.userAgent)) return false;
  return Notification.permission === "default";
}

/** Pede a permissão, inscreve este aparelho e guarda no servidor. Usado em Configurações e na oferta pós-importação. */
export async function ligarAvisos(publicKey: string): Promise<"on" | "blocked" | "off"> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "blocked" : "off";
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource });
  const json = sub.toJSON();
  const res = await savePushSubscriptionAction({ endpoint: sub.endpoint, keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" } }, navigator.userAgent);
  if (!res.ok) throw new Error("save failed");
  return "on";
}
