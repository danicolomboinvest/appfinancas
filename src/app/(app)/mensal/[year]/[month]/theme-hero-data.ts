import type { AuthContext } from "@/lib/auth/session";
import { listGoalsWithProgress } from "@/lib/repositories/goal.repo";
import type { MonthlySummary } from "@/lib/consolidation/monthly";
import type { CategorySpending } from "@/lib/consolidation/month-analysis";
import { profileTheme, type ProfileThemeKey } from "@/lib/profiles/themes";
import { estadoDoMes, type Estado, type Money } from "@/lib/profiles/voice";

/**
 * O que o bloco próprio do tema precisa saber, já calculado.
 *
 * Desde a versão nova (11/10/2026) só o Manifestação tem bloco próprio, o mural de sonhos. Os
 * blocos do Game (ranqueada), do Disciplina (recado) e do Sem filtro (campeão do mês) saíram
 * junto com os temas. Só consulta o banco quando o tema ativo usa: os outros não pagam nada.
 */
export type DadosDoTema = {
  tema: ProfileThemeKey;
  estado: Estado;
  /** Manifestação: a próxima meta, com quanto já tem. */
  metaEmAndamento: { id: string; nome: string; pct: number; alvo: number; prazo: string | null } | null;
  /** A meta mais recente que chegou a 100%. */
  metaBatida: { nome: string } | null;
  /** Manifestação: o mural, uma meta por sonho. */
  sonhos: { nome: string; pct: number }[];
  /** Manifestação: quanto entrou este mês pra meta em andamento. */
  maisPerto: number;
};

export async function montarDadosDoTema(
  ctx: AuthContext,
  a: {
    year: number;
    month: number;
    now: Date;
    isCurrentMonth: boolean;
    daysInMonth: number;
    mesFechado: boolean;
    summary: MonthlySummary;
    previousSummary: MonthlySummary;
    monthBudgets: { parentCategory: string | null; plannedAmount: { toString(): string } | number }[];
    spentByParent: { parentCategory: string; spent: number }[];
    categorySpending: CategorySpending[];
    entriesDoMes: { category: string; amount: number; goalId: string | null }[];
    money: Money;
  },
): Promise<DadosDoTema> {
  const tema = profileTheme(ctx.profileTheme).key;
  const mesAtual = { income: a.summary.totalIncome, expense: a.summary.totalExpense, investment: a.summary.totalInvestment };
  const estado = estadoDoMes(mesAtual);
  const vazio: DadosDoTema = { tema, estado, metaEmAndamento: null, metaBatida: null, sonhos: [], maisPerto: 0 };
  if (tema !== "manifestacao") return vazio;

  const goals = await listGoalsWithProgress(ctx);
  const comProgresso = goals.map((g) => {
    const alvo = Number(g.targetAmount);
    const pct = alvo > 0 ? Math.min(100, Math.round((g.computedCurrentAmount / alvo) * 100)) : 0;
    return { id: g.id, nome: g.name, alvo, pct, prazo: g.targetDate };
  });
  const emAndamento = comProgresso.find((g) => g.pct < 100) ?? null;
  const batida = comProgresso.find((g) => g.pct >= 100) ?? null;
  const metaEmAndamento = emAndamento
    ? {
        id: emAndamento.id,
        nome: emAndamento.nome,
        pct: emAndamento.pct,
        alvo: emAndamento.alvo,
        prazo: emAndamento.prazo ? emAndamento.prazo.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }) : null,
      }
    : null;
  const maisPerto = emAndamento
    ? a.entriesDoMes.filter((e) => e.category === "INVESTMENT_CONTRIBUTION" && e.goalId === emAndamento.id).reduce((s, e) => s + e.amount, 0)
    : 0;
  return { ...vazio, metaEmAndamento, metaBatida: batida ? { nome: batida.nome } : null, sonhos: comProgresso.slice(0, 3).map((g) => ({ nome: g.nome, pct: g.pct })), maisPerto };
}
