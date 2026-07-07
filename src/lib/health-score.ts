import type { AuthContext } from "@/lib/auth/session";
import { getEmergencyFund } from "@/lib/repositories/emergency-fund.repo";
import { listGoals } from "@/lib/repositories/goal.repo";
import { getMonthlySummary } from "@/lib/consolidation/monthly";
import { getPortfolioStrategyComparison } from "@/lib/portfolio/strategy";
import { computeGoalPlan } from "@/lib/planning/goal";

export type HealthStatus = "boa" | "atencao" | "critica" | "sem-dados";

export type HealthDimension = {
  key: "reserva" | "poupanca" | "estrategia" | "metas";
  label: string;
  /** null quando ainda não há dado suficiente para essa dimensão (não entra na média geral). */
  score: number | null;
  status: HealthStatus;
  detail: string;
};

export type FinancialHealthScore = {
  /** null quando nenhuma dimensão tem dado suficiente ainda. */
  overallScore: number | null;
  status: HealthStatus;
  message: string;
  dimensions: HealthDimension[];
};

/** Peso relativo de cada dimensão na nota geral — redistribuído entre as que têm dado disponível. */
const DIMENSION_WEIGHT: Record<HealthDimension["key"], number> = {
  reserva: 30,
  poupanca: 25,
  estrategia: 25,
  metas: 20,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function statusFromScore(score: number | null): HealthStatus {
  if (score === null) return "sem-dados";
  if (score >= 70) return "boa";
  if (score >= 40) return "atencao";
  return "critica";
}

export function scoreReserva(target: number, current: number): HealthDimension {
  if (target <= 0) {
    return {
      key: "reserva",
      label: "Reserva de emergência",
      score: null,
      status: "sem-dados",
      detail: "Configure sua reserva de emergência para entrar nessa nota.",
    };
  }
  const percent = clamp(current / target, 0, 1);
  const score = Math.round(percent * 100);
  return {
    key: "reserva",
    label: "Reserva de emergência",
    score,
    status: statusFromScore(score),
    detail:
      score >= 100
        ? "Sua reserva cobre o valor-alvo definido."
        : `Sua reserva cobre ${score}% do valor-alvo.`,
  };
}

export function scorePoupanca(income: number, expense: number): HealthDimension {
  if (income <= 0) {
    return {
      key: "poupanca",
      label: "Taxa de poupança",
      score: null,
      status: "sem-dados",
      detail: "Lance sua renda do mês para entrar nessa nota.",
    };
  }
  const rate = (income - expense) / income;
  const score = Math.round(clamp((rate / 0.3) * 100, 0, 100));
  return {
    key: "poupanca",
    label: "Taxa de poupança",
    score,
    status: statusFromScore(score),
    detail:
      rate >= 0
        ? `Você está poupando ${Math.round(rate * 100)}% da sua renda este mês.`
        : `Você gastou mais do que ganhou este mês (${Math.round(Math.abs(rate) * 100)}% acima da renda).`,
  };
}

export function scoreEstrategia(deviations: number[]): HealthDimension {
  if (deviations.length === 0) {
    return {
      key: "estrategia",
      label: "Aderência à estratégia",
      score: null,
      status: "sem-dados",
      detail: "Defina uma estratégia de carteira para entrar nessa nota.",
    };
  }
  const avgDeviationPP = (deviations.reduce((sum, d) => sum + Math.abs(d), 0) / deviations.length) * 100;
  const score = Math.round(clamp(100 - avgDeviationPP * 2, 0, 100));
  return {
    key: "estrategia",
    label: "Aderência à estratégia",
    score,
    status: statusFromScore(score),
    detail:
      score >= 90
        ? "Sua carteira está bem alinhada à estratégia definida."
        : `Sua carteira se desvia em média ${avgDeviationPP.toFixed(1)} p.p. por classe da estratégia definida.`,
  };
}

export function scoreMetas(onTrackOrAchieved: number, total: number): HealthDimension {
  if (total === 0) {
    return {
      key: "metas",
      label: "Progresso das metas",
      score: null,
      status: "sem-dados",
      detail: "Cadastre uma meta para entrar nessa nota.",
    };
  }
  const score = Math.round((onTrackOrAchieved / total) * 100);
  return {
    key: "metas",
    label: "Progresso das metas",
    score,
    status: statusFromScore(score),
    detail: `${onTrackOrAchieved} de ${total} meta${total > 1 ? "s" : ""} no ritmo certo ou concluída${total > 1 ? "s" : ""}.`,
  };
}

/** Combina as dimensões já calculadas em uma nota geral — pura composição, sem I/O. */
export function combineHealthDimensions(dimensions: HealthDimension[]): Omit<FinancialHealthScore, "dimensions"> {
  const available = dimensions.filter((d): d is HealthDimension & { score: number } => d.score !== null);

  let overallScore: number | null = null;
  if (available.length > 0) {
    const totalWeight = available.reduce((sum, d) => sum + DIMENSION_WEIGHT[d.key], 0);
    const weightedSum = available.reduce((sum, d) => sum + d.score * DIMENSION_WEIGHT[d.key], 0);
    overallScore = Math.round(weightedSum / totalWeight);
  }

  const status = statusFromScore(overallScore);
  return { overallScore, status, message: overallMessage(status) };
}

function overallMessage(status: HealthStatus): string {
  switch (status) {
    case "boa":
      return "Sua saúde financeira está sólida — continue com a disciplina atual.";
    case "atencao":
      return "Sua saúde financeira está no caminho, mas alguns pontos merecem atenção.";
    case "critica":
      return "Sua saúde financeira precisa de atenção — priorize os pontos críticos abaixo.";
    default:
      return "Ainda não há dados suficientes para calcular sua nota. Cadastre reserva, orçamento, metas e uma estratégia de carteira.";
  }
}

/**
 * Nota de 0 a 100 combinando reserva de emergência, taxa de poupança do mês, aderência à
 * estratégia de carteira e progresso das metas — as únicas dimensões com dado real disponível
 * hoje no app (não há endividamento cadastrado, por isso essa dimensão do modelo clássico de
 * saúde financeira fica de fora até existir uma tela de dívidas).
 */
export async function computeFinancialHealthScore(ctx: AuthContext): Promise<FinancialHealthScore> {
  const now = new Date();

  const [emergencyFund, goals, monthlySummary, strategyComparison] = await Promise.all([
    getEmergencyFund(ctx),
    listGoals(ctx),
    getMonthlySummary(ctx, now.getFullYear(), now.getMonth() + 1),
    getPortfolioStrategyComparison(ctx),
  ]);

  const reserva = scoreReserva(
    emergencyFund ? Number(emergencyFund.targetAmount) : 0,
    emergencyFund ? Number(emergencyFund.currentAmount) : 0,
  );

  const poupanca = scorePoupanca(monthlySummary.totalIncome, monthlySummary.totalExpense);

  const strategyDeviations = strategyComparison.positions
    .filter((p) => p.targetPercent > 0)
    .map((p) => p.deviationPercent);
  const estrategia = scoreEstrategia(strategyDeviations);

  const goalPlans = goals.map((goal) =>
    computeGoalPlan({
      targetAmount: Number(goal.targetAmount),
      currentAmount: Number(goal.currentAmount),
      targetDate: goal.targetDate ?? now,
      annualRate: Number(goal.annualRate ?? 0),
    }),
  );
  const onTrackOrAchieved = goalPlans.filter((p) => p.status === "ON_TRACK" || p.status === "ACHIEVED").length;
  const metas = scoreMetas(onTrackOrAchieved, goals.length);

  const dimensions = [reserva, poupanca, estrategia, metas];
  return { ...combineHealthDimensions(dimensions), dimensions };
}
