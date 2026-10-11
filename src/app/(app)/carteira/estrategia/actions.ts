"use server";

import { revalidatePath } from "next/cache";
import type { StrategyAssetClass } from "@prisma/client";
import { getRequiredSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { savePortfolioStrategy } from "@/lib/repositories/portfolio-strategy.repo";
import { STRATEGY_ASSET_CLASSES } from "@/lib/portfolio/strategy";

const PERFIS = ["conservador", "moderado", "arrojado", "personalizado"];

/**
 * Salva a estratégia (percentuais inteiros por classe, somando 100) e o perfil de investidora
 * ("personalizado" quando ela mexeu nos números). Recusa o que não soma 100.
 */
export async function salvarEstrategiaAction(valores: Record<string, number>, perfil: string): Promise<{ ok: boolean; erro?: string }> {
  const linhas = STRATEGY_ASSET_CLASSES.map((assetClass) => ({ assetClass, pct: Math.round(Number(valores[assetClass] ?? 0)) }));
  if (linhas.some((l) => !Number.isFinite(l.pct) || l.pct < 0 || l.pct > 100)) return { ok: false, erro: "Algum número ficou fora de 0 a 100." };
  const soma = linhas.reduce((s, l) => s + l.pct, 0);
  if (soma !== 100) return { ok: false, erro: soma > 100 ? `Passou ${soma - 100} pontos.` : `Faltam ${100 - soma} pontos.` };
  if (!PERFIS.includes(perfil)) return { ok: false, erro: "Perfil inválido." };
  const ctx = await getRequiredSession();
  await savePortfolioStrategy(ctx, linhas.map((l) => ({ assetClass: l.assetClass as StrategyAssetClass, targetPercent: l.pct / 100 })));
  await prisma.financialProfile.updateMany({ where: { id: ctx.profileId, userId: ctx.userId }, data: { perfilInvestidor: perfil } });
  revalidatePath("/carteira");
  revalidatePath("/carteira/estrategia");
  return { ok: true };
}

/**
 * "Tenho mais" na reserva (rodada 22): ela diz quanto tem guardado de reserva. Grava no mesmo
 * campo da tela da reserva (EmergencyFund.currentAmount). Sem reserva montada, não grava nada.
 */
export async function confirmarReservaAction(valor: number): Promise<{ ok: boolean }> {
  if (!Number.isFinite(valor) || valor < 0 || valor > 1e11) return { ok: false };
  const ctx = await getRequiredSession();
  const r = await prisma.emergencyFund.updateMany({ where: { userId: ctx.userId, profileId: ctx.profileId }, data: { currentAmount: Math.round(valor * 100) / 100 } });
  revalidatePath("/carteira/estrategia");
  revalidatePath("/planejamento/reserva-emergencia");
  return { ok: r.count > 0 };
}
