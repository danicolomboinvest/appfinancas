"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import type { AssetClass } from "@prisma/client";
import { getRequiredSession } from "@/lib/auth/session";
import { createAsset, updateOwnAsset, deleteOwnAsset } from "@/lib/repositories/asset.repo";
import { refreshDividendsForTicker } from "@/lib/repositories/dividend.repo";
import { assetSchema } from "@/lib/validations/asset.schema";
import { fetchTickerPrice } from "@/lib/analysis/price-scraper";

export type AssetFormState = { error?: string };

/**
 * Ação, FII e ETF podem vir só com quantidade e preço médio. Aí o valor atual é a cotação de
 * hoje × quantidade (mesma fonte do botão "Atualizar cotações"); se a fonte falhar, vale o que
 * a pessoa digitou em "valor atual" ou, no último caso, o próprio investido.
 */
async function parseAssetForm(formData: FormData) {
  const ticker = String(formData.get("ticker") ?? "").trim().toUpperCase() || undefined;
  const quantityRaw = String(formData.get("quantity") ?? "").trim().replace(",", ".");
  const quantity = quantityRaw ? Number(quantityRaw) : undefined;
  const typedCurrent = String(formData.get("currentValue") ?? "").trim();
  const investedRaw = String(formData.get("investedValue") ?? "").trim();
  let currentValue: string | number = typedCurrent;
  let currentUnitPrice: number | undefined;

  if (quantity && quantity > 0 && ticker && /^[A-Z]{4}\d{1,2}$/.test(ticker)) {
    const price = await fetchTickerPrice(ticker);
    if (price) {
      currentUnitPrice = price;
      if (!typedCurrent) currentValue = Math.round(quantity * price * 100) / 100;
    }
  }
  if (currentValue === "" && investedRaw) currentValue = Number(investedRaw);

  return assetSchema.safeParse({
    name: formData.get("name"),
    ticker,
    assetClass: formData.get("assetClass"),
    objective: formData.get("objective"),
    goalId: formData.get("goalId") || undefined,
    quantity: quantity && quantity > 0 ? quantity : undefined,
    currentUnitPrice,
    investedValue: investedRaw || undefined,
    fixedIncomeIndex: formData.get("fixedIncomeIndex") || undefined,
    currentValue,
    idealAllocationPercent: formData.get("idealAllocationPercent") || undefined,
  });
}

export async function createAssetAction(_prevState: AssetFormState, formData: FormData): Promise<AssetFormState> {
  const parsed = await parseAssetForm(formData);
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
  const parsed = await parseAssetForm(formData);
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
    const goal = await prisma.goal.findFirst({ where: { id: goalId, userId: ctx.userId, profileId: ctx.profileId }, select: { id: true } });
    if (!goal) return { ok: false, error: "Meta não encontrada." };
    resolvedGoalId = goal.id;
  }

  const result = await prisma.asset.updateMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, assetClass: assetClass as never },
    data: { objective: objective as never, goalId: resolvedGoalId },
  });
  revalidatePath("/carteira");
  revalidatePath("/carteira/por-objetivo");
  return { ok: true, updated: result.count };
}

