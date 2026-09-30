"use server";

import type { Prisma } from "@prisma/client";
import { getRequiredSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { filtroDaSemana } from "@/lib/repositories/budget.repo";

export type CategoryTransaction = {
  id: string;
  description: string;
  /** "YYYY-MM-DD" quando há data da despesa; senão null. */
  date: string | null;
  amount: number;
};

export type CategoryRef =
  | { kind: "parent"; value: string }
  | { kind: "custom"; value: string };

/**
 * Lista os lançamentos (gastos) de uma categoria dentro do período selecionado na tela "Só
 * gastos", alimenta o clique na fatia/legenda da pizza, que expande pra mostrar o que compõe
 * aquele valor. Semana usa filtroDaSemana (o mesmo do total da fatia); mês/ano usam year/month.
 */
export async function getCategoryTransactionsAction(
  period: "semana" | "mes" | "ano",
  year: number,
  month: number,
  category: CategoryRef,
): Promise<CategoryTransaction[]> {
  const ctx = await getRequiredSession();

  const categoryWhere: Prisma.MonthlyEntryWhereInput =
    category.kind === "parent" ? { parentCategory: category.value as never } : { customCategoryId: category.value };

  let periodWhere: Prisma.MonthlyEntryWhereInput;
  if (period === "semana") {
    // O mesmo critério do total da fatia (sumExpenses*Since na página): antes a lista usava só
    // createdAt dos últimos 7 dias, então o aluguel com "Repetir até dezembro" aparecia 4 vezes
    // na lista (R$ 8.000) numa fatia que somava R$ 2.000.
    const hoje = nowInBrazil();
    const weekAgo = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000);
    periodWhere = filtroDaSemana(weekAgo, hoje);
  } else if (period === "ano") {
    periodWhere = { year };
  } else {
    periodWhere = { year, month };
  }

  const entries = await prisma.monthlyEntry.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, category: "EXPENSE", ...categoryWhere, ...periodWhere },
    select: { id: true, description: true, subcategory: true, amount: true, entryDate: true, createdAt: true },
    orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
    take: 50,
  });

  return entries.map((e) => ({
    id: e.id,
    description: e.description || e.subcategory || "Lançamento",
    date: e.entryDate ? e.entryDate.toISOString().slice(0, 10) : null,
    amount: Number(e.amount),
  }));
}
