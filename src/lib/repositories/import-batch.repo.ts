import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";

/**
 * Lotes de importação (histórico do que foi subido em massa via extrato/fatura). Cada upload
 * vira um lote; os lançamentos criados apontam pra ele. Isso permite listar "o que subi e
 * quando" e desfazer um upload inteiro (arquivo errado/duplicado) sem caçar lançamento por
 * lançamento.
 */

export type ImportBatchSummary = {
  id: string;
  docType: string;
  fileName: string | null;
  createdAt: Date;
  entryCount: number;
  totalAmount: number;
  /** Meses (ano/mês) onde os lançamentos deste lote caíram, ex.: ["2026/7"]. */
  months: string[];
};

export async function createImportBatch(ctx: AuthContext, input: { docType: string; fileName?: string }) {
  return prisma.importBatch.create({
    data: { userId: ctx.userId, profileId: ctx.profileId, docType: input.docType, fileName: input.fileName ?? null },
  });
}

/** Lote que terminou sem criar nada (tudo era duplicata) não vale histórico, é removido. */
export async function deleteEmptyImportBatch(ctx: AuthContext, id: string) {
  await prisma.importBatch.deleteMany({ where: { id, userId: ctx.userId, profileId: ctx.profileId, entries: { none: {} } } });
}

export async function listImportBatches(ctx: AuthContext, limit = 20): Promise<ImportBatchSummary[]> {
  const batches = await prisma.importBatch.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { entries: { select: { amount: true, year: true, month: true } } },
  });
  return batches.map((b) => {
    const months = [...new Set(b.entries.map((e) => `${e.year}/${e.month}`))].sort();
    return {
      id: b.id,
      docType: b.docType,
      fileName: b.fileName,
      createdAt: b.createdAt,
      entryCount: b.entries.length,
      totalAmount: b.entries.reduce((sum, e) => sum + Number(e.amount), 0),
      months,
    };
  });
}

/**
 * Desfaz um lote: apaga TODOS os lançamentos criados por ele e o próprio registro, numa
 * transação (ou tudo, ou nada). O filtro por userId nos dois deletes garante que ninguém
 * apaga lote dos outros. Devolve quantos lançamentos saíram.
 */
export async function deleteImportBatchWithEntries(ctx: AuthContext, id: string): Promise<number> {
  const [entries] = await prisma.$transaction([
    prisma.monthlyEntry.deleteMany({ where: { importBatchId: id, userId: ctx.userId, profileId: ctx.profileId } }),
    prisma.importBatch.deleteMany({ where: { id, userId: ctx.userId, profileId: ctx.profileId } }),
  ]);
  return entries.count;
}
