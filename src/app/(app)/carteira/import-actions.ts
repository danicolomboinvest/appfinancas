"use server";

import { revalidatePath } from "next/cache";
import type { AssetClass, FixedIncomeIndex } from "@prisma/client";
import { getRequiredSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { createAsset } from "@/lib/repositories/asset.repo";
import { parsePortfolioStatement, guessAssetClass } from "@/lib/import/portfolio-parser";
import { extractUploadFromForm, UploadReadError, PasswordRequiredError } from "@/lib/import/extract-text";

const ASSET_CLASS_VALUES: AssetClass[] = ["RENDA_FIXA", "ACAO", "FII", "TESOURO_DIRETO", "FUNDO", "CRIPTO", "OUTRO"];

/** Situação de cada ativo do extrato em relação à carteira atual:
 * novo (não existe), atualizado (quantidade/valor mudou) ou igual (nada a fazer). */
export type HoldingStatus = "new" | "changed" | "unchanged";

export type ParsedHoldingItem = {
  key: number;
  ticker: string;
  quantity: number;
  value: number;
  /** Quanto foi investido (do extrato, quando informado), base do lucro/prejuízo. */
  investedValue: number | null;
  assetClass: AssetClass;
  /** Indexador da renda fixa detectado no extrato (pós/IPCA/prefixado), ou null. */
  fixedIncomeIndex: FixedIncomeIndex | null;
  status: HoldingStatus;
  /** Valores atuais na carteira (para mostrar o "antes → depois" na revisão). */
  prevQuantity: number | null;
  prevValue: number | null;
};

export type ParsePortfolioResult =
  | { ok: true; holdings: ParsedHoldingItem[] }
  | { ok: false; error: string; needsPassword?: boolean };

/** Lê o extrato/nota da corretora ou relatório da B3 (CSV/Excel/PDF), identifica os ativos e
 * COMPARA com a carteira atual, quem reimporta o extrato vê só o que mudou.
 * O arquivo vem CRU num FormData ({ file, encoding }), string grande como argumento de
 * action estoura o limite de serialização do React (~1M chars). */
export async function parsePortfolioAction(formData: FormData): Promise<ParsePortfolioResult> {
  const ctx = await getRequiredSession();
  const encoding = String(formData.get("encoding") ?? "text");

  let text: string;
  try {
    ({ text } = await extractUploadFromForm(formData));
  } catch (err) {
    if (err instanceof PasswordRequiredError) return { ok: false, error: err.message, needsPassword: true };
    if (err instanceof UploadReadError) return { ok: false, error: err.message };
    throw err;
  }

  // PDF escaneado/foto não tem texto extraível, avisa e pede Excel.
  const readableChars = text.replace(/[^\p{L}\p{N}]/gu, "").length;
  if (encoding === "pdf" && readableChars < 12) {
    return {
      ok: false,
      error:
        "Não consegui ler este PDF, ele parece ser escaneado ou uma foto. Suba a posição em Excel (.xlsx) ou CSV que aí funciona.",
    };
  }

  const parsed = parsePortfolioStatement(text);
  if (parsed.length === 0) {
    return {
      ok: false,
      error:
        "Não identifiquei ativos nesse arquivo. Se for um PDF escaneado/foto, suba a posição em Excel (.xlsx) ou CSV, costuma ler melhor.",
    };
  }

  // Carteira atual indexada por ticker E por nome, imports antigos usam o ticker como nome.
  const existing = await prisma.asset.findMany({
    where: { userId: ctx.userId },
    select: { name: true, ticker: true, quantity: true, currentValue: true },
  });
  const byKey = new Map<string, (typeof existing)[number]>();
  for (const a of existing) {
    if (a.ticker) byKey.set(a.ticker.toUpperCase(), a);
    byKey.set(a.name.toUpperCase(), a);
  }

  const holdings: ParsedHoldingItem[] = parsed.map((h, index) => {
    const match = byKey.get(h.ticker.toUpperCase());
    let status: HoldingStatus = "new";
    let prevQuantity: number | null = null;
    let prevValue: number | null = null;
    if (match) {
      prevQuantity = match.quantity !== null ? Number(match.quantity) : null;
      prevValue = Number(match.currentValue);
      // Mudança de verdade: quantidade diferente (compra/venda) ou valor >1% distante
      // (rendimento acumulado). Oscilação diária de preço não vira ruído na revisão.
      const qtyChanged = h.quantity > 0 && prevQuantity !== null && Math.abs(h.quantity - prevQuantity) > 1e-6;
      const valueChanged =
        h.value > 0 && (prevValue > 0 ? Math.abs(h.value - prevValue) / prevValue > 0.01 : true);
      status = qtyChanged || valueChanged ? "changed" : "unchanged";
    }
    return {
      key: index,
      ticker: h.ticker,
      quantity: h.quantity,
      value: h.value,
      investedValue: h.investedValue ?? null,
      // Extratos em seções (BTG etc.) já dizem a classe (Renda Fixa, Tesouro, Fundo, FII);
      // senão, inferimos pela terminação do ticker.
      assetClass: h.assetClass ?? guessAssetClass(h.ticker),
      fixedIncomeIndex: h.fixedIncomeIndex ?? null,
      status,
      prevQuantity,
      prevValue,
    };
  });
  return { ok: true, holdings };
}

export type ConfirmedHolding = {
  ticker: string;
  quantity: number;
  value: number;
  investedValue: number | null;
  assetClass: AssetClass;
  fixedIncomeIndex: FixedIncomeIndex | null;
  /** create = ativo novo; update = já existe, atualiza quantidade/valores. */
  mode: "create" | "update";
};

export type ImportPortfolioResult =
  | { ok: true; created: number; updated: number }
  | { ok: false; error: string };

/** Aplica o extrato na carteira: cria os novos e atualiza os que mudaram (quantidade, valor
 * atual e, quando o extrato traz preço médio, o valor investido). Ativos sem mudança nem
 * chegam aqui. Objetivo padrão OUTRO nos novos; o usuário refina depois. */
export async function importPortfolioAction(holdings: ConfirmedHolding[]): Promise<ImportPortfolioResult> {
  const ctx = await getRequiredSession();
  let created = 0;
  let updated = 0;

  // Proteção contra duplicar em cliques repetidos/reenvio: create de quem já existe vira skip.
  const existing = await prisma.asset.findMany({
    where: { userId: ctx.userId },
    select: { name: true, ticker: true },
  });
  const existingKeys = new Set(existing.flatMap((a) => [a.ticker?.toUpperCase(), a.name.toUpperCase()].filter(Boolean)));

  for (const h of holdings) {
    const key = h.ticker.toUpperCase();
    if (h.mode === "update" || existingKeys.has(key)) {
      const result = await prisma.asset.updateMany({
        where: { userId: ctx.userId, OR: [{ ticker: h.ticker }, { name: h.ticker }] },
        data: {
          ...(h.quantity > 0 ? { quantity: h.quantity } : {}),
          ...(h.value >= 0 ? { currentValue: h.value } : {}),
          // Preço médio do extrato mantém o investido fiel após novos aportes; sem ele, não mexe.
          ...(h.investedValue !== null ? { investedValue: h.investedValue } : {}),
          ...(h.fixedIncomeIndex !== null ? { fixedIncomeIndex: h.fixedIncomeIndex } : {}),
        },
      });
      if (result.count > 0) updated += 1;
      continue;
    }

    existingKeys.add(key); // evita duplicata dentro do próprio arquivo
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
      fixedIncomeIndex: h.fixedIncomeIndex ?? undefined,
    });
    created += 1;
  }

  revalidatePath("/carteira");
  revalidatePath("/carteira/por-objetivo");
  return { ok: true, created, updated };
}
