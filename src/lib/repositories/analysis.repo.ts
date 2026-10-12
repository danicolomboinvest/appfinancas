import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import type { CreateAnalysisSheetInput } from "@/lib/validations/analysis-sheet.schema";

export async function createSheet(ctx: AuthContext, input: CreateAnalysisSheetInput) {
  return prisma.analysisSheet.create({ data: { ...input, userId: ctx.userId, profileId: ctx.profileId } });
}

/**
 * Guarda o laudo automático como snapshot na própria ficha. É o que faz a ficha abrir na hora
 * na próxima visita e o que dá ao "Reanalisar" um "antes" pra comparar.
 */
export async function saveLaudo(ctx: AuthContext, sheetId: string, laudo: Prisma.InputJsonValue, autoScore: number | null) {
  return prisma.analysisSheet.updateMany({
    where: { id: sheetId, userId: ctx.userId, profileId: ctx.profileId },
    data: { laudo, autoScore, laudoReadAt: new Date() },
  });
}
