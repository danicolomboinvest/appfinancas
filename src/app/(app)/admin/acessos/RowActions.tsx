"use client";

import { useTransition } from "react";
import { removeAccessAction, toggleAccessAction } from "./actions";

export function RowActions({ id, active }: { id: string; active: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(() => toggleAccessAction(id, !active))}
        className={`text-xs transition-opacity hover:underline disabled:opacity-40 ${active ? "text-danger" : "text-success"}`}
      >
        {active ? "Desativar" : "Reativar"}
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (confirm("Remover este e-mail da lista? Ele perde o acesso e some do histórico.")) {
            startTransition(() => removeAccessAction(id));
          }
        }}
        className="text-xs text-ink-faint transition-opacity hover:text-danger hover:underline disabled:opacity-40"
      >
        Remover
      </button>
    </div>
  );
}
