"use client";

import { useTransition } from "react";
import { deleteSheetAction } from "@/app/(app)/fichas/actions";

export function DeleteSheetButton({ id, basePath }: { id: string; basePath: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => deleteSheetAction(id, basePath))}
      className="text-xs text-red-600 underline disabled:opacity-50"
    >
      Remover ficha
    </button>
  );
}
