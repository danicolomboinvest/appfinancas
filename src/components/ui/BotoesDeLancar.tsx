"use client";

import { FileUp, Plus } from "lucide-react";
import { EVENTO_IMPORTAR, EVENTO_REGISTRAR } from "@/components/shell/registrar-eventos";

/**
 * O próximo passo de uma tela vazia (01/10/2026): "Ainda não tem nenhum gasto" sozinho só informa,
 * e cliente ficou sem saber o que fazer. Os dois botões abrem a gaveta do Registrar já no modo
 * certo (ver registrar-eventos.ts): digitar o primeiro gasto, ou subir o extrato de uma vez.
 */
export function BotoesDeLancar({ rotulo = "Adicionar gasto", importar = true }: { rotulo?: string; importar?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent(EVENTO_REGISTRAR, { detail: { modo: "digitar" } }))}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-accent-gradient px-5 text-sm font-semibold text-on-accent shadow-premium-sm"
      >
        <Plus size={16} aria-hidden /> {rotulo}
      </button>
      {importar && (
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(EVENTO_IMPORTAR))}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border-strong px-4 text-sm font-semibold text-ink hover:bg-surface-2"
        >
          <FileUp size={16} aria-hidden /> Importar extrato
        </button>
      )}
    </div>
  );
}
