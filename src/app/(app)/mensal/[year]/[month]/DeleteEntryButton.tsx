"use client";

import { useTransition } from "react";
import { deleteMonthlyEntryAction } from "./actions";

export function DeleteEntryButton({ id, year, month }: { id: string; year: number; month: number }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => deleteMonthlyEntryAction(id, year, month))}
      className="text-xs text-red-600 underline disabled:opacity-50"
    >
      Remover
    </button>
  );
}
