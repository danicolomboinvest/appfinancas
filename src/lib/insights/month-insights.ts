import type { CategorySpending } from "@/lib/consolidation/month-analysis";
import type { MoneyFormatter } from "@/lib/money";

/**
 * Traduz os números do mês em frases que dizem o que eles SIGNIFICAM. A tela já mostra
 * "R$ 4.362 em gastos"; o que falta é "gastou 12% menos que no mês passado" — a mesma
 * informação, só que já comparada, que é o que dá pra agir em cima.
 *
 * Tudo aqui é função pura (recebe número, devolve texto) pra conseguir testar as bordas:
 * mês sem histórico, divisão por zero, variação irrelevante que não merece virar alarde.
 */

export type InsightTone = "positive" | "warning" | "neutral";

export type Insight = {
  tone: InsightTone;
  text: string;
};

/** Abaixo disso é ruído de mês (um mercado a mais, uma conta que caiu dia 31), não tendência. */
const RELEVANT_CHANGE = 0.08;
/** Categoria com gasto pequeno vira "subiu 300%" por qualquer coisa — não vale como alerta. */
const MIN_CATEGORY_AMOUNT = 50;


function percent(ratio: number): string {
  return `${Math.round(Math.abs(ratio) * 100)}%`;
}

/**
 * Frase principal do mês: como o gasto total está em relação ao mês anterior. É a que vai no
 * topo, junto do "quanto sobrou" — a leitura de 2 segundos de quem abriu o app.
 */
export function totalSpendingInsight(currentExpense: number, previousExpense: number): Insight | null {
  // Sem mês anterior (primeiro mês de uso) não há comparação honesta a fazer.
  if (previousExpense <= 0) return null;
  const ratio = currentExpense / previousExpense - 1;
  if (Math.abs(ratio) < RELEVANT_CHANGE) {
    return { tone: "neutral", text: "Seus gastos estão praticamente no mesmo nível do mês passado." };
  }
  if (ratio < 0) {
    return { tone: "positive", text: `Você está gastando ${percent(ratio)} menos que no mês passado. Continue assim.` };
  }
  return { tone: "warning", text: `Seus gastos estão ${percent(ratio)} acima do mês passado.` };
}

/**
 * A categoria que mais mudou de um mês pro outro — em reais, não em porcentagem: 40% a mais no
 * cafezinho é barulho, 12% a mais no aluguel é o que realmente mexe no bolso.
 */
export function biggestMoverInsight(categories: CategorySpending[], money: MoneyFormatter): Insight | null {
  const candidates = categories.filter(
    (c) =>
      c.changeRatio !== null &&
      Math.abs(c.changeRatio) >= RELEVANT_CHANGE &&
      c.amount >= MIN_CATEGORY_AMOUNT &&
      (c.previousAmount ?? 0) >= MIN_CATEGORY_AMOUNT,
  );
  if (candidates.length === 0) return null;

  const top = candidates.reduce((best, c) => {
    const delta = Math.abs(c.amount - (c.previousAmount ?? 0));
    const bestDelta = Math.abs(best.amount - (best.previousAmount ?? 0));
    return delta > bestDelta ? c : best;
  });

  const ratio = top.changeRatio!;
  const delta = Math.abs(top.amount - (top.previousAmount ?? 0));
  if (ratio > 0) {
    return {
      tone: "warning",
      text: `${top.label} subiu ${percent(ratio)} em relação ao mês passado (${money(delta)} a mais).`,
    };
  }
  return {
    tone: "positive",
    text: `${top.label} caiu ${percent(ratio)} em relação ao mês passado (${money(delta)} a menos).`,
  };
}

/** Onde o dinheiro mais se concentrou — só vira insight quando a concentração é alta de verdade. */
export function concentrationInsight(categories: CategorySpending[]): Insight | null {
  const top = categories[0];
  if (!top || top.share < 0.4) return null;
  return {
    tone: "neutral",
    text: `${top.label} consome ${percent(top.share)} de tudo que você gasta.`,
  };
}

/**
 * Monta as frases do mês, da mais importante pra menos, sem repetir a mesma ideia duas vezes.
 * Devolve no máximo `limit` — um painel com oito avisos não é clareza, é outro tipo de ruído.
 */
export function buildMonthInsights(params: {
  currentExpense: number;
  previousExpense: number;
  categories: CategorySpending[];
  limit?: number;
  /** Formatador da moeda escolhida — o texto cita valores, e a moeda é do usuário. */
  money: MoneyFormatter;
}): Insight[] {
  const { currentExpense, previousExpense, categories, money, limit = 2 } = params;
  const insights = [
    totalSpendingInsight(currentExpense, previousExpense),
    biggestMoverInsight(categories, money),
    concentrationInsight(categories),
  ].filter((i): i is Insight => i !== null);
  return insights.slice(0, limit);
}
