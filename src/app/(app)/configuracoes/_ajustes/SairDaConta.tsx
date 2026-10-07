"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/lib/auth/actions";
import { desinscreverAvisosDesteAparelho } from "@/lib/push/aparelho";

/** Sair, no pé das Configurações. Desliga os avisos deste aparelho antes, como o Sair do menu. */
export function SairDaConta() {
  const [pendente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() => iniciar(async () => logoutAction(await desinscreverAvisosDesteAparelho()))}
      className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left text-[15px] font-medium text-danger disabled:opacity-60"
    >
      <span className="flex size-8 items-center justify-center rounded-lg bg-danger-soft" aria-hidden>
        <LogOut size={16} />
      </span>
      {pendente ? "Saindo…" : "Sair da conta"}
    </button>
  );
}
