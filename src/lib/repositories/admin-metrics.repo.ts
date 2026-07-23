import { prisma } from "@/lib/db/prisma";

/**
 * Métricas agregadas de TODOS os usuários, para o painel de admin (mapa de leads). Diferente
 * dos outros repositories, NÃO é escopado por usuário — é uma visão global e só deve ser
 * chamado de páginas protegidas por requireAdmin(). Usa aggregation no banco (groupBy) em vez
 * de N+1: 4 queries no total, independente da quantidade de usuários.
 *
 * As métricas espelham as contas que o próprio usuário vê no app:
 *  - Patrimônio investido = soma do valor ATUAL da carteira (Asset.currentValue).
 *  - Poupança do mês = renda − despesa (mesma base da "taxa de poupança" em health-score).
 *  - Aporte = lançamentos INVESTMENT_CONTRIBUTION (dinheiro que de fato foi pra investir).
 * As médias mensais dividem pelo nº de meses COM movimentação (não pelo calendário), pra não
 * punir quem começou a usar há pouco tempo.
 */

export type AdminUserSort = "patrimonio" | "poupanca" | "aporte" | "recente";

export type AdminUserMetric = {
  id: string;
  name: string | null;
  email: string;
  createdAt: Date;
  /** Valor atual somado da carteira (o "quanto tem investido"). */
  patrimonioInvestido: number;
  /** Custo de aquisição somado (quanto colocou), referência de lucro/prejuízo. */
  custoCarteira: number;
  /** (renda − despesa) média por mês com movimentação. */
  poupancaMediaMensal: number;
  /** (renda − despesa) / renda no total do histórico. null se nunca lançou renda. */
  taxaPoupanca: number | null;
  /** Aportes (INVESTMENT_CONTRIBUTION) médios por mês com movimentação. */
  aporteMedioMensal: number;
  /** Quantos meses distintos a pessoa registrou algo. */
  mesesAtivos: number;
  /** Data do lançamento mais recente (proxy de "está usando"). */
  ultimoLancamento: Date | null;
};

export type AdminOverview = {
  users: AdminUserMetric[];
  totals: {
    totalUsuarios: number;
    comCarteira: number;
    patrimonioTotal: number;
    poupancaMediaMensalSomada: number;
  };
};

const SORTERS: Record<AdminUserSort, (a: AdminUserMetric, b: AdminUserMetric) => number> = {
  patrimonio: (a, b) => b.patrimonioInvestido - a.patrimonioInvestido,
  poupanca: (a, b) => b.poupancaMediaMensal - a.poupancaMediaMensal,
  aporte: (a, b) => b.aporteMedioMensal - a.aporteMedioMensal,
  recente: (a, b) => (b.ultimoLancamento?.getTime() ?? 0) - (a.ultimoLancamento?.getTime() ?? 0),
};

const num = (v: unknown): number => (v == null ? 0 : Number(v));

export async function getAdminOverview(sort: AdminUserSort = "patrimonio"): Promise<AdminOverview> {
  const [users, assetsByUser, entriesByCat, monthsRows] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true, email: true, createdAt: true } }),
    prisma.asset.groupBy({ by: ["userId"], _sum: { currentValue: true, investedValue: true } }),
    prisma.monthlyEntry.groupBy({
      by: ["userId", "category"],
      _sum: { amount: true },
      _max: { createdAt: true },
    }),
    // Uma linha por (usuário, ano, mês) com movimentação → contamos meses distintos em JS.
    prisma.monthlyEntry.groupBy({ by: ["userId", "year", "month"], _count: { _all: true } }),
  ]);

  const assetMap = new Map(assetsByUser.map((a) => [a.userId, a._sum]));

  const fin = new Map<string, { income: number; expense: number; invested: number; last: Date | null }>();
  for (const row of entriesByCat) {
    const cur = fin.get(row.userId) ?? { income: 0, expense: 0, invested: 0, last: null };
    const amount = num(row._sum.amount);
    if (row.category === "INCOME") cur.income += amount;
    else if (row.category === "EXPENSE") cur.expense += amount;
    else cur.invested += amount;
    const last = row._max.createdAt;
    if (last && (!cur.last || last > cur.last)) cur.last = last;
    fin.set(row.userId, cur);
  }

  const monthsCount = new Map<string, number>();
  for (const r of monthsRows) monthsCount.set(r.userId, (monthsCount.get(r.userId) ?? 0) + 1);

  const metrics: AdminUserMetric[] = users.map((u) => {
    const assets = assetMap.get(u.id);
    const f = fin.get(u.id);
    const months = monthsCount.get(u.id) ?? 0;
    const income = f?.income ?? 0;
    const expense = f?.expense ?? 0;
    const invested = f?.invested ?? 0;
    const surplus = income - expense;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      createdAt: u.createdAt,
      patrimonioInvestido: num(assets?.currentValue),
      custoCarteira: num(assets?.investedValue),
      poupancaMediaMensal: months > 0 ? surplus / months : 0,
      taxaPoupanca: income > 0 ? surplus / income : null,
      aporteMedioMensal: months > 0 ? invested / months : 0,
      mesesAtivos: months,
      ultimoLancamento: f?.last ?? null,
    };
  });

  metrics.sort(SORTERS[sort]);

  return {
    users: metrics,
    totals: {
      totalUsuarios: users.length,
      comCarteira: metrics.filter((m) => m.patrimonioInvestido > 0).length,
      patrimonioTotal: metrics.reduce((s, m) => s + m.patrimonioInvestido, 0),
      poupancaMediaMensalSomada: metrics.reduce((s, m) => s + m.poupancaMediaMensal, 0),
    },
  };
}
