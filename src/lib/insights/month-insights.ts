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
/**
 * Fração do mês corrente que já passou (0–1). Mês fechado = 1. Abaixo disto, a comparação
 * "com o mês passado" ainda não vale uma frase: dia 5, com meia dúzia de gastos, qualquer
 * mês está "80% abaixo do anterior" — e o app dizia "continue assim".
 */
const MIN_ELAPSED_TO_COMPARE = 0.25;

export function totalSpendingInsight(currentExpense: number, previousExpense: number, elapsed = 1): Insight | null {
  // Sem mês anterior (primeiro mês de uso) não há comparação honesta a fazer.
  if (previousExpense <= 0) return null;
  if (elapsed < MIN_ELAPSED_TO_COMPARE) return null;
  // Mês em andamento contra o MESMO pedaço do mês passado, não contra o mês passado inteiro.
  const comparable = previousExpense * elapsed;
  const ratio = currentExpense / comparable - 1;
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
export function biggestMoverInsight(categories: CategorySpending[], money: MoneyFormatter, elapsed = 1): Insight | null {
  if (elapsed < MIN_ELAPSED_TO_COMPARE) return null;
  // Mesma régua do total: o mês passado entra proporcional ao que já passou deste.
  const scaled = categories
    .filter((c) => c.previousAmount !== null && c.previousAmount > 0)
    .map((c) => {
      const previous = (c.previousAmount as number) * elapsed;
      return { ...c, previousAmount: previous, changeRatio: c.amount / previous - 1 };
    });
  const candidates = scaled.filter(
    (c) =>
      Math.abs(c.changeRatio) >= RELEVANT_CHANGE &&
      c.amount >= MIN_CATEGORY_AMOUNT &&
      c.previousAmount >= MIN_CATEGORY_AMOUNT,
  );
  if (candidates.length === 0) return null;

  const top = candidates.reduce((best, c) => {
    const delta = Math.abs(c.amount - c.previousAmount);
    const bestDelta = Math.abs(best.amount - best.previousAmount);
    return delta > bestDelta ? c : best;
  });

  const ratio = top.changeRatio;
  const delta = Math.abs(top.amount - top.previousAmount);
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
  /** Quanto do mês já passou (0–1); 1 para mês fechado. Sem isso, dia 5 sempre "gastou menos". */
  elapsed?: number;
}): Insight[] {
  const { currentExpense, previousExpense, categories, money, limit = 2, elapsed = 1 } = params;
  const insights = [
    totalSpendingInsight(currentExpense, previousExpense, elapsed),
    biggestMoverInsight(categories, money, elapsed),
    concentrationInsight(categories),
  ].filter((i): i is Insight => i !== null);
  return insights.slice(0, limit);
}
