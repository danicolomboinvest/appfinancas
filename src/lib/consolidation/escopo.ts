import type { EntryCategory, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { comFiltro, lancamentosDosTotais, perfisDosTotais, type QuemLe } from "@/lib/casa/regras";

/**
 * O escopo único dos números do mês (15/10/2026, "as coisas precisam bater certinho").
 *
 * Antes o Resumo, o Orçamento e o livre do mês liam os dois da casa (lancamentosDosTotais), e o
 * ranking por categoria, a curva do dia a dia, a visão do ano, os stories, o e-mail do resumo e
 * os avisos do dia liam só quem estava logada ({ userId, profileId }). No casal, o Gastou do
 * Resumo dizia R$ 5.200 e o ranking, o ano e o e-mail diziam R$ 3.000 (sem o gasto do par).
 *
 * Toda leitura de totais passa por aqui: o mesmo filtro (os meus inteiros e os do outro que estão
 * visíveis; o "Só meu" e a conta escondida do outro nunca entram) e a mesma soma por tipo.
 */
export function filtroDosTotais(ctx: QuemLe, resto: Prisma.MonthlyEntryWhereInput): Prisma.MonthlyEntryWhereInput {
  return comFiltro(lancamentosDosTotais(ctx), resto);
}

export type SomaPorTipo = { year: number; month: number; category: EntryCategory; total: number };

/**
 * A carga única: soma dos lançamentos por ano, mês e tipo (renda, gasto, aporte), no escopo dos
 * totais. O resumo do mês, o do ano, os stories e o e-mail partem desta mesma consulta.
 */
export async function somarPorMesETipo(ctx: QuemLe, resto: Prisma.MonthlyEntryWhereInput): Promise<SomaPorTipo[]> {
  const linhas = await prisma.monthlyEntry.groupBy({
    by: ["year", "month", "category"],
    where: filtroDosTotais(ctx, resto),
    _sum: { amount: true },
  });
  return linhas.map((l) => ({ year: l.year, month: l.month, category: l.category, total: Number(l._sum.amount ?? 0) }));
}

/** O nome de cada categoria criada por quem entra nos totais (a minha e a do par na casa). */
export async function nomesDasPersonalizadas(ctx: QuemLe): Promise<{ id: string; name: string; icon: string | null }[]> {
  return prisma.customCategory.findMany({ where: { OR: perfisDosTotais(ctx) }, select: { id: true, name: true, icon: true } });
}
