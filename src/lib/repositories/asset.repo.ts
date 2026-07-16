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
  /** Quanto foi investido — a atualização de cotações nunca altera este campo. */
  investedValue?: number;
  /** Indexador da renda fixa (pós/IPCA/prefixado) — refina o mapeamento pra Estratégia. */
  fixedIncomeIndex?: FixedIncomeIndex;
  currentValue: number;
  idealAllocationPercent?: number;
  acquisitionDate?: Date;
  notes?: string;
};

export async function listAssets(ctx: AuthContext) {
  return prisma.asset.findMany({ where: { userId: ctx.userId }, orderBy: { createdAt: "desc" } });
}

/** goalId só é aceito se apontar para uma meta do próprio usuário — evita associar a ativo de outro. */
async function resolveOwnGoalId(ctx: AuthContext, input: AssetInput): Promise<string | null> {
  if (input.objective !== "META" || !input.goalId) return null;
  const goal = await prisma.goal.findFirst({ where: { id: input.goalId, userId: ctx.userId }, select: { id: true } });
  return goal?.id ?? null;
}

export async function createAsset(ctx: AuthContext, input: AssetInput) {
  const goalId = await resolveOwnGoalId(ctx, input);
  return prisma.asset.create({ data: { ...input, goalId, userId: ctx.userId } });
}

export async function updateOwnAsset(ctx: AuthContext, id: string, input: AssetInput) {
  const goalId = await resolveOwnGoalId(ctx, input);
  return prisma.asset.updateMany({ where: { id, userId: ctx.userId }, data: { ...input, goalId } });
}

export async function deleteOwnAsset(ctx: AuthContext, id: string) {
  return prisma.asset.deleteMany({ where: { id, userId: ctx.userId } });
}
