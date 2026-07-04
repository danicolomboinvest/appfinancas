"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";

export function DeleteButton({ onDelete, label = "Remover" }: { onDelete: () => void | Promise<void>; label?: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => onDelete())}
      className="inline-flex items-center gap-1 text-xs text-danger transition-opacity hover:underline disabled:opacity-40"
    >
      <Trash2 size={13} strokeWidth={1.75} />
      {label}
    </button>
  );
}
