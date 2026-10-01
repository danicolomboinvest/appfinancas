import { PARENT_CATEGORIES, categoryLabel } from "@/lib/categories";
import type { AuthContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { serverMoney } from "@/lib/money-server";
import { getMonthlySummary } from "@/lib/consolidation/monthly";
import { getCategorySpending, getDailyFlow } from "@/lib/consolidation/month-analysis";
import { listBudgets, sumExpensesByParentCategory } from "@/lib/repositories/budget.repo";
import { listMonthlyEntries } from "@/lib/repositories/monthly-entry.repo";
import { buildMonthInsights } from "@/lib/insights/month-insights";
import { montarDadosDoTema } from "@/app/(app)/mensal/[year]/[month]/theme-hero-data";

/**
 * Os três blocos que saíram da Visão mensal e vieram pro Foco: o bloco próprio do tema (ranking,
 * recado, mural), o "o que mudou" do mês e o estado do "Comece por aqui". Tudo do mês ATUAL —
 * mês passado continua sendo lido na Visão mensal.
 */
export async function carregarBlocosDoMes(ctx: AuthContext, now: Date) {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const anterior = new Date(year, month - 2, 1);
  const rotulos = Object.fromEntries(PARENT_CATEGORIES.map((k) => [k, categoryLabel(ctx.categorias ?? ctx.profileKind, k)]));

  const [money, summary, previousSummary, monthBudgets, spentByParent, categorySpending, entries, dailyFlow, primeiros] = await Promise.all([
    serverMoney(),
    getMonthlySummary(ctx, year, month),
    getMonthlySummary(ctx, anterior.getFullYear(), anterior.getMonth() + 1),
    listBudgets(ctx, year, month),
    sumExpensesByParentCategory(ctx, year, month),
    getCategorySpending(ctx, year, month, rotulos),
    listMonthlyEntries(ctx, year, month),
    getDailyFlow(ctx, year, month),
    Promise.all([
      // O primeiro lançamento do perfil: diz se a conta é nova e há quanto tempo ela usa o app.
      prisma.monthlyEntry.findFirst({ where: { userId: ctx.userId, profileId: ctx.profileId }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
      // Só orçamento com valor: salvar o assistente com tudo em 0 grava linhas zeradas, e o passo
      // aparecia feito com o cartão "Falta o seu orçamento do mês" logo abaixo.
      prisma.budget.count({ where: { userId: ctx.userId, profileId: ctx.profileId, plannedAmount: { gt: 0 } }, take: 1 }),
    ]),
  ]);

  const dadosDoTema = await montarDadosDoTema(ctx, {
    year,
    month,
    now,
    isCurrentMonth: true,
    daysInMonth,
    mesFechado: false,
    summary,
    previousSummary,
    monthBudgets,
    spentByParent,
    categorySpending,
    entriesDoMes: entries.map((e) => ({ category: e.category, amount: Number(e.amount), goalId: e.goalId })),
    money,
  });

  // Mesma conta da Visão mensal: o que saiu ATÉ HOJE, somando fatura sem data (ver a página do mês).
  const insights = buildMonthInsights({
    currentExpense: (dailyFlow.points.at(-1)?.expense ?? 0) + dailyFlow.undatedAmount,
    previousExpense: previousSummary.totalExpense,
    categories: categorySpending,
    money,
    elapsed: now.getDate() / daysInMonth,
  });

  const [primeiroLancamento, budgetCount] = primeiros;
  // O "Comece por aqui" (ver comece.ts) não tem mais o passo da carteira: a iniciante que não
  // investe nunca o fazia, e o guia ficava em 2 de 3 pra sempre.
  return {
    money,
    dadosDoTema,
    insights,
    summary,
    onboarding: { temLancamento: primeiroLancamento !== null, temOrcamento: budgetCount > 0, primeiroLancamentoEm: primeiroLancamento?.createdAt ?? null },
  };
}
