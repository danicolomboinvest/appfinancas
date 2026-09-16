"use server";

import { revalidatePath } from "next/cache";
import type { SheetType } from "@prisma/client";
import { getRequiredSession } from "@/lib/auth/session";
import { getOwnSheetWithResponses, saveLaudo, saveSingleResponse } from "@/lib/repositories/analysis.repo";
import { buildLaudo, diffLaudo, isLaudo, type Laudo, type LaudoChange } from "@/lib/analysis/laudo";
import { fetchStockIndicators } from "@/lib/analysis/stock-scraper";
import { fetchAnalisedeacoesIndicators } from "@/lib/analysis/analisedeacoes-scraper";
import { fetchInternationalStockIndicators } from "@/lib/analysis/international-stock-scraper";
import { fetchFiiIndicators } from "@/lib/analysis/fii-scraper";
import { fetchEtfIndicators } from "@/lib/analysis/etf-scraper";
import { CHECKLIST_ANSWERS } from "@/lib/analysis/checklist";

const BASE_PATH_BY_SHEET_TYPE: Record<SheetType, string> = {
  STOCK: "/fichas/acoes",
  FII: "/fichas/fiis",
  STOCK_INTL: "/fichas/stocks",
  ETF: "/fichas/etfs",
};

/**
 * Todos os indicadores que dá pra raspar do ticker, por tipo. Pra ação brasileira, duas fontes
 * se completam (o que a primeira não traz, a segunda cobre); se a segunda falhar, segue só com
 * a primeira. Nunca derruba por uma fonte fora do ar.
 */
async function scrapeIndicators(sheetType: SheetType, ticker: string): Promise<Record<string, string>> {
  const merged: Record<string, string> = {};
  const absorb = (rows: { key: string; value: string }[]) => {
    for (const r of rows) if (!(r.key in merged)) merged[r.key] = r.value;
  };
  const tenta = async (fn: () => Promise<{ key: string; value: string }[]>) => {
    try {
      absorb(await fn());
    } catch {
      /* fonte indisponível agora: as outras seguem */
    }
  };

  if (sheetType === "STOCK") {
    await tenta(async () => Object.entries(await fetchAnalisedeacoesIndicators(ticker)).map(([key, value]) => ({ key, value })));
    await tenta(() => fetchStockIndicators(ticker));
  } else if (sheetType === "STOCK_INTL") {
    await tenta(() => fetchInternationalStockIndicators(ticker));
  } else if (sheetType === "FII") {
    await tenta(() => fetchFiiIndicators(ticker));
  } else {
    await tenta(() => fetchEtfIndicators(ticker));
  }
  return merged;
}

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
