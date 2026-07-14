import { prisma } from "@/lib/db/prisma";

/**
 * Apaga TODOS os dados de um usuário e a própria conta, numa única transação, na ordem
 * que respeita as chaves estrangeiras (lançamentos/ativos antes de metas/categorias;
 * usuário por último). Usado pela exclusão de conta (direito LGPD).
 */
export async function deleteUserAndAllData(userId: string): Promise<void> {
  const where = { userId };
  await prisma.$transaction([
    // Dependentes primeiro (referenciam Goal/CustomCategory)…
    prisma.monthlyEntry.deleteMany({ where }),
    prisma.budget.deleteMany({ where }),
    prisma.asset.deleteMany({ where }),
    // …demais dados do usuário…
    prisma.analysisSheet.deleteMany({ where }), // respostas caem em cascata
    prisma.transactionCategoryRule.deleteMany({ where }),
    prisma.passwordResetToken.deleteMany({ where }),
    prisma.patrimonySnapshot.deleteMany({ where }),
    prisma.portfolioStrategy.deleteMany({ where }),
    prisma.simulation.deleteMany({ where }),
    prisma.referenceRate.deleteMany({ where }), // só as do usuário; as globais têm userId nulo
    prisma.yearlyConsolidationCache.deleteMany({ where }),
    prisma.accumulationProjectionCache.deleteMany({ where }),
    prisma.emergencyFund.deleteMany({ where }),
    prisma.planningParams.deleteMany({ where }),
    prisma.advisorClientLink.deleteMany({ where: { OR: [{ advisorId: userId }, { clientId: userId }] } }),
    // …depois os que eram referenciados…
    prisma.goal.deleteMany({ where }),
    prisma.customCategory.deleteMany({ where }),
    // …e por fim a própria conta.
    prisma.user.delete({ where: { id: userId } }),
  ]);
}
