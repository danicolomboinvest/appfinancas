"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { extractUploadFromForm, UploadReadError } from "@/lib/import/extract-text";
import { parseIrpfBensEDireitos, type IrpfAssetKind } from "@/lib/import/irpf-parser";

/** Um ativo lido da declaração, já cruzado com a carteira atual. */
export type IrpfPreviewItem = {
  key: number;
  /** Nome legível vindo da declaração. */
  irName: string;
  irTicker: string | null;
  kind: IrpfAssetKind;
  averagePrice: number;
  irQuantity: number | null;
  /** Ativo da carteira casado automaticamente (só quando há UMA correspondência clara). */
  matchedAssetId: string | null;
  matchedAssetName: string | null;
  /** Investido atual e o novo (preço médio × quantidade), o "antes → depois" da revisão. */
  currentInvested: number | null;
  newInvested: number | null;
};

/** Lista de ativos da carteira, pro usuário casar manualmente o que não casou sozinho. */
export type WalletAssetOption = { id: string; label: string; quantity: number | null };

export type ParseIrpfResult =
  | { ok: true; items: IrpfPreviewItem[]; walletAssets: WalletAssetOption[] }
  | { ok: false; error: string };

/** Só letras/números maiúsculos, pra casar "MXRF11", "mxrf 11", "Fii MXRF11" etc. */
function norm(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Primeira palavra "de peso" do nome (>=4 letras), usada pra casar por nome quando falta ticker. */
function nameKeyword(name: string): string | null {
  const word = name
    .toUpperCase()
    .split(/[^A-ZÀ-Ÿ]+/)
    .find((w) => w.length >= 4 && !["AVENUE", "FII", "FUNDO", "ACOES", "AÇÕES"].includes(w));
  return word ? norm(word) : null;
}

/**
 * Lê a "Declaração de Bens e Direitos" (PDF do recibo do IRPF), extrai o preço médio de cada
 * ação/FII/ETF e casa com a carteira atual do usuário, devolvendo o "antes → depois" do valor
 * investido pra revisão antes de aplicar. Casa automaticamente só quando há UMA correspondência
 * clara (por ticker ou por nome); o resto o usuário resolve na tela.
 */
export async function parseIrpfAction(formData: FormData): Promise<ParseIrpfResult> {
  const ctx = await getRequiredSession();

  let text: string;
  try {
    ({ text } = await extractUploadFromForm(formData));
  } catch (err) {
    if (err instanceof UploadReadError) return { ok: false, error: err.message };
    throw err;
  }

  const readableChars = text.replace(/[^\p{L}\p{N}]/gu, "").length;
  if (readableChars < 12) {
    return {
      ok: false,
      error:
        "Não consegui ler este PDF, ele parece escaneado ou uma foto. Baixe o recibo da declaração pelo programa da Receita (é um PDF de texto) e envie esse.",
    };
  }

  const parsed = parseIrpfBensEDireitos(text).filter((a) => a.averagePrice !== null);
  if (parsed.length === 0) {
    return {
      ok: false,
      error:
        "Não encontrei ações nem FIIs com preço médio nesta declaração. Confira se é o PDF da declaração completa (com a seção Bens e Direitos).",
    };
  }

  const assets = await prisma.asset.findMany({
    where: { userId: ctx.userId },
    select: { id: true, name: true, ticker: true, quantity: true, investedValue: true },
  });

  const items: IrpfPreviewItem[] = parsed.map((a, index) => {
    // Candidatos: por ticker (igual ou um prefixo do outro) ou por palavra-chave do nome.
    let candidates: typeof assets = [];
    if (a.ticker) {
      const t = norm(a.ticker);
      candidates = assets.filter((asset) => {
        const at = asset.ticker ? norm(asset.ticker) : "";
        const an = norm(asset.name);
        return at === t || an === t || (at !== "" && (at.startsWith(t) || t.startsWith(at)));
      });
    }
    if (candidates.length === 0) {
      const kw = nameKeyword(a.name);
      if (kw) {
        candidates = assets.filter((asset) => norm(asset.name).includes(kw) || (asset.ticker ? norm(asset.ticker).includes(kw) : false));
      }
    }

    // Casa automático só quando há UM candidato (evita gravar preço médio no ativo errado).
    const match = candidates.length === 1 ? candidates[0] : null;
    const appQty = match?.quantity != null ? Number(match.quantity) : null;
    const qtyForCost = appQty ?? a.quantity;
    const newInvested = qtyForCost && qtyForCost > 0 ? (a.averagePrice as number) * qtyForCost : null;

    return {
      key: index,
      irName: a.name,
      irTicker: a.ticker,
      kind: a.kind,
      averagePrice: a.averagePrice as number,
      irQuantity: a.quantity,
      matchedAssetId: match?.id ?? null,
      matchedAssetName: match?.name ?? null,
      currentInvested: match?.investedValue != null ? Number(match.investedValue) : null,
      newInvested,
    };
  });

  const walletAssets: WalletAssetOption[] = assets.map((asset) => ({
    id: asset.id,
    label: asset.ticker && asset.ticker !== asset.name ? `${asset.name} (${asset.ticker})` : asset.name,
    quantity: asset.quantity != null ? Number(asset.quantity) : null,
  }));

  return { ok: true, items, walletAssets };
}

/** Um preço médio confirmado pelo usuário, apontando pra um ativo da carteira. */
export type ConfirmedAveragePrice = { assetId: string; averagePrice: number; irQuantity: number | null };

export type ApplyIrpfResult = { ok: true; updated: number } | { ok: false; error: string };

/**
 * Grava o preço médio confirmado como valor investido dos ativos escolhidos. O investido é
 * preço médio × quantidade ATUAL da carteira (mais fiel ao que a pessoa tem hoje); se o ativo
 * não tem quantidade cadastrada, cai na quantidade da declaração. A cotação/valor atual não é
 * tocada, só o investido, que é a base do lucro/prejuízo.
 */
export async function applyIrpfAction(confirmed: ConfirmedAveragePrice[]): Promise<ApplyIrpfResult> {
  const ctx = await getRequiredSession();
  if (confirmed.length === 0) return { ok: false, error: "Nenhum ativo selecionado." };

  const ids = confirmed.map((c) => c.assetId);
  const owned = await prisma.asset.findMany({
    where: { userId: ctx.userId, id: { in: ids } },
    select: { id: true, quantity: true },
  });
  const qtyById = new Map(owned.map((a) => [a.id, a.quantity != null ? Number(a.quantity) : null]));

  let updated = 0;
  for (const c of confirmed) {
    if (!qtyById.has(c.assetId)) continue; // não é um ativo do usuário, ignora
    if (!(c.averagePrice > 0)) continue;
    const qty = qtyById.get(c.assetId) ?? c.irQuantity;
    if (!qty || qty <= 0) continue;
    const invested = Number((c.averagePrice * qty).toFixed(2));
    const result = await prisma.asset.updateMany({
      where: { id: c.assetId, userId: ctx.userId },
      data: { investedValue: invested },
    });
    updated += result.count;
  }

  revalidatePath("/carteira");
  revalidatePath("/carteira/por-objetivo");
  return { ok: true, updated };
}
