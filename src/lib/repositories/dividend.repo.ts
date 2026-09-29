import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { fetchTickerDividends, looksLikeMarketTicker, paysDividendsInReais, type DividendRow } from "@/lib/analysis/dividend-scraper";
import { addUtcDays, brazilTodayUtc } from "@/lib/date/brazil-day";
import { classifyDividendTax, netValuePerShare, type TaxTreatment } from "@/lib/analysis/dividend-tax";

/**
 * Busca e grava os proventos de UM ticker (melhor esforço — nunca lança; scraping falho não
 * pode derrubar quem chamou, seja um `after()` de criação de ativo ou o cron diário).
 * Idempotente: `createMany` + `skipDuplicates` usa a constraint única da tabela, refresh do
 * mesmo ticker no dia seguinte não duplica as linhas que já tinham vindo.
 *
 * Provento A PAGAR que sumiu da página sai do banco na mesma transação (ver
 * staleUpcomingDividendIds). O histórico já pago nunca é mexido.
 */
export async function refreshDividendsForTicker(rawTicker: string): Promise<void> {
  const ticker = rawTicker.trim().toUpperCase();
  if (!looksLikeMarketTicker(ticker)) return;
  try {
    const rows = await fetchTickerDividends(ticker);
    // Busca falha ou página sem linhas: não dá pra concluir nada, nem apagar nada.
    if (!rows || rows.length === 0) return;
    const today = brazilTodayUtc();
    const futuros = await prisma.dividendEvent.findMany({
      where: { ticker, paymentDate: { gte: today } },
      select: { id: true, kind: true, exDate: true, paymentDate: true, valuePerShare: true },
    });
    const stale = staleUpcomingDividendIds(
      futuros.map((e) => ({ ...e, valuePerShare: Number(e.valuePerShare) })),
      rows,
      today,
    );
    await prisma.$transaction([
      ...(stale.length > 0 ? [prisma.dividendEvent.deleteMany({ where: { id: { in: stale } } })] : []),
      prisma.dividendEvent.createMany({
        data: rows.map((r) => ({
          ticker,
          kind: r.kind,
          exDate: r.exDate,
          paymentDate: r.paymentDate,
          valuePerShare: r.valuePerShare,
        })),
        skipDuplicates: true,
      }),
    ]);
  } catch {
    // Scraping é melhor esforço — a pessoa continua com o ativo criado normalmente.
  }
}

/**
 * Quais proventos A PAGAR (pagamento de hoje em diante) não vieram mais na página.
 *
 * A chave única da tabela inclui valor e datas. Quando o investidor10 corrige um anúncio (JSCP
 * de 0,2025 que vira 0,2030, ou data de pagamento remarcada), a linha corrigida entrava como
 * NOVA e a antiga ficava pra sempre: "Próximos proventos", o card do Dashboard e o "Caiu na
 * conta" contavam o mesmo pagamento duas vezes. O que já foi pago fica como está (é histórico,
 * e pode já ter virado lançamento de renda).
 */
export function staleUpcomingDividendIds(
  existing: { id: string; kind: string; exDate: Date; paymentDate: Date; valuePerShare: number }[],
  scraped: DividendRow[],
  today: Date,
): string[] {
  // Datas pelo dia UTC: o banco devolve @db.Date à meia-noite UTC e o scraper monta meio-dia
  // local — os dois caem no mesmo dia. Valor com as 8 casas da coluna.
  const chave = (r: { kind: string; exDate: Date; paymentDate: Date; valuePerShare: number }) =>
    `${r.kind}|${r.exDate.toISOString().slice(0, 10)}|${r.paymentDate.toISOString().slice(0, 10)}|${r.valuePerShare.toFixed(8)}`;
  const vieram = new Set(scraped.map(chave));
  return existing.filter((e) => e.paymentDate >= today && !vieram.has(chave(e))).map((e) => e.id);
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
    // Provento em dólar (AAPL, VOO) sairia como se fosse real — ver paysDividendsInReais.
    if (!paysDividendsInReais(ticker)) continue;
    qtyByTicker.set(ticker, (qtyByTicker.get(ticker) ?? 0) + Number(asset.quantity));
  }
  if (qtyByTicker.size === 0) return [];

  // Hoje pelo calendário de Brasília (ver brazilTodayUtc): depois das 21h o servidor em UTC já
  // está amanhã, e o provento que paga HOJE saía dos "Próximos" (e do card do Dashboard).
  const today = brazilTodayUtc();
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
  // paymentDate é @db.Date (meia-noite UTC): `<=` na data de corte inclui o dia inteiro.
  const cutoff = addUtcDays(brazilTodayUtc(), days);
  return list.filter((event) => event.paymentDate <= cutoff).reduce((sum, event) => sum + event.estimatedTotal, 0);
}

