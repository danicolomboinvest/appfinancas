"use client";

import { useEffect, useState } from "react";
import { ehAppNativo } from "@/lib/apple/app-nativo";

/** Verdadeiro dentro do app da loja (Capacitor). No servidor e no primeiro desenho, falso. */
export function useAppNativo(): boolean {
  const [nativo, setNativo] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- o Capacitor só existe no aparelho
    setNativo(ehAppNativo(window));
  }, []);
  return nativo;
}
