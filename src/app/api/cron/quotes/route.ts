import { NextResponse } from "next/server";
import { recusarSeNaoForCron } from "@/lib/cron/autorizacao";
import { prisma } from "@/lib/db/prisma";
import { fetchTickerPrice } from "@/lib/analysis/price-scraper";
import { processarComPrazo } from "@/lib/cron/lote";
import { toCurrencyCode, type CurrencyCode } from "@/lib/money";
import { precoNaMoeda, reaisPorUnidadeDa } from "@/lib/portfolio/cotacao-na-moeda";

// Cotações de dezenas de tickers via scraping podem passar dos 10s padrão. A busca para com
// folga antes do teto (PRAZO_MS) pra sobrar tempo de gravar o que já veio.
export const maxDuration = 60;
const PRAZO_MS = 40_000;

/**
 * Cron diário (vercel.json): atualiza a cotação de TODOS os ativos com ticker, de todos os
 * usuários, 1 busca por ticker único. Nunca toca no investedValue (referência do lucro).
 *
 * Segurança: exige o Bearer do CRON_SECRET que o próprio agendador envia; sem o segredo
 * configurado, recusa (ver recusarSeNaoForCron).
 */
export async function GET(request: Request) {
  const inicio = Date.now();
  const recusa = recusarSeNaoForCron(request);
  if (recusa) return recusa;

  const allWithTicker = await prisma.asset.findMany({
    where: { ticker: { not: null } },
    select: { id: true, ticker: true, quantity: true, user: { select: { currency: true } } },
  });
  // Só tickers de bolsa de verdade (PETR4, MXRF11…), fundos/renda fixa usam o campo como
  // nome e não têm cotação pública pra buscar.
  const assets = allWithTicker.filter((a) => /^[A-Z]{4}\d{1,2}$/.test(a.ticker as string));
  if (assets.length === 0) return NextResponse.json({ updated: 0, failed: [] });

  const uniqueTickers = [...new Set(assets.map((a) => a.ticker as string))];
  // Alguns de cada vez e com prazo: o Promise.all com tudo de uma vez não tinha teto, e um
  // único fetch pendurado fazia a função morrer antes de gravar QUALQUER cotação do dia.
  const priceByTicker = new Map<string, number | null>();
  await processarComPrazo(uniqueTickers, { paralelo: 8, prazo: inicio + PRAZO_MS }, async (ticker) => {
    priceByTicker.set(ticker, await fetchTickerPrice(ticker));
  });

  // A cotação vem em reais; quem usa o app em outra moeda digitou a carteira nela. Uma busca
  // de câmbio por moeda, não por ativo.
  const moedas = [...new Set(assets.map((a) => toCurrencyCode(a.user.currency)))];
  const reaisPorMoeda = new Map<CurrencyCode, number | null>(
    await Promise.all(moedas.map(async (m): Promise<[CurrencyCode, number | null]> => [m, await reaisPorUnidadeDa(m)])),
  );

  let updated = 0;
  const failed: string[] = [];
  for (const asset of assets) {
    const precoEmReais = priceByTicker.get(asset.ticker as string) ?? null;
    if (precoEmReais === null) {
      if (!failed.includes(asset.ticker as string)) failed.push(asset.ticker as string);
      continue;
    }
    const moeda = toCurrencyCode(asset.user.currency);
    // Sem câmbio hoje, o valor dela fica como estava: gravar reais com símbolo de euro é pior.
    const price = precoNaMoeda(precoEmReais, moeda, reaisPorMoeda.get(moeda) ?? null);
    if (price === null) continue;
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
