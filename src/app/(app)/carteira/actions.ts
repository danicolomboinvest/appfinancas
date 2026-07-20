"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { createAsset, updateOwnAsset, deleteOwnAsset } from "@/lib/repositories/asset.repo";
import { assetSchema } from "@/lib/validations/asset.schema";

export type AssetFormState = { error?: string };

function parseAssetForm(formData: FormData) {
  return assetSchema.safeParse({
    name: formData.get("name"),
    ticker: formData.get("ticker") || undefined,
    assetClass: formData.get("assetClass"),
    objective: formData.get("objective"),
    goalId: formData.get("goalId") || undefined,
    investedValue: formData.get("investedValue") || undefined,
    fixedIncomeIndex: formData.get("fixedIncomeIndex") || undefined,
    currentValue: formData.get("currentValue"),
    idealAllocationPercent: formData.get("idealAllocationPercent") || undefined,
  });
}

export async function createAssetAction(_prevState: AssetFormState, formData: FormData): Promise<AssetFormState> {
  const parsed = parseAssetForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const ctx = await getRequiredSession();
  await createAsset(ctx, parsed.data);
  revalidatePath("/carteira");
  revalidatePath("/carteira/por-objetivo");
  return {};
}

export async function updateAssetAction(
  id: string,
  _prevState: AssetFormState,
  formData: FormData,
): Promise<AssetFormState> {
  const parsed = parseAssetForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const ctx = await getRequiredSession();
  await updateOwnAsset(ctx, id, parsed.data);
  revalidatePath("/carteira");
  revalidatePath("/carteira/por-objetivo");
  return {};
}

export async function deleteAssetAction(id: string) {
  const ctx = await getRequiredSession();
  await deleteOwnAsset(ctx, id);
  revalidatePath("/carteira");
  revalidatePath("/carteira/por-objetivo");
}

/** Define o objetivo de TODOS os ativos de uma classe de uma vez (pós-importação, em que
 * tudo entra como OUTRO). META fica de fora — precisa escolher a meta individualmente. */
export async function bulkSetObjectiveAction(
  assetClass: string,
  objective: "RESERVA_EMERGENCIA" | "LIBERDADE_FINANCEIRA" | "OUTRO" | "META",
  goalId?: string,
): Promise<{ ok: true; updated: number } | { ok: false; error: string }> {
  const ALLOWED_CLASSES = ["RENDA_FIXA", "ACAO", "FII", "TESOURO_DIRETO", "FUNDO", "CRIPTO", "OUTRO"];
  const ALLOWED_OBJECTIVES = ["RESERVA_EMERGENCIA", "LIBERDADE_FINANCEIRA", "OUTRO", "META"];
  if (!ALLOWED_CLASSES.includes(assetClass) || !ALLOWED_OBJECTIVES.includes(objective)) {
    return { ok: false, error: "Opção inválida." };
  }
  const ctx = await getRequiredSession();
  const { prisma } = await import("@/lib/db/prisma");

  // META vincula os ativos a uma meta REAL (só se for do próprio usuário); os demais zeram o goalId.
  let resolvedGoalId: string | null = null;
  if (objective === "META") {
    if (!goalId) return { ok: false, error: "Selecione a meta." };
    const goal = await prisma.goal.findFirst({ where: { id: goalId, userId: ctx.userId }, select: { id: true } });
    if (!goal) return { ok: false, error: "Meta não encontrada." };
    resolvedGoalId = goal.id;
  }

  const result = await prisma.asset.updateMany({
    where: { userId: ctx.userId, assetClass: assetClass as never },
    data: { objective: objective as never, goalId: resolvedGoalId },
  });
  revalidatePath("/carteira");
  revalidatePath("/carteira/por-objetivo");
  return { ok: true, updated: result.count };
}
