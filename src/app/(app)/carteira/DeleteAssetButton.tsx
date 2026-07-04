"use client";

import { DeleteButton } from "@/components/ui/DeleteButton";
import { deleteAssetAction } from "./actions";

export function DeleteAssetButton({ id }: { id: string }) {
  return <DeleteButton onDelete={() => deleteAssetAction(id)} />;
}
