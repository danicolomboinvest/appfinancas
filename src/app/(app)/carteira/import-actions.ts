"use server";

import { revalidatePath } from "next/cache";
import type { AssetClass } from "@prisma/client";
import { getRequiredSession } from "@/lib/auth/session";
import { createAsset } from "@/lib/repositories/asset.repo";
import { parsePortfolioStatement, guessAssetClass } from "@/lib/import/portfolio-parser";

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

/** Lê o extrato/nota da corretora ou relatório da B3 e devolve os ativos identificados. */
export async function parsePortfolioAction(content: string): Promise<ParsePortfolioResult> {
  await getRequiredSession();
  const parsed = parsePortfolioStatement(content);
  if (parsed.length === 0) {
    return {
      ok: false,
      error: "Não identificamos ativos nesse arquivo. Suba o extrato de posição da corretora ou o relatório da B3 (CSV).",
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
