"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import type { AssetClass } from "@prisma/client";
import { getRequiredSession } from "@/lib/auth/session";
import { createAsset, updateOwnAsset, deleteOwnAsset } from "@/lib/repositories/asset.repo";
import { refreshDividendsForTicker } from "@/lib/repositories/dividend.repo";
import { assetSchema } from "@/lib/validations/asset.schema";
import { fetchTickerPrice } from "@/lib/analysis/price-scraper";
import { resolveQuotedCurrentValue } from "@/lib/portfolio/asset-current-value";
import { parseQuantityInput } from "@/lib/portfolio/asset-form-values";
import { precoNaMoeda, reaisPorUnidadeDa } from "@/lib/portfolio/cotacao-na-moeda";
import { getOwnUser } from "@/lib/repositories/user.repo";
import { isCurrencyCode, toCurrencyCode } from "@/lib/money";
import { getExchangeRate } from "@/lib/fx/rates";
import { fetchUsPrice } from "@/lib/analysis/us-price";
import { CONTA_BRASIL, TICKER_EUA, ehDoExterior, naMoedaDoApp } from "@/lib/portfolio/conta-exterior";

export type AssetFormState = { error?: string };

/**
 * Ação, FII e ETF podem vir só com quantidade e preço médio. Aí o valor atual é a cotação de
 * hoje × quantidade (mesma fonte do botão "Atualizar cotações"); se a fonte falhar, vale o que
 * a pessoa digitou em "valor atual" ou, no último caso, o próprio investido.
 *
 * Conta no exterior (07/10/2026): o que ela digita está em US$. O servidor busca a cotação em
 * dólar (ticker americano) e o dólar do dia, grava os valores em US$ e, nos campos de sempre, o
 * mesmo valor em reais (ver lib/portfolio/conta-exterior.ts).
 */
async function parseAssetForm(formData: FormData) {
  const ticker = String(formData.get("ticker") ?? "").trim().toUpperCase() || undefined;
  // Mesmo leitor do formulário: "1.000" são mil cotas, não uma (ver parseQuantityInput).
  const quantityRaw = String(formData.get("quantity") ?? "").trim();
  const quantity = quantityRaw ? parseQuantityInput(quantityRaw) : undefined;
  const typedCurrent = String(formData.get("currentValue") ?? "").trim();
  const investedRaw = String(formData.get("investedValue") ?? "").trim();
  const moedaDoApp = toCurrencyCode((await getOwnUser(await getRequiredSession())).currency);
  const moedaPedida = String(formData.get("assetCurrency") ?? CONTA_BRASIL);
  const moedaDoAtivo = isCurrencyCode(moedaPedida) ? moedaPedida : CONTA_BRASIL;
  const noExterior = ehDoExterior(moedaDoAtivo);
  let currentUnitPrice: number | undefined;
  let precoNoExterior: number | null = null;
  let cambio = 1;

  if (noExterior) {
    if (moedaDoAtivo !== moedaDoApp) {
      const r = await getExchangeRate(moedaDoAtivo, moedaDoApp);
      if (!r) return { success: false as const, error: { issues: [{ message: "Não consegui a cotação do dólar agora. Tente de novo em instantes." }] } };
      cambio = r.rate;
    }
    if (quantity && quantity > 0 && ticker && TICKER_EUA.test(ticker)) {
      precoNoExterior = await fetchUsPrice(ticker);
      if (precoNoExterior) currentUnitPrice = Math.round(precoNoExterior * cambio * 1e6) / 1e6;
    }
  } else if (quantity && quantity > 0 && ticker && /^[A-Z]{4}\d{1,2}$/.test(ticker)) {
    const precoEmReais = await fetchTickerPrice(ticker);
    if (precoEmReais) {
      // A cotação vem em reais; quem usa o app em outra moeda digita a carteira nela. Sem o
      // câmbio, fica sem cotação e vale o que ela digitou (nunca reais com o símbolo dela).
      currentUnitPrice = precoNaMoeda(precoEmReais, moedaDoApp, await reaisPorUnidadeDa(moedaDoApp)) ?? undefined;
    }
  }
  // Na edição o campo vem pré-preenchido: sem os valores de antes, o servidor não distingue
  // "ela digitou 300" de "o 300 já estava ali" (ver resolveQuotedCurrentValue). No exterior,
  // tudo isso acontece em US$.
  let currentValue = resolveQuotedCurrentValue({
    typedCurrent,
    originalCurrent: String(formData.get("originalCurrentValue") ?? "").trim(),
    originalQuantity: String(formData.get("originalQuantity") ?? "").trim(),
    quantity,
    price: noExterior ? precoNoExterior : currentUnitPrice,
  });
  if (currentValue === "" && investedRaw) currentValue = Number(investedRaw);

  let valores: Record<string, unknown> = {
    currency: CONTA_BRASIL,
    investedValue: investedRaw || undefined,
    currentValue,
    nativeCurrentValue: null,
    nativeInvestedValue: null,
    exchangeRate: null,
  };
  if (noExterior && currentValue !== "" && Number.isFinite(Number(currentValue))) {
    const nativoAtual = Number(currentValue);
    const nativoInvestido = investedRaw ? Number(investedRaw) : null;
    // Investido igual ao de antes (só mudou o valor de hoje): o investido em reais fica como
    // estava, ele pode ter vindo do IR com o câmbio de cada compra.
    const investidoAntes = String(formData.get("originalInvestedValue") ?? "").trim();
    const investidoIgual = nativoInvestido !== null && investidoAntes !== "" && Math.abs(nativoInvestido - Number(investidoAntes)) < 0.005;
    valores = {
      currency: moedaDoAtivo,
      nativeCurrentValue: nativoAtual,
      nativeInvestedValue: nativoInvestido,
      exchangeRate: cambio,
      currentValue: naMoedaDoApp(nativoAtual, cambio),
      investedValue: nativoInvestido === null || investidoIgual ? undefined : naMoedaDoApp(nativoInvestido, cambio),
    };
  }

  return assetSchema.safeParse({
    name: formData.get("name"),
    ticker,
    assetClass: formData.get("assetClass"),
    objective: formData.get("objective"),
    goalId: formData.get("goalId") || undefined,
    quantity: quantity && quantity > 0 ? quantity : undefined,
    currentUnitPrice,
    fixedIncomeIndex: formData.get("fixedIncomeIndex") || undefined,
    idealAllocationPercent: formData.get("idealAllocationPercent") || undefined,
    ...valores,
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

