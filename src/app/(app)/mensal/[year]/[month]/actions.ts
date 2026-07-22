"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import {
  createMonthlyEntry,
  createRecurringMonthlyEntries,
  updateOwnMonthlyEntry,
  deleteOwnMonthlyEntry,
  type MonthlyEntryInput,
} from "@/lib/repositories/monthly-entry.repo";
import { monthlyEntrySchema } from "@/lib/validations/monthly-entry.schema";
import type { z } from "zod";

export type MonthlyEntryState = { error?: string };

function parseEntryForm(formData: FormData) {
  return monthlyEntrySchema.safeParse({
    year: formData.get("year"),
    month: formData.get("month"),
    category: formData.get("category"),
    parentCategory: formData.get("parentCategory") || undefined,
    customCategoryId: formData.get("customCategoryId") || undefined,
    subcategory: formData.get("subcategory"),
    description: formData.get("description"),
    amount: formData.get("amount"),
    entryDate: formData.get("entryDate") ?? undefined,
    goalId: formData.get("goalId") || undefined,
    repeatMonthly: formData.get("repeatMonthly") ?? undefined,
  });
}

function toEntryInput(data: z.output<typeof monthlyEntrySchema>): MonthlyEntryInput {
  return {
    year: data.year,
    month: data.month,
    category: data.category,
    amount: data.amount,
    entryDate: data.entryDate,
    parentCategory: data.parentCategory || undefined,
    customCategoryId: data.customCategoryId || undefined,
    subcategory: data.subcategory || undefined,
    description: data.description || undefined,
    goalId: data.goalId || undefined,
  };
}

export async function createMonthlyEntryAction(
  _prevState: MonthlyEntryState,
  formData: FormData,
): Promise<MonthlyEntryState> {
  const parsed = parseEntryForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const entry = toEntryInput(parsed.data);
  const ctx = await getRequiredSession();
  try {
    if (parsed.data.repeatMonthly) {
      await createRecurringMonthlyEntries(ctx, entry);
    } else {
      await createMonthlyEntry(ctx, entry);
    }
  } catch (err) {
    console.error("createMonthlyEntryAction falhou:", err);
    return { error: "Não consegui salvar o lançamento. Tente novamente." };
  }
  revalidatePath(`/mensal/${parsed.data.year}`);
  revalidatePath(`/mensal/${parsed.data.year}/${parsed.data.month}`);
  return {};
}

/** Edição de um lançamento existente, mesmo formulário do create, com `entryId` extra. */
export async function updateMonthlyEntryAction(
  _prevState: MonthlyEntryState,
  formData: FormData,
): Promise<MonthlyEntryState> {
  const entryId = String(formData.get("entryId") ?? "");
  if (!entryId) return { error: "Lançamento não encontrado." };

  const parsed = parseEntryForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const ctx = await getRequiredSession();
  try {
    await updateOwnMonthlyEntry(ctx, entryId, toEntryInput(parsed.data));
  } catch (err) {
    console.error("updateMonthlyEntryAction falhou:", err);
    return { error: "Não consegui salvar as alterações. Tente novamente." };
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

export type DeletedEntrySnapshot = {
  year: number;
  month: number;
  category: "INCOME" | "EXPENSE" | "INVESTMENT_CONTRIBUTION";
  parentCategory: string | null;
  customCategoryId: string | null;
  subcategory: string | null;
  description: string | null;
  amount: number;
  entryDate: string | null;
  goalId: string | null;
};

/** Desfazer exclusão: recria o lançamento a partir do snapshot guardado no cliente. */
export async function undoDeleteEntryAction(snapshot: DeletedEntrySnapshot) {
  const ctx = await getRequiredSession();
  await createMonthlyEntry(ctx, {
    year: snapshot.year,
    month: snapshot.month,
    category: snapshot.category,
    parentCategory: (snapshot.parentCategory as MonthlyEntryInput["parentCategory"]) ?? undefined,
    customCategoryId: snapshot.customCategoryId ?? undefined,
    subcategory: snapshot.subcategory ?? undefined,
    description: snapshot.description ?? undefined,
    amount: snapshot.amount,
    entryDate: snapshot.entryDate ? new Date(snapshot.entryDate) : undefined,
    goalId: snapshot.goalId ?? undefined,
  });
  revalidatePath(`/mensal/${snapshot.year}`);
  revalidatePath(`/mensal/${snapshot.year}/${snapshot.month}`);
}
