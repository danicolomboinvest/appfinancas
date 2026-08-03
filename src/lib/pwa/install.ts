"use client";

import { useSyncExternalStore } from "react";

/**
 * "Instalar na tela de início": o app JÁ é um PWA completo (manifest + ícones + standalone), o
 * que faltava era a pessoa DESCOBRIR isso. Aqui mora a parte que depende do aparelho.
 *
 * Android/Chrome: o navegador oferece instalação nativa — ele dispara `beforeinstallprompt`,
 * guardamos o evento e um toque instala de verdade. iPhone: a Apple não expõe API nenhuma pra
 * isso, então o único caminho é ensinar o passo a passo (e ele MUDA entre Safari e Chrome).
 */

export type InstallPlatform = "ios-safari" | "ios-outro" | "android" | "desktop";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<() => void>();

function notifyPromptListeners() {
  for (const listener of promptListeners) listener();
}

/**
 * O `beforeinstallprompt` dispara UMA vez, logo no carregamento — se ninguém estiver ouvindo
 * naquele instante, o evento se perde e o botão "Instalar" nunca aparece. Por isso a captura
 * roda no import do módulo (bem antes de qualquer componente montar), não dentro de um efeito.
 */
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // segura o banner automático do Chrome; quem convida é a nossa tela
    deferredPrompt = event as BeforeInstallPromptEvent;
    notifyPromptListeners();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notifyPromptListeners();
  });
}

function subscribeToPrompt(callback: () => void) {
  promptListeners.add(callback);
  return () => promptListeners.delete(callback);
}

/** true quando o navegador está oferecendo instalação nativa (Android/Chrome, desktop Chrome). */
export function useCanInstallNatively(): boolean {
  return useSyncExternalStore(
    subscribeToPrompt,
    () => deferredPrompt !== null,
    () => false, // no servidor nunca há prompt
  );
}

export type InstallOutcome = "accepted" | "dismissed" | "unavailable";

export async function triggerNativeInstall(): Promise<InstallOutcome> {
  const prompt = deferredPrompt;
  if (!prompt) return "unavailable";
  try {
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    // O evento é de uso único: depois de mostrado, não dá pra reaproveitar.
    deferredPrompt = null;
    notifyPromptListeners();
    return outcome;
  } catch {
    return "unavailable";
  }
}

/** Função pura (testável) que classifica o aparelho a partir do que o navegador se declara. */
export function detectPlatformFromUserAgent(userAgent: string, maxTouchPoints = 0): InstallPlatform {
  // iPad moderno se anuncia como Mac; o que o entrega é ter tela de toque.
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  if (isIOS) {
    // Chrome (CriOS), Firefox (FxiOS), Edge (EdgiOS) e Opera (OPiOS) no iPhone têm outro menu.
    return /CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent) ? "ios-outro" : "ios-safari";
  }
  if (/Android/.test(userAgent)) return "android";
  return "desktop";
}

/** Cache do resultado: o aparelho não muda no meio da sessão, e o useSyncExternalStore exige
 * que o snapshot seja estável (devolver valor novo a cada chamada gera laço de render). */
let cachedPlatform: InstallPlatform | null = null;

function detectPlatform(): InstallPlatform {
  cachedPlatform ??= detectPlatformFromUserAgent(navigator.userAgent, navigator.maxTouchPoints);
  return cachedPlatform;
}

const noopSubscribe = () => () => {};

export function useInstallPlatform(): InstallPlatform {
  return useSyncExternalStore(noopSubscribe, detectPlatform, () => "desktop");
}

/** Já está instalado (aberto pela tela de início / janela do app)? Aí não convidamos ninguém. */
function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari no iOS não implementa display-mode: standalone; usa esta propriedade própria.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function subscribeToDisplayMode(callback: () => void) {
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

export function useIsStandalone(): boolean {
  return useSyncExternalStore(
    subscribeToDisplayMode,
    isStandalone,
    () => true, // no servidor assumimos "instalado" pra NUNCA piscar o convite antes de saber
  );
}
