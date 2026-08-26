"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import type { AssetClass } from "@prisma/client";
import { getRequiredSession } from "@/lib/auth/session";
import { createAsset, updateOwnAsset, deleteOwnAsset } from "@/lib/repositories/asset.repo";
import { refreshDividendsForTicker } from "@/lib/repositories/dividend.repo";
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
  // Busca o calendário de dividendos DEPOIS de responder — a pessoa não espera o scraping pra
  // ver o ativo criado; se achar proventos, aparecem na próxima vez que ela abrir a Carteira.
  if (parsed.data.ticker) after(() => refreshDividendsForTicker(parsed.data.ticker!));
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
 * tudo entra como OUTRO). META fica de fora, precisa escolher a meta individualmente. */
export async function bulkSetObjectiveAction(
  assetClass: string,
  objective: "RESERVA_EMERGENCIA" | "LIBERDADE_FINANCEIRA" | "OUTRO" | "META",
  goalId?: string,
): Promise<{ ok: true; updated: number } | { ok: false; error: string }> {
  // Record (não array solto): se um valor novo entrar no enum AssetClass sem passar por aqui,
  // o TypeScript acusa — evita repetir o bug de uma classe nova (ex.: INTERNACIONAL) cair como
  // "Opção inválida" nesse guard sem ninguém perceber.
  const ALLOWED_CLASSES_GUARD: Record<AssetClass, true> = {
    RENDA_FIXA: true,
    ACAO: true,
    FII: true,
    TESOURO_DIRETO: true,
    FUNDO: true,
    CRIPTO: true,
    INTERNACIONAL: true,
    OUTRO: true,
  };
  const ALLOWED_OBJECTIVES = ["RESERVA_EMERGENCIA", "LIBERDADE_FINANCEIRA", "OUTRO", "META"];
  if (!(assetClass in ALLOWED_CLASSES_GUARD) || !ALLOWED_OBJECTIVES.includes(objective)) {
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
