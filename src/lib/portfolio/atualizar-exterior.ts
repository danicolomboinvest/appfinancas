import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { fetchUsPrice } from "@/lib/analysis/us-price";
import { getExchangeRate } from "@/lib/fx/rates";
import { isCurrencyCode, toCurrencyCode } from "@/lib/money";
import { processarComPrazo } from "@/lib/cron/lote";
import { CONTA_BRASIL, TICKER_EUA, atualizacaoDoExterior } from "./conta-exterior";

/**
 * Atualiza os ativos da conta no exterior: cotação em US$ de quem tem ticker e quantidade, e o
 * dólar do dia em todos (o valor em reais de um ativo de fora muda mesmo sem a bolsa mexer).
 * Usado pelo botão "Atualizar cotações" (um perfil) e pelo cron da noite (todo mundo).
 */
export async function atualizarAtivosDoExterior(
  onde: Prisma.AssetWhereInput,
  opcoes: { prazo?: number } = {},
): Promise<{ updated: number; failed: string[] }> {
  const ativos = await prisma.asset.findMany({
    where: { ...onde, currency: { not: CONTA_BRASIL } },
    select: { id: true, ticker: true, quantity: true, currency: true, nativeCurrentValue: true, user: { select: { currency: true } } },
  });
  if (ativos.length === 0) return { updated: 0, failed: [] };

  const comCotacao = (a: (typeof ativos)[number]) => Boolean(a.ticker && TICKER_EUA.test(a.ticker) && a.quantity && Number(a.quantity) > 0);
  const tickers = [...new Set(ativos.filter(comCotacao).map((a) => a.ticker as string))];
  const precoPorTicker = new Map<string, number | null>();
  await processarComPrazo(tickers, { paralelo: 6, prazo: opcoes.prazo ?? Date.now() + 30_000 }, async (t) => {
    precoPorTicker.set(t, await fetchUsPrice(t));
  });

  // Um câmbio por par (US$ → moeda do app), não por ativo.
  const pares = [...new Set(ativos.filter((a) => isCurrencyCode(a.currency)).map((a) => `${a.currency}>${toCurrencyCode(a.user.currency)}`))];
  const cambioPorPar = new Map<string, number | null>(
    await Promise.all(
      pares.map(async (p): Promise<[string, number | null]> => {
        const [de, para] = p.split(">");
        const r = await getExchangeRate(toCurrencyCode(de), toCurrencyCode(para));
        return [p, r?.rate ?? null];
      }),
    ),
  );

  let updated = 0;
  const failed: string[] = [];
  for (const a of ativos) {
    const precoNativo = comCotacao(a) ? (precoPorTicker.get(a.ticker as string) ?? null) : null;
    if (comCotacao(a) && precoNativo === null && !failed.includes(a.ticker as string)) failed.push(a.ticker as string);
    const dados = atualizacaoDoExterior({
      quantity: a.quantity === null ? null : Number(a.quantity),
      nativeCurrentValue: a.nativeCurrentValue === null ? null : Number(a.nativeCurrentValue),
      precoNativo,
      cambio: cambioPorPar.get(`${a.currency}>${toCurrencyCode(a.user.currency)}`) ?? null,
    });
    if (!dados) continue;
    await prisma.asset.update({ where: { id: a.id }, data: dados });
    updated += 1;
  }
  return { updated, failed };
}
