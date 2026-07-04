"use client";

import { useTransition } from "react";
import { deleteAssetAction } from "./actions";

export function DeleteAssetButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => deleteAssetAction(id))}
      className="text-xs text-red-600 underline disabled:opacity-50"
    >
      Remover
    </button>
  );
}
