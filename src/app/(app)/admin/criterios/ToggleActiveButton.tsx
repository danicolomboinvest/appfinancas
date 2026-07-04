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
      className={`text-xs underline disabled:opacity-50 ${active ? "text-red-600" : "text-green-700"}`}
    >
      {active ? "Desativar" : "Reativar"}
    </button>
  );
}
