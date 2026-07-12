"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { fetchTickerPrice } from "@/lib/analysis/price-scraper";

export type UpdateQuotesResult =
  | { ok: true; updated: number; failed: string[] }
  | { ok: false; error: string };

/**
 * Atualiza a cotação de todos os ativos com ticker: busca o preço atual (mesma fonte das
 * fichas) e recalcula o valor da posição (quantidade × preço) quando há quantidade cadastrada.
 * Ativos sem ticker (ex.: renda fixa) não são tocados.
 */
export async function updatePortfolioQuotesAction(): Promise<UpdateQuotesResult> {
  const ctx = await getRequiredSession();
  const assets = await prisma.asset.findMany({
    where: { userId: ctx.userId, ticker: { not: null } },
    select: { id: true, ticker: true, quantity: true },
  });

  if (assets.length === 0) {
    return { ok: false, error: "Nenhum ativo com ticker cadastrado — adicione o ticker para atualizar cotações." };
  }

  // Busca os preços em paralelo, mas 1 requisição por ticker único (PETR4 em 2 posições = 1 fetch).
  const uniqueTickers = [...new Set(assets.map((a) => a.ticker as string))];
  const priceByTicker = new Map<string, number | null>(
    await Promise.all(
      uniqueTickers.map(async (ticker): Promise<[string, number | null]> => [ticker, await fetchTickerPrice(ticker)]),
    ),
  );

  let updated = 0;
  const failed: string[] = [];
  for (const asset of assets) {
    const price = priceByTicker.get(asset.ticker as string) ?? null;
    if (price === null) {
      if (!failed.includes(asset.ticker as string)) failed.push(asset.ticker as string);
      continue;
    }
    const quantity = asset.quantity ? Number(asset.quantity) : null;
    await prisma.asset.update({
      where: { id: asset.id },
      data: {
        currentUnitPrice: price,
        // Só recalcula o total quando sabemos a quantidade; sem ela, manter o valor manual.
        ...(quantity && quantity > 0 ? { currentValue: quantity * price } : {}),
      },
    });
    updated += 1;
  }

  revalidatePath("/carteira");
  revalidatePath("/carteira/por-objetivo");
  return { ok: true, updated, failed };
}
