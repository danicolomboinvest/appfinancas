import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { fetchTickerPrice } from "@/lib/analysis/price-scraper";

// Cotações de dezenas de tickers via scraping podem passar dos 10s padrão.
export const maxDuration = 60;

/**
 * Cron diário (vercel.json): atualiza a cotação de TODOS os ativos com ticker, de todos os
 * usuários — 1 busca por ticker único. Nunca toca no investedValue (referência do lucro).
 *
 * Segurança: se CRON_SECRET estiver configurado na Vercel, exige o Bearer que o próprio
 * agendador envia; sem o secret, aceita só chamadas do agendador (user-agent vercel-cron).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorized = secret
    ? request.headers.get("authorization") === `Bearer ${secret}`
    : (request.headers.get("user-agent") ?? "").startsWith("vercel-cron");
  if (!authorized) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const allWithTicker = await prisma.asset.findMany({
    where: { ticker: { not: null } },
    select: { id: true, ticker: true, quantity: true },
  });
  // Só tickers de bolsa de verdade (PETR4, MXRF11…) — fundos/renda fixa usam o campo como
  // nome e não têm cotação pública pra buscar.
  const assets = allWithTicker.filter((a) => /^[A-Z]{4}\d{1,2}$/.test(a.ticker as string));
  if (assets.length === 0) return NextResponse.json({ updated: 0, failed: [] });

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
        // Só recalcula o total quando sabemos a quantidade; sem ela, mantém o valor manual.
        ...(quantity && quantity > 0 ? { currentValue: quantity * price } : {}),
      },
    });
    updated += 1;
  }

  return NextResponse.json({ updated, tickers: uniqueTickers.length, failed });
}
