"use server";

import { revalidatePath } from "next/cache";
import type { SheetType } from "@prisma/client";
import { getRequiredSession } from "@/lib/auth/session";
import { getOwnSheetWithResponses, saveLaudo, saveSingleResponse } from "@/lib/repositories/analysis.repo";
import { buildLaudo, diffLaudo, isLaudo, type Laudo, type LaudoChange } from "@/lib/analysis/laudo";
import { CHECKLIST_ANSWERS } from "@/lib/analysis/checklist";
import { scrapeIndicators } from "@/lib/analysis/ler-indicadores";

const BASE_PATH_BY_SHEET_TYPE: Record<SheetType, string> = {
  STOCK: "/fichas/acoes",
  FII: "/fichas/fiis",
  STOCK_INTL: "/fichas/stocks",
  ETF: "/fichas/etfs",
};

export type ReadLaudoResult =
  | { ok: true; laudo: Laudo; changes: LaudoChange[] }
  | { ok: false; error: string };

/**
 * Lê o ativo agora: raspa, monta o laudo, compara com a leitura anterior e guarda o snapshot.
 * É a mesma ação na primeira abertura e no "Reanalisar agora" — a diferença é só ter ou não
 * um "antes" pra dizer o que mudou.
 */
export async function readLaudoAction(sheetId: string): Promise<ReadLaudoResult> {
  const ctx = await getRequiredSession();
  const sheet = await getOwnSheetWithResponses(ctx, sheetId);
  if (!sheet) return { ok: false, error: "Ficha não encontrada." };

  const indicators = await scrapeIndicators(sheet.sheetType, sheet.ticker);
  if (Object.keys(indicators).length === 0) {
    return {
      ok: false,
      error: `Não consegui ler ${sheet.ticker.toUpperCase()} agora. Confira o código ou tente de novo em instantes.`,
    };
  }

  const laudo = buildLaudo(sheet.sheetType, indicators);
  const previous = isLaudo(sheet.laudo) ? sheet.laudo : null;
  const changes = diffLaudo(previous, laudo);

  // O JSON do laudo é só dados serializáveis (strings, números, arrays); o cast é pro tipo do Prisma.
  await saveLaudo(ctx, sheetId, JSON.parse(JSON.stringify(laudo)), laudo.autoScore);
  revalidatePath(BASE_PATH_BY_SHEET_TYPE[sheet.sheetType]);
  revalidatePath(`${BASE_PATH_BY_SHEET_TYPE[sheet.sheetType]}/${sheetId}`);

  return { ok: true, laudo, changes };
}

/** Um toque do checklist: salva na hora, sem botão Salvar. Só aceita as três respostas conhecidas ou limpar. */
export async function answerChecklistAction(sheetId: string, criterionId: string, value: string | null) {
  if (value !== null && !CHECKLIST_ANSWERS.some((a) => a.value === value)) {
    throw new Error("Resposta inválida.");
  }
  const ctx = await getRequiredSession();
  await saveSingleResponse(ctx, sheetId, criterionId, value);
}
