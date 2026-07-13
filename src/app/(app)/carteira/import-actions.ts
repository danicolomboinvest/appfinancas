"use server";

import { revalidatePath } from "next/cache";
import type { AssetClass } from "@prisma/client";
import { getRequiredSession } from "@/lib/auth/session";
import { createAsset } from "@/lib/repositories/asset.repo";
import { parsePortfolioStatement, guessAssetClass } from "@/lib/import/portfolio-parser";
import { extractUploadFromForm, UploadReadError } from "@/lib/import/extract-text";

const ASSET_CLASS_VALUES: AssetClass[] = ["RENDA_FIXA", "ACAO", "FII", "TESOURO_DIRETO", "FUNDO", "CRIPTO", "OUTRO"];

export type ParsedHoldingItem = {
  key: number;
  ticker: string;
  quantity: number;
  value: number;
  /** Quanto foi investido (do extrato, quando informado) — base do lucro/prejuízo. */
  investedValue: number | null;
  assetClass: AssetClass;
};

export type ParsePortfolioResult =
  | { ok: true; holdings: ParsedHoldingItem[] }
  | { ok: false; error: string };

/** Lê o extrato/nota da corretora ou relatório da B3 (CSV/Excel/PDF) e identifica os ativos.
 * O arquivo vem CRU num FormData ({ file, encoding }) — string grande como argumento de
 * action estoura o limite de serialização do React (~1M chars). */
export async function parsePortfolioAction(formData: FormData): Promise<ParsePortfolioResult> {
  await getRequiredSession();
  const encoding = String(formData.get("encoding") ?? "text");

  let text: string;
  try {
    ({ text } = await extractUploadFromForm(formData));
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
    investedValue: h.investedValue ?? null,
    // Extratos em seções (BTG etc.) já dizem a classe (Renda Fixa, Tesouro, Fundo, FII);
    // senão, inferimos pela terminação do ticker.
    assetClass: h.assetClass ?? guessAssetClass(h.ticker),
  }));
  return { ok: true, holdings };
}

export type ConfirmedHolding = {
  ticker: string;
  quantity: number;
  value: number;
  investedValue: number | null;
  assetClass: AssetClass;
};

export type ImportPortfolioResult = { ok: true; created: number; skipped: number } | { ok: false; error: string };

/** Cria os ativos escolhidos na carteira (objetivo OUTRO por padrão; o usuário refina depois).
 * Ativos que já existem (mesmo ticker/nome) são pulados — importar o mesmo extrato duas
 * vezes não duplica a carteira. */
export async function importPortfolioAction(holdings: ConfirmedHolding[]): Promise<ImportPortfolioResult> {
  const ctx = await getRequiredSession();
  let created = 0;
  let skipped = 0;

  const { prisma } = await import("@/lib/db/prisma");
  const existing = await prisma.asset.findMany({
    where: { userId: ctx.userId },
    select: { name: true, ticker: true },
  });
  const existingKeys = new Set(existing.flatMap((a) => [a.ticker?.toUpperCase(), a.name.toUpperCase()].filter(Boolean)));

  for (const h of holdings) {
    if (existingKeys.has(h.ticker.toUpperCase())) {
      skipped += 1;
      continue;
    }
    existingKeys.add(h.ticker.toUpperCase()); // evita duplicata dentro do próprio arquivo
    const assetClass = ASSET_CLASS_VALUES.includes(h.assetClass) ? h.assetClass : "OUTRO";
    await createAsset(ctx, {
      name: h.ticker,
      ticker: h.ticker,
      assetClass,
      objective: "OUTRO",
      quantity: h.quantity > 0 ? h.quantity : undefined,
      // Sem preço médio no extrato, o investido começa igual ao valor atual (lucro zera hoje).
      investedValue: h.investedValue ?? (h.value >= 0 ? h.value : 0),
      currentValue: h.value >= 0 ? h.value : 0,
    });
    created += 1;
  }

  revalidatePath("/carteira");
  revalidatePath("/carteira/por-objetivo");
  return { ok: true, created, skipped };
}
