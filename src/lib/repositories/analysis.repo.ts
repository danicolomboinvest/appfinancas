import type { SheetType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import type { CreateAnalysisSheetInput, SaveAnalysisResponsesInput } from "@/lib/validations/analysis-sheet.schema";

export async function listCriteria(sheetType: SheetType, categories?: string[]) {
  return prisma.analysisCriterionDefinition.findMany({
    where: { sheetType, active: true, ...(categories ? { category: { in: categories } } : {}) },
    orderBy: { order: "asc" },
  });
}

export async function listSheets(ctx: AuthContext, sheetType: SheetType) {
  return prisma.analysisSheet.findMany({
    where: { userId: ctx.userId, sheetType },
    orderBy: { analysisDate: "desc" },
  });
}

export async function getOwnSheetWithResponses(ctx: AuthContext, id: string) {
  return prisma.analysisSheet.findFirst({
    where: { id, userId: ctx.userId },
    include: { responses: true },
  });
}

export async function createSheet(ctx: AuthContext, input: CreateAnalysisSheetInput) {
  return prisma.analysisSheet.create({ data: { ...input, userId: ctx.userId } });
}

export async function deleteOwnSheet(ctx: AuthContext, id: string) {
  return prisma.analysisSheet.deleteMany({ where: { id, userId: ctx.userId } });
}

/** Salva as respostas da ficha e recalcula a nota geral (média das notas informadas). */
export async function saveResponses(ctx: AuthContext, input: SaveAnalysisResponsesInput) {
  const sheet = await prisma.analysisSheet.findFirst({ where: { id: input.sheetId, userId: ctx.userId } });
  if (!sheet) {
    throw new Error("Ficha não encontrada.");
  }

  await prisma.$transaction(
    input.responses.map((response) =>
      prisma.analysisResponse.upsert({
        where: { sheetId_criterionId: { sheetId: input.sheetId, criterionId: response.criterionId } },
        update: { value: response.value, score: response.score, note: response.note },
        create: {
          sheetId: input.sheetId,
          criterionId: response.criterionId,
          value: response.value,
          score: response.score,
          note: response.note,
        },
      }),
    ),
  );

  const scores = input.responses.map((r) => r.score).filter((score): score is number => score !== undefined);
  const totalScore = scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;

  return prisma.analysisSheet.update({
    where: { id: input.sheetId },
    data: { conclusion: input.conclusion, totalScore },
  });
}
