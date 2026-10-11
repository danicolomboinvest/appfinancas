"use server";

import type { SheetType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { createSheet, saveLaudo } from "@/lib/repositories/analysis.repo";
import { refreshDividendsForTicker } from "@/lib/repositories/dividend.repo";
import { buildLaudo } from "@/lib/analysis/laudo";
import { scrapeIndicators } from "@/lib/analysis/ler-indicadores";
import { fichasPorTicker } from "@/lib/analysis/analises-dados";
import { tiposParaTentar, tickerValido } from "@/lib/analysis/tipo-do-ticker";

export type LerAtivoResultado = { ok: true; tipo: SheetType } | { ok: false; erro: string };

/**
 * Lê um ativo agora (Análises da versão nova): raspa os indicadores, monta o laudo e guarda na
 * ficha do ticker (cria a ficha se a pessoa ainda não tinha). É o que a tela chama, um por vez,
 * para os ativos da carteira sem leitura, e ao abrir um ticker achado pela busca.
 *
 * Para FII e ação, traz junto o histórico de proventos do ticker se o app ainda não tem
 * (a renda constante e os dividendos por ano saem dele).
 */
export async function lerAtivoAction(tickerBruto: string, tipoSugerido?: SheetType | null): Promise<LerAtivoResultado> {
  const ticker = tickerBruto.trim().toUpperCase();
  if (!tickerValido(ticker)) return { ok: false, erro: "Código inválido." };
  const ctx = await getRequiredSession();

  const existente = (await fichasPorTicker(ctx, [ticker])).get(ticker);
  const tipos = existente ? [existente.sheetType] : tiposParaTentar(ticker, tipoSugerido ?? null);

  for (const tipo of tipos) {
    const indicadores = await scrapeIndicators(tipo, ticker);
    if (Object.keys(indicadores).length === 0) continue;
    const laudo = buildLaudo(tipo, indicadores);
    let id = existente?.id;
    if (!id) {
      const ativo = await prisma.asset.findFirst({ where: { userId: ctx.userId, profileId: ctx.profileId, ticker: { equals: ticker, mode: "insensitive" } }, select: { name: true } });
      const nome = ativo?.name && ativo.name.toUpperCase() !== ticker ? ativo.name : undefined;
      id = (await createSheet(ctx, { sheetType: tipo, ticker, companyName: nome })).id;
    }
    await saveLaudo(ctx, id, JSON.parse(JSON.stringify(laudo)), laudo.autoScore);
    if (tipo === "FII" || tipo === "STOCK") {
      const tem = await prisma.dividendEvent.count({ where: { ticker } });
      if (tem === 0) await refreshDividendsForTicker(ticker);
    }
    revalidatePath("/fichas");
    return { ok: true, tipo };
  }
  return { ok: false, erro: `Não consegui ler ${ticker} agora.` };
}
