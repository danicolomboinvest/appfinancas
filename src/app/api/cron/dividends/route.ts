import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { looksLikeMarketTicker } from "@/lib/analysis/dividend-scraper";
import { refreshDividendsForTicker } from "@/lib/repositories/dividend.repo";

// Dezenas de tickers via scraping podem passar dos 10s padrão (mesmo teto do cron de cotações).
export const maxDuration = 60;

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
  const secret = process.env.CRON_SECRET;
  const authorized = secret
    ? request.headers.get("authorization") === `Bearer ${secret}`
    : (request.headers.get("user-agent") ?? "").startsWith("vercel-cron");
  if (!authorized) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Mesmo freio anti-abuso do cron de cotações: sem CRON_SECRET configurado, o user-agent é
  // forjável — isso garante que rodar de novo em <10min nunca acontece de verdade.
  const lastRun = await prisma.dividendEvent.findFirst({
    orderBy: { fetchedAt: "desc" },
    select: { fetchedAt: true },
  });
  if (lastRun && Date.now() - lastRun.fetchedAt.getTime() < 10 * 60 * 1000) {
    return NextResponse.json({ ok: true, skipped: "ran recently" });
  }

  const withTicker = await prisma.asset.findMany({
    where: { ticker: { not: null } },
    select: { ticker: true },
  });
  const tickers = [...new Set(withTicker.map((a) => a.ticker as string).filter(looksLikeMarketTicker))];

  for (const ticker of tickers) {
    await refreshDividendsForTicker(ticker);
  }

  return NextResponse.json({ ok: true, tickers: tickers.length });
}
