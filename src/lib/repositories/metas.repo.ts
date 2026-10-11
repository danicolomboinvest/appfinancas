import type { GoalIcon } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { doDono, type AuthContext } from "@/lib/auth/session";
import { aportesJaOcorridosWhere } from "@/lib/planning/goal-progress";
import { listGoalsWithProgress, getGoalWithProgress } from "@/lib/repositories/goal.repo";
import { chaveDoMes, mesDoAporte, planoDaMeta, type PlanoDaMeta } from "@/lib/metas/projecao";
import { fotoDaMeta } from "@/lib/metas/tipos";
import { parseTripPlan } from "@/lib/travel/assistente";

/**
 * O que a área Metas da versão nova lê do banco (lista, detalhe e o cartão do aporte do mês).
 * As contas são as de lib/metas/projecao; aqui só se junta o dado.
 */

export type AporteDaMeta = { id: string; valor: number; ano: number; mes: number; dia: number | null; descricao: string | null };

export type MetaDaTela = {
  id: string;
  nome: string;
  icon: GoalIcon;
  foto: string;
  alvo: number;
  guardado: number;
  prazo: Date | null;
  taxaAnual: number;
  inicio: Date;
  combinado: number;
  aportesPorMes: Map<string, number>;
  aportes: AporteDaMeta[];
  plano: PlanoDaMeta;
  checkinDismissedMonth: string | null;
  aporteAdiadoMes: string | null;
  aportesRecusados: string[];
  /** A meta nasceu no assistente de Viagem (Goal.viagem): o "Editar" volta para lá. */
  daViagem: boolean;
};

type GoalComProgresso = Awaited<ReturnType<typeof listGoalsWithProgress>>[number];

function montar(g: GoalComProgresso | NonNullable<Awaited<ReturnType<typeof getGoalWithProgress>>>, aportes: AporteDaMeta[], hoje: Date): MetaDaTela {
  const aportesPorMes = new Map<string, number>();
  for (const a of aportes) {
    const k = chaveDoMes(a.ano, a.mes);
    aportesPorMes.set(k, (aportesPorMes.get(k) ?? 0) + a.valor);
  }
  const alvo = Number(g.targetAmount);
  const guardado = g.computedCurrentAmount;
  const taxaAnual = Number(g.annualRate ?? 0);
  const combinado = Number(g.monthlyContribution ?? 0);
  return {
    id: g.id,
    nome: g.name,
    icon: g.icon,
    foto: fotoDaMeta({ fotoUrl: g.fotoUrl, icon: g.icon, name: g.name }),
    alvo,
    guardado,
    prazo: g.targetDate,
    taxaAnual,
    inicio: g.createdAt,
    combinado,
    aportesPorMes,
    aportes,
    plano: planoDaMeta({ alvo, guardado, prazo: g.targetDate, taxaAnual, inicio: g.createdAt, porMesCombinado: combinado, aportes: aportesPorMes, hoje }),
    checkinDismissedMonth: g.checkinDismissedMonth,
    aporteAdiadoMes: g.aporteAdiadoMes,
    aportesRecusados: g.aportesRecusados,
    daViagem: parseTripPlan(g.viagem) !== null,
  };
}

async function aportesDasMetas(ctx: AuthContext, hoje: Date, goalIds: string[]) {
  if (goalIds.length === 0) return new Map<string, AporteDaMeta[]>();
  const linhas = await prisma.monthlyEntry.findMany({
    where: { ...doDono(ctx), goalId: { in: goalIds }, category: "INVESTMENT_CONTRIBUTION", ...aportesJaOcorridosWhere(hoje) },
    select: { id: true, goalId: true, amount: true, year: true, month: true, entryDate: true, description: true },
    orderBy: [{ year: "asc" }, { month: "asc" }, { entryDate: "asc" }, { createdAt: "asc" }],
  });
  const porMeta = new Map<string, AporteDaMeta[]>();
  for (const l of linhas) {
    if (!l.goalId) continue;
    const lista = porMeta.get(l.goalId) ?? [];
    lista.push({ id: l.id, valor: Number(l.amount), ano: l.year, mes: l.month, dia: l.entryDate ? l.entryDate.getUTCDate() : null, descricao: l.description });
    porMeta.set(l.goalId, lista);
  }
  return porMeta;
}

