"use client";

import { useState, useTransition } from "react";
import { removeAccessAction, toggleAccessAction, setAccessExpiryAction } from "./actions";
import { toDateInputValue } from "./date-utils";

export function RowActions({ id, active, expiresAt }: { id: string; active: boolean; expiresAt: Date | null }) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(expiresAt ? toDateInputValue(expiresAt) : "");
  const [error, setError] = useState<string | undefined>();

  function save() {
    startTransition(async () => {
      const result = await setAccessExpiryAction(id, draft);
      if (result.error) setError(result.error);
      else setEditing(false);
    });
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="rounded-lg border border-border-strong bg-surface px-2 py-1 text-xs text-ink"
        />
        <button
          type="button"
          disabled={isPending}
          onClick={save}
          className="text-xs text-accent-strong hover:underline disabled:opacity-40"
        >
          Salvar
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setEditing(false);
            setError(undefined);
          }}
          className="text-xs text-ink-faint hover:underline disabled:opacity-40"
        >
          Cancelar
        </button>
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={isPending}
        onClick={() => setEditing(true)}
        className="text-xs text-ink-faint transition-opacity hover:text-ink hover:underline disabled:opacity-40"
      >
        {expiresAt ? "Renovar" : "Definir prazo"}
      </button>
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
