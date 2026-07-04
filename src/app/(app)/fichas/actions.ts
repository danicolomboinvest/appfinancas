"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { createSheet, deleteOwnSheet, saveResponses } from "@/lib/repositories/analysis.repo";
import { createAnalysisSheetSchema, saveAnalysisResponsesSchema } from "@/lib/validations/analysis-sheet.schema";

export type SheetFormState = { error?: string };

export async function createSheetAction(_prevState: SheetFormState, formData: FormData): Promise<SheetFormState> {
  const sheetType = formData.get("sheetType");
  const parsed = createAnalysisSheetSchema.safeParse({
    sheetType,
    ticker: formData.get("ticker"),
    companyName: formData.get("companyName") || undefined,
    fiiType: formData.get("fiiType") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const ctx = await getRequiredSession();
  const sheet = await createSheet(ctx, parsed.data);
  const basePath = parsed.data.sheetType === "STOCK" ? "/fichas/acoes" : "/fichas/fiis";
  revalidatePath(basePath);
  redirect(`${basePath}/${sheet.id}`);
}

export async function deleteSheetAction(id: string, basePath: string) {
  const ctx = await getRequiredSession();
  await deleteOwnSheet(ctx, id);
  revalidatePath(basePath);
  redirect(basePath);
}

export async function saveResponsesAction(input: unknown, basePath: string) {
  const parsed = saveAnalysisResponsesSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }

  const ctx = await getRequiredSession();
  await saveResponses(ctx, parsed.data);
  revalidatePath(`${basePath}/${parsed.data.sheetId}`);
}