/** Todas as metas do perfil, já com o plano de cada uma. */
export async function listarMetasDaTela(ctx: AuthContext, hoje: Date): Promise<MetaDaTela[]> {
  const goals = await listGoalsWithProgress(ctx);
  const aportes = await aportesDasMetas(ctx, hoje, goals.map((g) => g.id));
  return goals.map((g) => montar(g, aportes.get(g.id) ?? [], hoje));
}

/** Uma meta, com o plano. Nula se não for do perfil. */
export async function lerMetaDaTela(ctx: AuthContext, id: string, hoje: Date): Promise<MetaDaTela | null> {
  const g = await getGoalWithProgress(ctx, id);
  if (!g) return null;
  const aportes = await aportesDasMetas(ctx, hoje, [g.id]);
  return montar(g, aportes.get(g.id) ?? [], hoje);
}

/** Onde está o dinheiro: os ativos da Carteira ligados à meta. */
export async function ativosDaMeta(ctx: AuthContext, goalId: string) {
  const ativos = await prisma.asset.findMany({
    where: { ...doDono(ctx), goalId },
    select: { id: true, name: true, ticker: true, currentValue: true },
    orderBy: { currentValue: "desc" },
  });
  return ativos.map((a) => ({ id: a.id, nome: a.ticker || a.name, descricao: a.name, valor: Number(a.currentValue) }));
}

export type AporteSemMeta = { id: string; valor: number; dia: number | null; mes: number; ano: number; descricao: string | null; origem: "pix" | "aplicacao" };

/**
 * O que veio do extrato (ou foi lançado) como guardar e ainda não tem meta: a pergunta "Foi para
 * esta meta?". Só do mês do aporte e do mês de hoje (o Pix do dia 5 de outubro pode ser o aporte
 * de setembro), até hoje, sem os que ela já disse que não eram desta meta. Quando o aporte foi
 * para um ativo de OUTRA meta, não é pergunta desta.
 */
export async function aportesSemMeta(ctx: AuthContext, goalId: string, recusados: string[], hoje: Date): Promise<AporteSemMeta[]> {
  const ref = mesDoAporte(hoje);
  const meses = [{ year: ref.ano, month: ref.mes }];
  if (ref.doMesPassado) meses.push({ year: hoje.getFullYear(), month: hoje.getMonth() + 1 });
  const linhas = await prisma.monthlyEntry.findMany({
    where: {
      ...doDono(ctx),
      goalId: null,
      category: "INVESTMENT_CONTRIBUTION",
      amount: { gt: 0 },
      OR: meses,
      id: { notIn: recusados },
    },
    select: { id: true, amount: true, year: true, month: true, entryDate: true, description: true, allocations: { select: { asset: { select: { goalId: true } } } } },
    orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
    take: 10,
  });
  const limite = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);
  return linhas
    .filter((l) => !l.entryDate || new Date(l.entryDate.getUTCFullYear(), l.entryDate.getUTCMonth(), l.entryDate.getUTCDate()) <= limite)
    .filter((l) => l.allocations.every((a) => a.asset.goalId === null || a.asset.goalId === goalId))
    .map((l) => ({
      id: l.id,
      valor: Number(l.amount),
      dia: l.entryDate ? l.entryDate.getUTCDate() : null,
      mes: l.month,
      ano: l.year,
      descricao: l.description,
      origem: /\b(pix|transf\w*|ted|doc)\b/i.test(l.description ?? "") ? ("pix" as const) : ("aplicacao" as const),
    }));
}
