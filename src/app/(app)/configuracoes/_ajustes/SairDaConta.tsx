"use client";

import { useState, useTransition } from "react";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/lib/auth/actions";
import { desinscreverAvisosDesteAparelho } from "@/lib/push/aparelho";

/**
 * Sair, no pé das Configurações, com a confirmação na própria tela (rodada 25). Desliga os avisos
 * deste aparelho antes, como o Sair do menu.
 */
export function SairDaConta() {
  const [confirmando, setConfirmando] = useState(false);
  const [pendente, iniciar] = useTransition();
  if (confirmando) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <b className="text-[15px] font-medium text-ink">Sair da conta?</b>
        <p className="text-sm text-ink-muted">Os avisos deste aparelho são desligados antes de sair.</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={pendente}
            onClick={() => iniciar(async () => logoutAction(await desinscreverAvisosDesteAparelho()))}
            className="min-h-11 rounded-full bg-danger-soft text-sm font-medium text-danger disabled:opacity-60"
          >
            {pendente ? "Saindo…" : "Sair"}
          </button>
          <button type="button" onClick={() => setConfirmando(false)} className="min-h-11 rounded-full bg-surface-2 text-sm text-ink">
            Cancelar
          </button>
        </div>
      </div>
    );
  }
  return (
    <button type="button" onClick={() => setConfirmando(true)} className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left text-[16px] text-danger">
      <span className="flex size-9 items-center justify-center rounded-xl bg-danger-soft" aria-hidden>
        <LogOut size={17} />
      </span>
      Sair da conta
    </button>
  );
}
