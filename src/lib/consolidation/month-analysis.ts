import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { nowInBrazil } from "@/lib/date/brazil-now";

/**
 * Análises do mês que respondem "como estou indo?" em vez de só "quanto deu?": a curva do
 * dinheiro dia a dia, o ranking de para onde ele foi, e o que mudou em relação ao mês passado.
 * Tudo derivado dos lançamentos que já existem — nada aqui pede dado novo da pessoa.
 */

export type DailyFlowPoint = {
  day: number;
  /** Acumulado de renda até esse dia (a linha só sobe, é "quanto entrou até aqui"). */
  income: number;
  /** Acumulado de gastos até esse dia. */
  expense: number;
  /** Gasto DO dia (não acumulado) — é o que o mapa de calor pinta. */
  expenseOfDay: number;
};

export type DailyFlow = {
  points: DailyFlowPoint[];
  /** Total de dias do mês, mesmo que a curva pare em hoje — o mapa de calor desenha o mês
   * inteiro, com os dias que ainda não chegaram apagados. */
  daysInMonth: number;
  /** Lançamentos SEM data no mês — o gráfico diário não consegue posicioná-los. Serve pra
   * avisar honestamente que a curva não conta o mês inteiro, em vez de mentir por omissão. */
  undatedCount: number;
  undatedAmount: number;
};

/**
 * Curva acumulada de renda e gastos ao longo dos dias do mês. No mês corrente para no dia de
 * hoje: desenhar a linha reta até o dia 30 pareceria "parou de gastar", quando na verdade o mês
 * ainda não chegou lá. `entryDate` é opcional no lançamento, então quem nunca preencheu a data
 * não tem curva — o card some em vez de mostrar um gráfico vazio (ver undatedCount).
 */
export async function getDailyFlow(ctx: AuthContext, year: number, month: number): Promise<DailyFlow> {
  const entries = await prisma.monthlyEntry.findMany({
    where: { userId: ctx.userId, year, month, category: { in: ["INCOME", "EXPENSE"] } },
    select: { category: true, amount: true, entryDate: true },
  });

  const now = nowInBrazil();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const lastDay = isCurrentMonth ? Math.min(now.getDate(), daysInMonth) : daysInMonth;

  const incomeByDay = new Array<number>(lastDay + 1).fill(0);
  const expenseByDay = new Array<number>(lastDay + 1).fill(0);
  let undatedCount = 0;
  let undatedAmount = 0;

  for (const entry of entries) {
    const amount = Number(entry.amount);
    if (!entry.entryDate) {
      undatedCount += 1;
      undatedAmount += amount;
      continue;
    }
    // O campo é @db.Date (sem hora útil): lê os componentes em UTC pra não escorregar um dia
    // no fuso do servidor, do mesmo jeito que o resto do app trata data "pura".
    const day = entry.entryDate.getUTCDate();
    if (day < 1 || day > lastDay) continue;
    if (entry.category === "INCOME") incomeByDay[day] += amount;
    else expenseByDay[day] += amount;
  }

  const points: DailyFlowPoint[] = [];
  let income = 0;
  let expense = 0;
  for (let day = 1; day <= lastDay; day++) {
    income += incomeByDay[day];
    expense += expenseByDay[day];
    points.push({ day, income, expense, expenseOfDay: expenseByDay[day] });
  }

  return { points, daysInMonth, undatedCount, undatedAmount };
}

export type CategorySpending = {
  /** Chave estável (categoria-mãe ou id da personalizada), pra casar ícone/cor. */
  key: string;
  kind: "parent" | "custom";
  label: string;
  /** Ícone escolhido pela pessoa, só nas personalizadas (as categorias-mãe têm ícone fixo). */
  iconKey: string | null;
  amount: number;
  /** Fatia de TUDO que saiu no mês (0–1), incluindo o que ainda não tem categoria. */
  share: number;
  /** Mesmo gasto no mês anterior; null quando a categoria não existia lá. */
  previousAmount: number | null;
  /** Variação vs. mês anterior (0,2 = subiu 20%); null quando não dá pra comparar. */
  changeRatio: number | null;
};

