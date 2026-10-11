"use server";

import { revalidatePath } from "next/cache";
import type { AssetObjective } from "@prisma/client";
import { getRequiredSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { trocarClassificacaoDoAtivo, trocarObjetivoDoAtivo } from "@/lib/repositories/asset.repo";
import { ehOnde, ehTipo } from "@/lib/portfolio/classificacao";
import { estadoDaAssessoria, proximoEstado } from "@/lib/assessoria/estado";

function revalidarCarteira() {
  revalidatePath("/carteira");
  revalidatePath("/carteira/estrategia");
  revalidatePath("/carteira/proventos");
  revalidatePath("/carteira/oportunidades");
}

/**
 * "Trocar" a classificação de um ativo (tipo e Brasil/Exterior). Nulo nos dois = voltar ao
 * automático. Valor que não é da lista é recusado (não vira texto solto no banco).
 */
export async function trocarClassificacaoAction(assetId: string, tipo: string | null, onde: string | null): Promise<{ ok: boolean }> {
  if ((tipo !== null && !ehTipo(tipo)) || (onde !== null && !ehOnde(onde))) return { ok: false };
  const ctx = await getRequiredSession();
  const r = await trocarClassificacaoDoAtivo(ctx, assetId, { tipo, onde });
  revalidarCarteira();
  return { ok: r.count > 0 };
}

const OBJETIVOS: AssetObjective[] = ["RESERVA_EMERGENCIA", "LIBERDADE_FINANCEIRA", "META", "OUTRO"];

/** "Para: ..." no detalhe do ativo: reserva, liberdade, uma meta ou nenhum objetivo. */
export async function trocarObjetivoAction(assetId: string, objetivo: string, goalId: string | null): Promise<{ ok: boolean }> {
  if (!OBJETIVOS.includes(objetivo as AssetObjective)) return { ok: false };
  const ctx = await getRequiredSession();
  const r = await trocarObjetivoDoAtivo(ctx, assetId, objetivo as AssetObjective, goalId);
  revalidarCarteira();
  revalidatePath("/planejamento/metas");
  return { ok: r.count > 0 };
}

/**
 * "Já abri minha conta" / "Ainda não abri" (rodada 76). Tocar em "Abrir minha conta" NÃO passa
 * por aqui: só abre o link da EQI. Guarda o que ela disse, por conta (não por perfil).
 */
export async function assessoriaAction(acao: "ja_abri" | "ainda_nao"): Promise<{ estado: string }> {
  if (acao !== "ja_abri" && acao !== "ainda_nao") return { estado: "nao_cliente" };
  const ctx = await getRequiredSession();
  const atual = await prisma.user.findUniqueOrThrow({ where: { id: ctx.userId }, select: { assessoriaEstado: true } });
  const novo = proximoEstado(estadoDaAssessoria(atual.assessoriaEstado), acao);
  await prisma.user.update({
    where: { id: ctx.userId },
    data: { assessoriaEstado: novo === "nao_cliente" ? null : novo, assessoriaEstadoEm: new Date() },
  });
  revalidarCarteira();
  return { estado: novo };
}

/** O x do convite do fim da Carteira: some só para ela. */
export async function ocultarConviteDaAssessoriaAction(): Promise<void> {
  const ctx = await getRequiredSession();
  await prisma.user.update({ where: { id: ctx.userId }, data: { assessoriaConviteOculto: true } });
  revalidarCarteira();
}

export type CotacaoDoNovoAtivo = {
  /** Na moeda do ativo (R$ na B3, US$ lá fora). Null quando a fonte não respondeu. */
  preco: number | null;
  /** US$ 1 = R$ X, só para ativo lá fora. */
  dolar: number | null;
  /** Quando o app buscou (ISO): a tela escreve "cotação de hoje · 10:15". */
  em: string;
};

/**
 * A cotação de hoje para o Novo ativo (rodada 23): o número que vem de fora aparece com a origem
 * e a hora. Se a fonte falhar, devolve null e a tela diz que não respondeu (nunca inventa).
 */
export async function cotacaoDoNovoAtivoAction(ticker: string, exterior: boolean): Promise<CotacaoDoNovoAtivo> {
  await getRequiredSession();
  const t = String(ticker ?? "").trim().toUpperCase().slice(0, 12);
  const em = new Date().toISOString();
  if (!t) return { preco: null, dolar: null, em };
  const { fetchTickerPrice } = await import("@/lib/analysis/price-scraper");
  const { fetchUsPrice } = await import("@/lib/analysis/us-price");
  const { getExchangeRate } = await import("@/lib/fx/rates");
  if (exterior) {
    const [preco, cambio] = await Promise.all([fetchUsPrice(t).catch(() => null), getExchangeRate("USD", "BRL").catch(() => null)]);
    return { preco, dolar: cambio?.rate ?? null, em };
  }
  if (!/^[A-Z]{4}\d{1,2}$/.test(t)) return { preco: null, dolar: null, em };
  return { preco: await fetchTickerPrice(t).catch(() => null), dolar: null, em };
}
