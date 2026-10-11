"use client";

import { useEffect } from "react";
import { TOUR_DONE_EVENT } from "@/components/shell/InstallAppBanner";

/**
 * Quem entrou pelo começo novo não vê o tour antigo de balões nem o "O app mudou de lugar" (que é
 * para quem já usava). Marca os dois como vistos neste aparelho, e avisa o convite de instalar o
 * app, que espera o tour terminar para aparecer.
 */
export function TourVistoPeloComeco() {
  useEffect(() => {
    try {
      if (window.localStorage.getItem("welcome-tour-seen") === "1") return;
      window.localStorage.setItem("welcome-tour-seen", "1");
      window.localStorage.setItem("menu-novo-visto", "1");
    } catch {
      return;
    }
    window.dispatchEvent(new Event(TOUR_DONE_EVENT));
  }, []);
  return null;
}