/**
 * Gastos por categoria no mês, já ordenados do maior pro menor e comparados com o mês anterior.
 * A comparação é o que transforma "R$ 1.325 em Alimentação" (um número solto) em "Alimentação
 * subiu 28%" (algo sobre o que dá pra agir).
 */
export async function getCategorySpending(
  ctx: AuthContext,
  year: number,
  month: number,
  parentLabels: Record<string, string>,
): Promise<CategorySpending[]> {
  const previous = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };

  const [current, prev, customCategories] = await Promise.all([
    prisma.monthlyEntry.groupBy({
      by: ["parentCategory", "customCategoryId"],
      where: { userId: ctx.userId, year, month, category: "EXPENSE" },
      _sum: { amount: true },
    }),
    prisma.monthlyEntry.groupBy({
      by: ["parentCategory", "customCategoryId"],
      where: { userId: ctx.userId, year: previous.year, month: previous.month, category: "EXPENSE" },
      _sum: { amount: true },
    }),
    prisma.customCategory.findMany({ where: { userId: ctx.userId }, select: { id: true, name: true, icon: true } }),
  ]);

  const customCategoryNames = new Map(customCategories.map((c) => [c.id, c.name]));
  const customCategoryIcons = new Map(customCategories.map((c) => [c.id, c.icon]));

  const keyOf = (row: { parentCategory: string | null; customCategoryId: string | null }) =>
    row.parentCategory ? `parent:${row.parentCategory}` : row.customCategoryId ? `custom:${row.customCategoryId}` : null;

  const previousByKey = new Map<string, number>();
  for (const row of prev) {
    const key = keyOf(row);
    if (!key) continue;
    previousByKey.set(key, (previousByKey.get(key) ?? 0) + Number(row._sum.amount ?? 0));
  }

  const currentByKey = new Map<string, number>();
  // Gasto sem categoria não vira linha do ranking (não há o que rankear), mas CONTA no total.
  // Antes ficava de fora da conta e os percentuais eram fatias do que estava categorizado, não
  // do mês: com R$ 3.568 sem categoria, Moradia aparecia com 45% do mês quando era 29% — e a
  // rosca ao lado, que soma o mês inteiro, dava outro número para a mesma categoria.
  let uncategorized = 0;
  for (const row of current) {
    const key = keyOf(row);
    const amount = Number(row._sum.amount ?? 0);
    if (!key) {
      uncategorized += amount;
      continue;
    }
    currentByKey.set(key, (currentByKey.get(key) ?? 0) + amount);
  }

  const total = [...currentByKey.values()].reduce((sum, v) => sum + v, 0) + uncategorized;
  if (total <= 0) return [];

  return [...currentByKey.entries()]
    .map(([key, amount]) => {
      // Só o PRIMEIRO ":" separa o tipo da chave — id de categoria personalizada (cuid) não
      // tem ":", mas dividir por todos os dois-pontos quebraria se um dia tiver.
      const separator = key.indexOf(":");
      const kind = key.slice(0, separator) as "parent" | "custom";
      const value = key.slice(separator + 1);
      const previousAmount = previousByKey.get(key) ?? null;
      return {
        key: value,
        kind,
        label: kind === "parent" ? (parentLabels[value] ?? value) : (customCategoryNames.get(value) ?? "Outro"),
        iconKey: kind === "custom" ? (customCategoryIcons.get(value) ?? null) : null,
        amount,
        share: amount / total,
        previousAmount,
        // Sem gasto no mês anterior não existe "subiu X%" — seria divisão por zero disfarçada
        // de insight ("subiu infinito%"). Nesse caso a UI mostra "novo este mês".
        changeRatio: previousAmount && previousAmount > 0 ? amount / previousAmount - 1 : null,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}
