import type { AssetClass, AssetObjective, FixedIncomeIndex } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";

export type AssetInput = {
  name: string;
  ticker?: string;
  assetClass: AssetClass;
  objective: AssetObjective;
  goalId?: string;
  quantity?: number;
  currentUnitPrice?: number;
  /** Quanto foi investido, a atualização de cotações nunca altera este campo. */
  investedValue?: number;
  /** Indexador da renda fixa (pós/IPCA/prefixado), refina o mapeamento pra Estratégia. */
  fixedIncomeIndex?: FixedIncomeIndex;
  currentValue: number;
  /** "BRL" conta Brasil, "USD" conta no exterior (ver lib/portfolio/conta-exterior.ts). */
  currency?: string;
  nativeCurrentValue?: number | null;
  nativeInvestedValue?: number | null;
  exchangeRate?: number | null;
  idealAllocationPercent?: number;
  acquisitionDate?: Date;
  notes?: string;
  /** Classificação escolhida por ela (Novo ativo: "Não é isso?"). Ausente = automático. */
  tipoEscolhido?: string;
  ondeEscolhido?: string;
  /** Taxa da compra em fração, com o indexador (ver lib/portfolio/taxa-compra.ts). null apaga. */
  taxaCompra?: number | null;
  /** O valor que ela informou e quando (rendimento da renda fixa parte daqui). null apaga. */
  valorInformado?: number | null;
  valorInformadoEm?: Date | null;
};

export async function listAssets(ctx: AuthContext) {
  return prisma.asset.findMany({ where: { userId: ctx.userId, profileId: ctx.profileId }, orderBy: { createdAt: "desc" } });
}

/** goalId só é aceito se apontar para uma meta do próprio usuário, evita associar a ativo de outro. */
async function resolveOwnGoalId(ctx: AuthContext, input: AssetInput): Promise<string | null> {
  if (input.objective !== "META" || !input.goalId) return null;
  const goal = await prisma.goal.findFirst({ where: { id: input.goalId, userId: ctx.userId, profileId: ctx.profileId }, select: { id: true } });
  return goal?.id ?? null;
}

export async function createAsset(ctx: AuthContext, input: AssetInput) {
  const goalId = await resolveOwnGoalId(ctx, input);
  return prisma.asset.create({ data: { ...input, goalId, userId: ctx.userId, profileId: ctx.profileId } });
}

export async function updateOwnAsset(ctx: AuthContext, id: string, input: AssetInput) {
  const goalId = await resolveOwnGoalId(ctx, input);
  return prisma.asset.updateMany({ where: { id, userId: ctx.userId, profileId: ctx.profileId }, data: { ...input, goalId } });
}

export async function deleteOwnAsset(ctx: AuthContext, id: string) {
  return prisma.asset.deleteMany({ where: { id, userId: ctx.userId, profileId: ctx.profileId } });
}

/**
 * "Trocar" a classificação no detalhe do ativo (rodada 23). Nulo nos dois = "Voltar ao automático".
 * Os valores já chegam validados (lib/portfolio/classificacao.ts).
 */
export async function trocarClassificacaoDoAtivo(ctx: AuthContext, id: string, escolha: { tipo: string | null; onde: string | null }) {
  return prisma.asset.updateMany({
    where: { id, userId: ctx.userId, profileId: ctx.profileId },
    data: { tipoEscolhido: escolha.tipo, ondeEscolhido: escolha.onde },
  });
}

/** "Para: ..." no detalhe do ativo: reserva, liberdade, uma meta (dela) ou nenhum objetivo. */
export async function trocarObjetivoDoAtivo(ctx: AuthContext, id: string, objetivo: AssetObjective, goalId: string | null) {
  let meta: string | null = null;
  if (objetivo === "META") {
    if (!goalId) return { count: 0 };
    const goal = await prisma.goal.findFirst({ where: { id: goalId, userId: ctx.userId, profileId: ctx.profileId }, select: { id: true } });
    if (!goal) return { count: 0 };
    meta = goal.id;
  }
  return prisma.asset.updateMany({ where: { id, userId: ctx.userId, profileId: ctx.profileId }, data: { objective: objetivo, goalId: meta } });
}
