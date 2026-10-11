"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { SheetType } from "@prisma/client";
import { lerAtivoAction } from "../analises-actions";

/**
 * Lê, um por vez, os ativos da carteira que ainda não têm leitura (ou cuja leitura passou de 7 dias),
 * e atualiza a tela a cada um que chega. Cada código é tentado uma vez por visita: se a fonte
 * falhar, o anel fica cinza ("sem leitura") e nada é inventado no lugar.
 */
export function LeitorDaCarteira({ pendentes, onFalhou }: { pendentes: { ticker: string; tipo: SheetType }[]; onFalhou?: (ticker: string) => void }) {
  const router = useRouter();
  const tentados = useRef(new Set<string>());
  const rodando = useRef(false);
  const chave = pendentes.map((p) => p.ticker).join(",");

  useEffect(() => {
    if (rodando.current) return;
    const fila = pendentes.filter((p) => !tentados.current.has(p.ticker));
    if (fila.length === 0) return;
    rodando.current = true;
    (async () => {
      for (const p of fila) {
        tentados.current.add(p.ticker);
        const r = await lerAtivoAction(p.ticker, p.tipo).catch(() => null);
        if (r?.ok) router.refresh();
        else onFalhou?.(p.ticker);
      }
      rodando.current = false;
    })();
    // A fila muda a cada refresh; a chave evita reler o que já foi tentado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  return null;
}
