import type { AuthContext } from "@/lib/auth/session";
import { PARENT_CATEGORIES } from "@/lib/categories";
import { getMonthlySummary } from "@/lib/consolidation/monthly";
import { sumExpensesByParentCategory, sumExpensesByCustomCategory } from "@/lib/repositories/budget.repo";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { mesDeReferenciaDasDicas, mesesQueFaltamNoAno } from "@/lib/planning/plano-anual";
import { padraoPorCategoria } from "@/lib/planning/padrao-orcamento";

export type BudgetHints = {
  /** "agosto" — o último mês fechado, que é a referência de "copiar" e de "entrou". */
  lastMonthLabel: string;
  lastMonthIncome: number;
  /** Gasto do último mês fechado por categoria (chave = ParentCategory ou id de personalizada). */
  lastMonthByCategory: Record<string, number>;
  /** Média dos últimos 3 meses fechados por categoria: base do "Sugerir pra mim". */
  averageByCategory: Record<string, number>;
  /** Meses que ainda faltam no ano (contando o atual): pra "R$ X guardados até dezembro". */
  monthsLeftInYear: number;
  /**
   * O padrão dela: o mês do meio dos últimos 3 fechados, por categoria (ver padrao-orcamento.ts).
   * É a base do "Usar o meu padrão" e das sugestões de ajuste. Mediana, não média: um mês fora
   * da curva não vira plano.
   */
  padraoByCategory: Record<string, number>;
  /** Quantos dos 3 meses tinham algum gasto. Abaixo de 2 não se fala em padrão. */
  mesesComDado: number;
  /** Gasto por categoria de cada um dos 3 meses, do mais antigo ao mais recente. */
  porMes: Record<string, number>[];
};

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function shift(year: number, month: number, back: number): { year: number; month: number } {
  const d = new Date(year, month - 1 - back, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/**
 * O que o app já sabe antes de perguntar: quanto entrou no mês passado, quanto saiu em cada
 * categoria, e a média dos últimos três meses. É o que deixa o orçamento começar preenchido
 * em vez de em branco — a pessoa ajusta, não inventa.
 */
export async function getBudgetHints(ctx: AuthContext, year: number, today: Date = nowInBrazil()): Promise<BudgetHints> {
  // `today` é o relógio de Brasília: com o do servidor (UTC), das 21h à meia-noite do último dia
  // do mês o "mês passado" virava o mês corrente, ainda aberto, e os "meses que faltam" ficavam
  // um a menos do que o Salvar grava.
  const ref = mesDeReferenciaDasDicas(year, today);
  const windows = [0, 1, 2].map((back) => shift(ref.year, ref.month, back));

  const [summary, ...spent] = await Promise.all([
    getMonthlySummary(ctx, ref.year, ref.month),
    ...windows.flatMap((w) => [sumExpensesByParentCategory(ctx, w.year, w.month), sumExpensesByCustomCategory(ctx, w.year, w.month)]),
  ]);

  const perMonth: Record<string, number>[] = windows.map(() => ({}));
  spent.forEach((rows, i) => {
    const target = perMonth[Math.floor(i / 2)];
    for (const r of rows as { parentCategory?: string | null; customCategoryId?: string | null; spent: number }[]) {
      const key = r.parentCategory ?? r.customCategoryId;
      if (key) target[key] = (target[key] ?? 0) + r.spent;
    }
  });

  const keys = new Set<string>([...PARENT_CATEGORIES, ...perMonth.flatMap((m) => Object.keys(m))]);
  const monthsWithData = perMonth.filter((m) => Object.values(m).some((v) => v > 0)).length || 1;
  const averageByCategory: Record<string, number> = {};
  for (const k of keys) {
    const total = perMonth.reduce((sum, m) => sum + (m[k] ?? 0), 0);
    averageByCategory[k] = Math.round(total / monthsWithData);
  }

  const porMes = [...perMonth].reverse();
  const { padrao: padraoByCategory, mesesComDado } = padraoPorCategoria(porMes);

  return {
    padraoByCategory,
    mesesComDado,
    porMes,
    lastMonthLabel: MONTHS[ref.month - 1],
    lastMonthIncome: summary.totalIncome,
    lastMonthByCategory: perMonth[0],
    averageByCategory,
    monthsLeftInYear: mesesQueFaltamNoAno(year, today),
  };
}
