"use client";

import { useTransition } from "react";
import { deleteGoalAction } from "./actions";

export function DeleteGoalButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => deleteGoalAction(id))}
      className="text-xs text-red-600 underline disabled:opacity-50"
    >
      Remover
    </button>
  );
}
