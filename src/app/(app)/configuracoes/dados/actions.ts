"use server";

import { getRequiredSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { categoryLabel } from "@/lib/categories";
import { vozDoTema } from "@/lib/profiles/voice";
import { TIPO_DO_LANCAMENTO, dataCsv, dinheiroCsv, montarCsv, quantidadeCsv } from "@/lib/export/csv-brasil";

/*
 * As duas exportações levam TODOS os perfis, com a coluna "Perfil". A tela promete "todos os
 * seus lançamentos" e a exclusão de conta manda exportar antes — mas o arquivo saía só com o
 * perfil ativo, e quem exportava do Pessoal e depois excluía a conta perdia a Empresa de vez.
 */

/** Exporta todos os lançamentos mensais da conta em CSV (perfil, mês, dia, tipo, categoria, descrição, valor). */
export async function exportEntriesCsvAction(): Promise<string> {
  const ctx = await getRequiredSession();
  const entries = await prisma.monthlyEntry.findMany({
    where: { userId: ctx.userId },
    include: { profile: { select: { name: true, kind: true } }, customCategory: { select: { name: true } } },
    orderBy: [{ year: "asc" }, { month: "asc" }, { entryDate: "asc" }, { createdAt: "asc" }],
  });

  const header = ["Perfil", "Ano", "Mês", "Data", "Tipo", "Categoria", "Subcategoria", "Descrição", "Valor"];
  const rows = entries.map((entry) => [
    entry.profile?.name ?? "",
    String(entry.year),
    String(entry.month),
    dataCsv(entry.entryDate),
    TIPO_DO_LANCAMENTO[entry.category] ?? entry.category,
    // O nome é o que a pessoa vê na tela: numa Empresa, "Estrutura", não "Moradia"; e a
    // categoria que ela criou sai pelo nome dela (antes saía vazia).
    entry.customCategory?.name ??
      (entry.parentCategory ? categoryLabel(entry.profile?.kind ?? ctx.profileKind, entry.parentCategory) : ""),
    entry.subcategory ?? "",
    entry.description ?? "",
    dinheiroCsv(entry.amount),
  ]);

  return montarCsv(header, rows);
}

/** Exporta a carteira da conta em CSV (perfil, nome, ticker, classe, objetivo, quantidade, investido, valor atual). */
export async function exportAssetsCsvAction(): Promise<string> {
  const ctx = await getRequiredSession();
  const assets = await prisma.asset.findMany({
    where: { userId: ctx.userId },
    include: { profile: { select: { name: true, kind: true } } },
    orderBy: [{ assetClass: "asc" }, { currentValue: "desc" }],
  });

  const header = ["Perfil", "Nome", "Ticker", "Classe", "Objetivo", "Quantidade", "Valor investido", "Valor atual"];
  const rows = assets.map((asset) => {
    // Rótulos da tela (voz neutra do tipo do perfil), não o nome interno do banco.
    const t = vozDoTema("padrao", asset.profile?.kind ?? ctx.profileKind).titulos;
    return [
      asset.profile?.name ?? "",
      asset.name,
      asset.ticker ?? "",
      t.formAtivoClasses[asset.assetClass] ?? asset.assetClass,
      t.formAtivoObjetivos[asset.objective] ?? asset.objective,
      asset.quantity !== null ? quantidadeCsv(asset.quantity) : "",
      asset.investedValue !== null ? dinheiroCsv(asset.investedValue) : "",
      dinheiroCsv(asset.currentValue),
    ];
  });

  return montarCsv(header, rows);
}
