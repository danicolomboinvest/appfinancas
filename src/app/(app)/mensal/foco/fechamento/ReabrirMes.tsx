"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reabrirMesAction } from "../actions";
import { useToast } from "@/components/ui/toast-context";

/** "Reabrir setembro", discreto, com a confirmação na própria tela (rodada 42). */
export function ReabrirMes({ chave, rotulo, mes }: { chave: string; rotulo: string; mes: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  const { showError } = useToast();
  if (!confirmando) {
    return (
      <button type="button" onClick={() => setConfirmando(true)} className="min-h-11 self-start text-sm font-medium text-ink-muted underline-offset-2 hover:text-ink hover:underline">
        {rotulo}
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-4">
      <p className="text-sm text-ink">Reabrir {mes}? Os números não mudam. O mês volta a aparecer no Resumo para você fechar de novo.</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pendente}
          onClick={() =>
            iniciar(async () => {
              const r = await reabrirMesAction(chave);
              if (!r.ok) return showError("Não consegui reabrir agora. Tente de novo.");
              router.refresh();
            })
          }
          className="min-h-11 rounded-full bg-ink px-5 text-sm font-medium text-canvas disabled:opacity-60"
        >
          Reabrir
        </button>
        <button type="button" onClick={() => setConfirmando(false)} className="min-h-11 px-3 text-sm text-ink-muted hover:text-ink">
          Cancelar
        </button>
      </div>
    </div>
  );
}
