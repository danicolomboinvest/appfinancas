"use client";

import { DeleteButton } from "@/components/ui/DeleteButton";
import { deleteMonthlyEntryAction } from "./actions";

export function DeleteEntryButton({ id, year, month }: { id: string; year: number; month: number }) {
  return <DeleteButton onDelete={() => deleteMonthlyEntryAction(id, year, month)} />;
}
