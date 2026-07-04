"use client";

import { DeleteButton } from "@/components/ui/DeleteButton";
import { deleteReferenceRateAction } from "./actions";

export function DeleteRateButton({ id }: { id: string }) {
  return <DeleteButton onDelete={() => deleteReferenceRateAction(id)} />;
}
