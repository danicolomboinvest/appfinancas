"use client";

import { useTransition } from "react";
import { toggleCriterionActiveAction } from "./actions";

export function ToggleActiveButton({ id, active }: { id: string; active: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => toggleCriterionActiveAction(id, !active))}
      className={`text-xs transition-opacity hover:underline disabled:opacity-40 ${active ? "text-danger" : "text-success"}`}
    >
      {active ? "Desativar" : "Reativar"}
    </button>
  );
}
