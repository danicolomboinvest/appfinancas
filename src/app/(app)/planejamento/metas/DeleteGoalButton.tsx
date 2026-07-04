"use client";

import { DeleteButton } from "@/components/ui/DeleteButton";
import { deleteGoalAction } from "./actions";

export function DeleteGoalButton({ id }: { id: string }) {
  return <DeleteButton onDelete={() => deleteGoalAction(id)} />;
}
