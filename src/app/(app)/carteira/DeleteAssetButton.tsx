"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { deleteAssetAction } from "./actions";

/**
 * "Remover" pede confirmação antes de apagar. Um toque errado na barra de ações apagava o ativo
 * na hora, pra sempre: quantidade, preço médio, objetivo e as distribuições de aporte dele (que
 * caem em cascata e fazem o aporte do mês voltar a pedir destino — por isso o aviso extra).
 */
export function DeleteAssetButton({ id, name, temAporteRecente = false }: { id: string; name: string; temAporteRecente?: boolean }) {
  const t = useProfileTheme().voz.titulos;
  const [confirmando, setConfirmando] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="inline-flex items-center gap-1 text-xs text-danger transition-opacity hover:underline"
      >
        <Trash2 size={13} strokeWidth={1.75} />
        {t.uiRemover}
      </button>
    );
  }

  return (
    <div role="alertdialog" aria-label={t.cartRemoverPergunta(name)} className="flex w-full flex-col items-end gap-2 text-right">
      <p className="text-caption text-ink-muted">
        {t.cartRemoverPergunta(name)}
        {temAporteRecente && <> {t.cartRemoverAvisoAporte}</>}
      </p>
      <div className="flex items-center gap-4">
        <button
          type="button"
          disabled={isPending}
          onClick={() => setConfirmando(false)}
          className="text-xs text-ink-muted transition-colors hover:text-ink disabled:opacity-40"
        >
          {t.formCancelar}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => deleteAssetAction(id))}
          className="inline-flex items-center gap-1 text-xs font-medium text-danger transition-opacity hover:underline disabled:opacity-40"
        >
          <Trash2 size={13} strokeWidth={1.75} />
          {t.cartRemoverSim}
        </button>
      </div>
    </div>
  );
}
