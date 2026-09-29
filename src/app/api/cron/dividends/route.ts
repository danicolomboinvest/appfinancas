import { NextResponse } from "next/server";
import { recusarSeNaoForCron } from "@/lib/cron/autorizacao";
import { prisma } from "@/lib/db/prisma";
import { looksLikeMarketTicker } from "@/lib/analysis/dividend-scraper";
import { refreshDividendsForTicker } from "@/lib/repositories/dividend.repo";
import { girarLista, processarComPrazo } from "@/lib/cron/lote";

// Centenas de tickers via scraping: o mesmo teto do cron do Open Finance, e o loop para sozinho
// com folga antes dele (PRAZO_MS) em vez de ser morto no meio.
export const maxDuration = 300;
const PRAZO_MS = 270_000;

/**
 * Cron diário (vercel.json): mantém o calendário de dividendos em dia pra TODOS os tickers em
 * carteira, de todos os usuários — 1 busca por ticker único, guardado por ticker (não por
 * pessoa), então uma ação com 50 alunas segurando MXRF11 só busca uma vez.
 *
 * Complementa o refresh sob demanda (ao criar/importar ativo, via `after()`): garante que
 * dividendos anunciados DEPOIS que a pessoa já tinha o ativo também apareçam, sem ela precisar
 * mexer na carteira de novo.
 */
export async function GET(request: Request) {
  const inicio = Date.now();
  const recusa = recusarSeNaoForCron(request);
  if (recusa) return recusa;

  const withTicker = await prisma.asset.findMany({
    where: { ticker: { not: null } },
    select: { ticker: true },
  });
  const tickers = [...new Set(withTicker.map((a) => a.ticker as string).filter(looksLikeMarketTicker))];

  // Alguns de cada vez, com prazo e em rodízio: um por vez, a função morria no teto com a
  // lista pela metade, e como a ordem do banco é estável eram sempre os mesmos tickers do fim
  // que nunca ganhavam o provento novo no calendário. O início sorteado a cada dia garante que
  // quem ficar de fora hoje (se um dia ficar) entra nos próximos.
  const fila = girarLista(tickers.sort(), Math.floor(Math.random() * tickers.length));
  const r = await processarComPrazo(fila, { paralelo: 5, prazo: inicio + PRAZO_MS }, (ticker) => refreshDividendsForTicker(ticker));

  return NextResponse.json({ ok: true, tickers: tickers.length, processados: r.processados, pendentes: r.pendentes });
}
