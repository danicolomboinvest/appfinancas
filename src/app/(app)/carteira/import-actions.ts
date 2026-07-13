"use server";

import { revalidatePath } from "next/cache";
import type { AssetClass } from "@prisma/client";
import { getRequiredSession } from "@/lib/auth/session";
import { createAsset } from "@/lib/repositories/asset.repo";
import { parsePortfolioStatement, guessAssetClass } from "@/lib/import/portfolio-parser";
import { extractUploadText, UploadReadError, type UploadEncoding } from "@/lib/import/extract-text";

const ASSET_CLASS_VALUES: AssetClass[] = ["RENDA_FIXA", "ACAO", "FII", "TESOURO_DIRETO", "FUNDO", "CRIPTO", "OUTRO"];

export type ParsedHoldingItem = {
  key: number;
  ticker: string;
  quantity: number;
  value: number;
  assetClass: AssetClass;
};

export type ParsePortfolioResult =
  | { ok: true; holdings: ParsedHoldingItem[] }
  | { ok: false; error: string };

/** Lê o extrato/nota da corretora ou relatório da B3 (CSV/Excel/PDF) e identifica os ativos.
 * `content` é texto (CSV) ou base64 (Excel/PDF), conforme `encoding`. */
export async function parsePortfolioAction(
  content: string,
  encoding: UploadEncoding = "text",
): Promise<ParsePortfolioResult> {
  await getRequiredSession();

  let text: string;
  try {
    ({ text } = await extractUploadText(content, encoding));
  } catch (err) {
    if (err instanceof UploadReadError) return { ok: false, error: err.message };
    throw err;
  }

  // PDF escaneado/foto não tem texto extraível — avisa e pede Excel.
  const readableChars = text.replace(/[^\p{L}\p{N}]/gu, "").length;
  if (encoding === "pdf" && readableChars < 12) {
    return {
      ok: false,
      error:
        "Não consegui ler este PDF — ele parece ser escaneado ou uma foto. Suba a posição em Excel (.xlsx) ou CSV que aí funciona.",
    };
  }

  const parsed = parsePortfolioStatement(text);
  if (parsed.length === 0) {
    return {
      ok: false,
      error:
        "Não identifiquei ativos nesse arquivo. Se for um PDF escaneado/foto, suba a posição em Excel (.xlsx) ou CSV — costuma ler melhor.",
    };
  }
  const holdings: ParsedHoldingItem[] = parsed.map((h, index) => ({
    key: index,
    ticker: h.ticker,
    quantity: h.quantity,
    value: h.value,
    assetClass: guessAssetClass(h.ticker),
  }));
  return { ok: true, holdings };
}

export type ConfirmedHolding = {
  ticker: string;
  quantity: number;
  value: number;
  assetClass: AssetClass;
};

export type ImportPortfolioResult = { ok: true; created: number } | { ok: false; error: string };

/** Cria os ativos escolhidos na carteira (objetivo OUTRO por padrão; o usuário refina depois). */
export async function importPortfolioAction(holdings: ConfirmedHolding[]): Promise<ImportPortfolioResult> {
  const ctx = await getRequiredSession();
  let created = 0;

  for (const h of holdings) {
    const assetClass = ASSET_CLASS_VALUES.includes(h.assetClass) ? h.assetClass : "OUTRO";
    await createAsset(ctx, {
      name: h.ticker,
      ticker: h.ticker,
      assetClass,
      objective: "OUTRO",
      quantity: h.quantity > 0 ? h.quantity : undefined,
      currentValue: h.value >= 0 ? h.value : 0,
    });
    created += 1;
  }

  revalidatePath("/carteira");
  revalidatePath("/carteira/por-objetivo");
  return { ok: true, created };
}
