import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { fetchTickerDividends, looksLikeMarketTicker } from "@/lib/analysis/dividend-scraper";
import { classifyDividendTax, netValuePerShare, type TaxTreatment } from "@/lib/analysis/dividend-tax";

/**
 * Busca e grava os proventos de UM ticker (melhor esforço — nunca lança; scraping falho não
 * pode derrubar quem chamou, seja um `after()` de criação de ativo ou o cron diário).
 * Idempotente: `createMany` + `skipDuplicates` usa a constraint única da tabela, refresh do
 * mesmo ticker no dia seguinte não duplica as linhas que já tinham vindo.
 */
export async function refreshDividendsForTicker(rawTicker: string): Promise<void> {
  const ticker = rawTicker.trim().toUpperCase();
  if (!looksLikeMarketTicker(ticker)) return;
  try {
    const rows = await fetchTickerDividends(ticker);
    if (!rows || rows.length === 0) return;
    await prisma.dividendEvent.createMany({
      data: rows.map((r) => ({
        ticker,
        kind: r.kind,
        exDate: r.exDate,
        paymentDate: r.paymentDate,
        valuePerShare: r.valuePerShare,
      })),
      skipDuplicates: true,
    });
  } catch {
    // Scraping é melhor esforço — a pessoa continua com o ativo criado normalmente.
  }
}

/** Vários tickers em sequência (lote de importação, ou o cron). */
export async function refreshDividendsForTickers(rawTickers: string[]): Promise<void> {
  const unique = [...new Set(rawTickers.map((t) => t.trim().toUpperCase()).filter(Boolean))];
  for (const ticker of unique) {
    await refreshDividendsForTicker(ticker);
  }
}

export type UpcomingDividend = {
  ticker: string;
  kind: string;
  exDate: Date;
  paymentDate: Date;
  /** Valor por cota ANUNCIADO (bruto, antes de imposto). */
  valuePerShare: number;
  /** Quantidade somada, se o usuário tiver o mesmo ticker em mais de um lançamento. */
  quantity: number;
  /** Bruto (quantidade × valor anunciado) — o que a empresa/fundo anunciou pagar. */
  estimatedGrossTotal: number;
  /** Estimativa do que CAI NA CONTA: já descontados os 15% de JSCP (regra sem exceção);
   * Dividendos/Rendimentos de FII são isentos, então bruto = líquido. */
  estimatedTotal: number;
  taxTreatment: TaxTreatment;
};

/**
 * Próximos proventos dos ativos do usuário (pagamento a partir de hoje), com valor estimado
 * (quantidade × valor por cota). Ativo sem quantidade cadastrada não entra — mostrar "R$ 0"
 * seria pior que simplesmente não aparecer.
 */
export async function listUpcomingDividendsForUser(ctx: AuthContext, limit = 20): Promise<UpcomingDividend[]> {
  const assets = await prisma.asset.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, ticker: { not: null }, quantity: { not: null } },
    select: { ticker: true, quantity: true },
  });
  if (assets.length === 0) return [];

  // Soma por ticker: a mesma ação pode estar em mais de um lançamento (metas/objetivos
  // diferentes), o provento é por AÇÃO, não por lançamento.
  const qtyByTicker = new Map<string, number>();
  for (const asset of assets) {
    const ticker = asset.ticker!.toUpperCase();
    qtyByTicker.set(ticker, (qtyByTicker.get(ticker) ?? 0) + Number(asset.quantity));
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const events = await prisma.dividendEvent.findMany({
    where: { ticker: { in: [...qtyByTicker.keys()] }, paymentDate: { gte: today } },
    orderBy: { paymentDate: "asc" },
    take: limit * 3, // cada ticker pode ter várias linhas (JSCP + Dividendos no mesmo mês)
  });

  return events
    .map((event) => {
      const quantity = qtyByTicker.get(event.ticker) ?? 0;
      const valuePerShare = Number(event.valuePerShare);
      return {
        ticker: event.ticker,
        kind: event.kind,
        exDate: event.exDate,
        paymentDate: event.paymentDate,
        valuePerShare,
        quantity,
        estimatedGrossTotal: quantity * valuePerShare,
        estimatedTotal: quantity * netValuePerShare(event.kind, valuePerShare),
        taxTreatment: classifyDividendTax(event.kind),
      };
    })
    .filter((event) => event.quantity > 0)
    .slice(0, limit);
}

/** Soma estimada de proventos a pagar nos próximos N dias — para o card do Dashboard. */
export async function sumUpcomingDividends(ctx: AuthContext, days = 30): Promise<number> {
  const list = await listUpcomingDividendsForUser(ctx, 500);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + days);
  cutoff.setHours(23, 59, 59, 999);
  return list.filter((event) => event.paymentDate <= cutoff).reduce((sum, event) => sum + event.estimatedTotal, 0);
}

export type PaidDividend = {
  ticker: string;
  kind: string;
  paymentDate: Date;
  /** O que caiu na conta (JSCP já líquido dos 15%). */
  amount: number;
  /** true se já existe um lançamento de renda desse provento nesse dia. */
  registered: boolean;
};

/**
 * Proventos dos ativos da pessoa pagos nos últimos `days` dias, com a marca de "já lancei".
 * O lançamento é reconhecido pela descrição padrão ("Proventos PETR4") no dia do pagamento —
 * é assim que registerDividendIncomeAction grava, e é o que impede sugerir duas vezes.
 */
export async function listRecentlyPaidDividends(ctx: AuthContext, days = 10): Promise<PaidDividend[]> {
  const assets = await prisma.asset.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, ticker: { not: null }, quantity: { not: null } },
    select: { ticker: true, quantity: true },
  });
  if (assets.length === 0) return [];
  const qtyByTicker = new Map<string, number>();
  for (const a of assets) {
    const t = a.ticker!.toUpperCase();
    qtyByTicker.set(t, (qtyByTicker.get(t) ?? 0) + Number(a.quantity));
  }
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const since = new Date(today);
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const [events, entries] = await Promise.all([
    prisma.dividendEvent.findMany({
      where: { ticker: { in: [...qtyByTicker.keys()] }, paymentDate: { gte: since, lte: today } },
      orderBy: { paymentDate: "desc" },
    }),
    prisma.monthlyEntry.findMany({
      where: { userId: ctx.userId, profileId: ctx.profileId, category: "INCOME", description: { startsWith: "Proventos " }, entryDate: { gte: since, lte: today } },
      select: { description: true, entryDate: true },
    }),
  ]);
  const done = new Set(entries.map((e) => `${(e.description ?? "").split(" ")[1]}|${e.entryDate?.toISOString().slice(0, 10)}`));

  return events
    .map((ev) => {
      const quantity = qtyByTicker.get(ev.ticker) ?? 0;
      const amount = Math.round(quantity * netValuePerShare(ev.kind, Number(ev.valuePerShare)) * 100) / 100;
      return {
        ticker: ev.ticker,
        kind: ev.kind,
        paymentDate: ev.paymentDate,
        amount,
        registered: done.has(`${ev.ticker}|${ev.paymentDate.toISOString().slice(0, 10)}`),
      };
    })
    .filter((d) => d.amount > 0);
}
