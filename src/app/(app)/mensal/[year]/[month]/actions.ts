"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import {
  createMonthlyEntry,
  createRecurringMonthlyEntries,
  deleteOwnMonthlyEntry,
} from "@/lib/repositories/monthly-entry.repo";
import { monthlyEntrySchema } from "@/lib/validations/monthly-entry.schema";

export type MonthlyEntryState = { error?: string };

export async function createMonthlyEntryAction(
  _prevState: MonthlyEntryState,
  formData: FormData,
): Promise<MonthlyEntryState> {
  const parsed = monthlyEntrySchema.safeParse({
    year: formData.get("year"),
    month: formData.get("month"),
    category: formData.get("category"),
    parentCategory: formData.get("parentCategory") || undefined,
    subcategory: formData.get("subcategory"),
    description: formData.get("description"),
    amount: formData.get("amount"),
    repeatMonthly: formData.get("repeatMonthly") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { repeatMonthly, parentCategory, subcategory, ...rest } = parsed.data;
  const entry = {
    ...rest,
    parentCategory: parentCategory || undefined,
    subcategory: subcategory || undefined,
  };
  const ctx = await getRequiredSession();
  if (repeatMonthly) {
    await createRecurringMonthlyEntries(ctx, entry);
  } else {
    await createMonthlyEntry(ctx, entry);
  }
  revalidatePath(`/mensal/${parsed.data.year}`);
  revalidatePath(`/mensal/${parsed.data.year}/${parsed.data.month}`);
  return {};
}

export async function deleteMonthlyEntryAction(id: string, year: number, month: number) {
  const ctx = await getRequiredSession();
  await deleteOwnMonthlyEntry(ctx, id);
  revalidatePath(`/mensal/${year}`);
  revalidatePath(`/mensal/${year}/${month}`);
}
