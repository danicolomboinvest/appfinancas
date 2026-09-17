"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import {
  createMonthlyEntry,
  createRecurringMonthlyEntries,
  updateOwnMonthlyEntry,
  deleteOwnMonthlyEntry,
  deleteOwnMonthlyEntries,
  type MonthlyEntryInput,
} from "@/lib/repositories/monthly-entry.repo";
import { monthlyEntrySchema } from "@/lib/validations/monthly-entry.schema";
import { getUserCurrency } from "@/lib/money-server";
import { convertAmount, getExchangeRate } from "@/lib/fx/rates";
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
    currency: formData.get("currency") || undefined,
    exchangeRate: formData.get("exchangeRate") || undefined,
  });
}

type ConversionError = { error: string };

/**
 * Lançamento em outra moeda: o valor digitado vira `amount` na moeda do usuário pela cotação
 * que veio do formulário (a pessoa pôde ajustar) ou, se ela apagou, pela cotação do dia.
 * Na moeda do próprio usuário não há nada a converter e os três campos ficam vazios.
 */
async function toEntryInput(data: z.output<typeof monthlyEntrySchema>): Promise<MonthlyEntryInput | ConversionError> {
  const userCurrency = await getUserCurrency();
  const currency = data.currency || userCurrency;
  let amount = data.amount;
  let conversion: Pick<MonthlyEntryInput, "originalAmount" | "originalCurrency" | "exchangeRate"> = {};
  if (currency !== userCurrency) {
    const rate = data.exchangeRate ?? (await getExchangeRate(currency, userCurrency))?.rate;
    if (!rate) return { error: "Não consegui a cotação de hoje. Informe a cotação pra continuar." };
    amount = convertAmount(data.amount, rate);
    conversion = { originalAmount: data.amount, originalCurrency: currency, exchangeRate: rate };
  }
  return {
    year: data.year,
    month: data.month,
    category: data.category,
    amount,
    ...conversion,
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

  const ctx = await getRequiredSession();
  const entry = await toEntryInput(parsed.data);
  if ("error" in entry) return entry;
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
  const entry = await toEntryInput(parsed.data);
  if ("error" in entry) return entry;
  try {
    await updateOwnMonthlyEntry(ctx, entryId, entry);
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

/** Exclusão em lote (modo "Selecionar"): uma ida ao banco, uma revalidação. */
export async function deleteMonthlyEntriesAction(ids: string[], year: number, month: number) {
  const ctx = await getRequiredSession();
  await deleteOwnMonthlyEntries(ctx, ids);
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
  originalAmount?: number | null;
  originalCurrency?: string | null;
  exchangeRate?: number | null;
};

/** Desfazer exclusão: recria o lançamento a partir do snapshot guardado no cliente. */
export async function undoDeleteEntryAction(snapshot: DeletedEntrySnapshot): Promise<{ ok: boolean }> {
  const ctx = await getRequiredSession();
  try {
    // Data do snapshot vem do cliente: fora do formato, vira Invalid Date e estouraria no
    // Prisma — melhor restaurar sem a data do que falhar o "Desfazer" inteiro.
    const entryDate = snapshot.entryDate ? new Date(snapshot.entryDate) : undefined;
    await createMonthlyEntry(ctx, {
      year: snapshot.year,
      month: snapshot.month,
      category: snapshot.category,
      parentCategory: (snapshot.parentCategory as MonthlyEntryInput["parentCategory"]) ?? undefined,
      customCategoryId: snapshot.customCategoryId ?? undefined,
      subcategory: snapshot.subcategory ?? undefined,
      description: snapshot.description ?? undefined,
      amount: snapshot.amount,
      entryDate: entryDate && !Number.isNaN(entryDate.getTime()) ? entryDate : undefined,
      goalId: snapshot.goalId ?? undefined,
      originalAmount: snapshot.originalAmount ?? undefined,
      originalCurrency: snapshot.originalCurrency ?? undefined,
      exchangeRate: snapshot.exchangeRate ?? undefined,
    });
  } catch {
    return { ok: false };
  }
  revalidatePath(`/mensal/${snapshot.year}`);
  revalidatePath(`/mensal/${snapshot.year}/${snapshot.month}`);
  return { ok: true };
}

/**
 * "Desfazer" de uma exclusão em lote. Restaura um a um pelo mesmo caminho do desfazer
 * individual, então qualquer proteção que exista lá vale aqui. `ok` só se TODOS voltaram.
 */
export async function undoDeleteEntriesAction(snapshots: DeletedEntrySnapshot[]): Promise<{ ok: boolean }> {
  const results = await Promise.all(snapshots.map((s) => undoDeleteEntryAction(s)));
  return { ok: results.every((r) => r.ok) };
}
