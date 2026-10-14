import type { AuthContext } from "@/lib/auth/session";
import { PARENT_CATEGORIES } from "@/lib/categories";
import { getRendaMedia } from "@/lib/repositories/renda-media.repo";
import { sumExpensesByParentCategory, sumExpensesByCustomCategory } from "@/lib/repositories/budget.repo";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { mesDeReferenciaDasDicas, mesesQueFaltamNoAno } from "@/lib/planning/plano-anual";

export type BudgetHints = {
  /** "agosto" — o último mês fechado, que é a referência de "copiar". */
  lastMonthLabel: string;
  /**
   * A renda sugerida: a MÉDIA dos 12 meses fechados até o mês de referência que têm entrada
   * (pedido da Dani, 13/10/2026: nunca o último mês sozinho). Zero sem nenhuma entrada.
   */
  rendaMedia: number;
  /** De quantos meses é a média (0 sem entrada): a tela diz "média de N meses". */
  rendaMediaMeses: number;
  /** Gasto do último mês fechado por categoria (chave = ParentCategory ou id de personalizada). */
  lastMonthByCategory: Record<string, number>;
  /** Média por categoria dos últimos 12 meses fechados que ela preencheu: base do "Sugerir pra mim". */
  averageByCategory: Record<string, number>;
  /** Meses que ainda faltam no ano (contando o atual): pra "R$ X guardados até dezembro". */
  monthsLeftInYear: number;
  /**
   * O padrão dela (13/10/2026, pedido da Dani): a MÉDIA dos últimos 12 meses fechados, por
   * categoria, contando só os meses que ela preencheu (mês sem nenhum lançamento não puxa para
   * baixo). Antes era a mediana de 3 meses, e um gasto de vez em quando (o Pix para o pai em
   * Moradia, em jan, mar e mai) nunca aparecia. É a base do "Usar o meu padrão".
   */
  padraoByCategory: Record<string, number>;
  /** Quantos dos 12 meses ela preencheu. Abaixo de 2 não se fala em padrão. */
  mesesComDado: number;
  /** Gasto por categoria dos 3 últimos meses, do mais antigo ao mais recente (as sugestões de ajuste). */
  porMes: Record<string, number>[];
};

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function shift(year: number, month: number, back: number): { year: number; month: number } {
  const d = new Date(year, month - 1 - back, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/**
 * O que o app já sabe antes de perguntar: quanto entra por mês (média de 12 meses), quanto saiu em cada
 * categoria, e a média dos últimos três meses. É o que deixa o orçamento começar preenchido
 * em vez de em branco — a pessoa ajusta, não inventa.
 */
export async function getBudgetHints(ctx: AuthContext, year: number, today: Date = nowInBrazil()): Promise<BudgetHints> {
  // `today` é o relógio de Brasília: com o do servidor (UTC), das 21h à meia-noite do último dia
  // do mês o "mês passado" virava o mês corrente, ainda aberto, e os "meses que faltam" ficavam
  // um a menos do que o Salvar grava.
  const ref = mesDeReferenciaDasDicas(year, today);
  const windows = Array.from({ length: 12 }, (_, back) => shift(ref.year, ref.month, back));

  // A média termina no mês de referência: o "hoje" dela é o mês seguinte a ele.
  const [rendaMedia, ...spent] = await Promise.all([
    getRendaMedia(ctx, new Date(ref.year, ref.month, 1)),
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

  // As sugestões de ajuste continuam olhando os 3 últimos meses (mudança recente de hábito).
  const porMes = perMonth.slice(0, 3).reverse();
  const preenchidos = perMonth.filter((m) => Object.values(m).some((v) => v > 0)).length;
  const padraoByCategory = averageByCategory;
  const mesesComDado = preenchidos;

  return {
    padraoByCategory,
    mesesComDado,
    porMes,
    lastMonthLabel: MONTHS[ref.month - 1],
    rendaMedia: rendaMedia?.valor ?? 0,
    rendaMediaMeses: rendaMedia?.meses ?? 0,
    lastMonthByCategory: perMonth[0],
    averageByCategory,
    monthsLeftInYear: mesesQueFaltamNoAno(year, today),
  };
}