export type PaidDividend = {
  /** DividendEvent.id: identifica o provento (JSCP e Dividendos do mesmo ativo no mesmo dia são dois). */
  id: string;
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
 * O lançamento é reconhecido pela descrição padrão ("Proventos PETR4 (JSCP)") no dia do
 * pagamento — é assim que registerDividendIncomeAction grava, e é o que impede sugerir duas
 * vezes (a conta mora em `registeredDividendIds`).
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
    if (!paysDividendsInReais(t)) continue;
    qtyByTicker.set(t, (qtyByTicker.get(t) ?? 0) + Number(a.quantity));
  }
  if (qtyByTicker.size === 0) return [];
  // Hoje pelo calendário de Brasília, como as datas @db.Date do banco (meia-noite UTC). Com o
  // relógio do servidor (UTC), às 22h30 de Brasília "hoje" já era amanhã, e o provento de
  // amanhã aparecia como "Caiu na conta" — dava pra lançar uma renda que ainda não tinha caído.
  const today = brazilTodayUtc();
  const since = addUtcDays(today, -days);

  const [events, entries] = await Promise.all([
    prisma.dividendEvent.findMany({
      where: { ticker: { in: [...qtyByTicker.keys()] }, paymentDate: { gte: since, lte: today } },
      orderBy: { paymentDate: "desc" },
    }),
    prisma.monthlyEntry.findMany({
      where: { userId: ctx.userId, profileId: ctx.profileId, category: "INCOME", description: { startsWith: "Proventos " }, entryDate: { gte: since, lte: today } },
      select: { description: true, entryDate: true, amount: true },
    }),
  ]);

  const paid = events.map((ev) => {
    const quantity = qtyByTicker.get(ev.ticker) ?? 0;
    const amount = Math.round(quantity * netValuePerShare(ev.kind, Number(ev.valuePerShare)) * 100) / 100;
    return { id: ev.id, ticker: ev.ticker, kind: ev.kind, paymentDate: ev.paymentDate, amount };
  });
  const done = registeredDividendIds(
    paid.map((p) => ({ id: p.id, ticker: p.ticker, kind: p.kind, day: p.paymentDate.toISOString().slice(0, 10), amount: p.amount })),
    entries.map((e) => ({ description: e.description, day: e.entryDate?.toISOString().slice(0, 10) ?? null, amount: Number(e.amount) })),
  );

  return paid.map((p) => ({ ...p, registered: done.has(p.id) })).filter((d) => d.amount > 0);
}

/**
 * Quais proventos já viraram lançamento de renda.
 *
 * A chave é ticker + TIPO + dia. Antes era só ticker + dia, e é comum a empresa pagar JSCP e
 * Dividendos no mesmo dia (a PETR4 faz isso em metade das datas): lançar o JSCP escondia os
 * Dividendos, e ela perdia a maior parte do provento sem aviso.
 *
 * Quando o mesmo tipo sai duas vezes no mesmo dia (BBAS3 já pagou dois JSCP numa data), cada
 * lançamento marca UM provento: primeiro o de valor igual, depois os que sobraram, na ordem —
 * o valor pode não bater se a quantidade mudou depois de lançar.
 *
 * Só conta a descrição no formato que o app grava ("Proventos PETR4 (JSCP)"): um lançamento
 * digitado à mão com "Proventos PETR4" não pode esconder a sugestão.
 */
export function registeredDividendIds(
  events: { id: string; ticker: string; kind: string; day: string; amount: number }[],
  entries: { description: string | null; day: string | null; amount: number }[],
): Set<string> {
  const lancados = new Map<string, number[]>();
  for (const e of entries) {
    const m = (e.description ?? "").match(/^Proventos (\S+) \((.+)\)$/);
    if (!m || !e.day) continue;
    const key = `${m[1].toUpperCase()}|${m[2]}|${e.day}`;
    lancados.set(key, [...(lancados.get(key) ?? []), e.amount]);
  }

  const porChave = new Map<string, typeof events>();
  for (const ev of events) {
    const key = `${ev.ticker}|${ev.kind}|${ev.day}`;
    porChave.set(key, [...(porChave.get(key) ?? []), ev]);
  }

  const done = new Set<string>();
  for (const [key, evs] of porChave) {
    const valores = [...(lancados.get(key) ?? [])];
    if (valores.length === 0) continue;
    const sobraram: typeof evs = [];
    for (const ev of evs) {
      const i = valores.findIndex((v) => Math.abs(v - ev.amount) <= 0.01);
      if (i >= 0) {
        done.add(ev.id);
        valores.splice(i, 1);
      } else sobraram.push(ev);
    }
    for (const ev of sobraram.slice(0, valores.length)) done.add(ev.id);
  }
  return done;
}
