"use client";

import { DeleteButton } from "@/components/ui/DeleteButton";
import { deleteSheetAction } from "@/app/(app)/fichas/actions";

export function DeleteSheetButton({ id, basePath }: { id: string; basePath: string }) {
  return <DeleteButton onDelete={() => deleteSheetAction(id, basePath)} label="Remover ficha" />;
}
