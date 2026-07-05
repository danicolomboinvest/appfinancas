import type { StrategyAssetClass } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";

export async function listPortfolioStrategy(ctx: AuthContext) {
  return prisma.portfolioStrategy.findMany({ where: { userId: ctx.userId } });
}

/** Substitui a estratégia inteira do usuário pelo novo conjunto de percentuais-alvo. */
export async function savePortfolioStrategy(
  ctx: AuthContext,
  targets: { assetClass: StrategyAssetClass; targetPercent: number }[],
) {
  await prisma.$transaction(
    targets.map((t) =>
      prisma.portfolioStrategy.upsert({
        where: { userId_assetClass: { userId: ctx.userId, assetClass: t.assetClass } },
        create: { userId: ctx.userId, assetClass: t.assetClass, targetPercent: t.targetPercent },
        update: { targetPercent: t.targetPercent },
      }),
    ),
  );
}
