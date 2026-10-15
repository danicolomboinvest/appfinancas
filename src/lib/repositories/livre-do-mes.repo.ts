import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { getMonthlyPlan } from "@/lib/repositories/monthly-plan.repo";
import { comFiltro, donoDoOrcamento, lancamentosDosTotais } from "@/lib/casa/regras";
import { calcularLivreDoMes, type LivreDoMes, type MesDoLivre } from "@/lib/planning/livre-do-mes";

/**
 * Lê o mês e devolve o livre. Casal simples: o plano é o da casa (donoDoOrcamento) e os gastos são
 * os dos dois que entram nos totais (lancamentosDosTotais), os mesmos do Orçamento.
 */
export async function carregarLivreDoMes(ctx: AuthContext, m: MesDoLivre): Promise<LivreDoMes> {
  const dono = donoDoOrcamento(ctx);
  const [plano, gasto, mensal] = await Promise.all([
    prisma.budget.aggregate({
      where: { ...dono, year: m.ano, month: m.mes, OR: [{ parentCategory: { not: null } }, { customCategoryId: { not: null } }] },
      _sum: { plannedAmount: true },
    }),
    prisma.monthlyEntry.aggregate({
      where: comFiltro(lancamentosDosTotais(ctx), { year: m.ano, month: m.mes, category: "EXPENSE" }),
      _sum: { amount: true },
    }),
    getMonthlyPlan(ctx, m.ano, m.mes),
  ]);
  return calcularLivreDoMes({
    ...m,
    planejado: Number(plano._sum.plannedAmount ?? 0),
    gasto: Number(gasto._sum.amount ?? 0),
    renda: mensal?.plannedIncome ?? null,
    guardar: mensal?.plannedInvestment ?? null,
  });
}
