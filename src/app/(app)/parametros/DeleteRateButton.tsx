"use client";

import { useTransition } from "react";
import { deleteReferenceRateAction } from "./actions";

export function DeleteRateButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => deleteReferenceRateAction(id))}
      className="text-xs text-red-600 underline disabled:opacity-50"
    >
      Remover
    </button>
  );
}
