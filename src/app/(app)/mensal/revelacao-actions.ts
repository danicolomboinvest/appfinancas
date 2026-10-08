"use server";

import type { ParentCategory } from "@prisma/client";
import { getRequiredSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { categoryLabel } from "@/lib/categories";
import { trocouDePerfil } from "@/lib/profiles/perfil-da-tela";
import { montarRevelacao, type LinhaDoMes, type Revelacao } from "@/lib/import/revelacao";
import { nowInBrazil } from "@/lib/date/brazil-now";

/** O mês montado e se ela já tem orçamento no mês de hoje (decide o botão principal do fim). */
export type RevelacaoDoImport = Revelacao & { temOrcamento: boolean };

/**
 * O mês montado, pra tela que aparece logo depois de importar (ver lib/import/revelacao.ts).
 * Lê o mês INTEIRO do banco, não só o que acabou de entrar: é "seu mês ficou assim", com o que
 * ela já tinha lançado à mão e as outras importações juntos.
 *
 * `null` quando a tela é de outro perfil (trocou noutro aparelho no meio): melhor mostrar só o
 * "pronto" do que o mês do perfil errado.
 */
export async function resumoDoMesImportadoAction(year: number, month: number, perfilDaTela?: string | null): Promise<RevelacaoDoImport | null> {
  const ctx = await getRequiredSession();
  if (trocouDePerfil(perfilDaTela, ctx.profileId)) return null;
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;

  const hoje = nowInBrazil();
  const [grupos, orcamentos, personalizadas, orcamentoDeHoje] = await Promise.all([
    prisma.monthlyEntry.groupBy({
      by: ["category", "parentCategory", "customCategoryId"],
      where: { userId: ctx.userId, profileId: ctx.profileId, year, month },
      _sum: { amount: true },
    }),
    prisma.budget.findMany({
      where: { userId: ctx.userId, profileId: ctx.profileId, year, month },
      select: { parentCategory: true, customCategoryId: true, plannedAmount: true },
    }),
    prisma.customCategory.findMany({
      where: { userId: ctx.userId, profileId: ctx.profileId },
      select: { id: true, name: true },
    }),
    prisma.budget.count({
      where: { userId: ctx.userId, profileId: ctx.profileId, year: hoje.getFullYear(), month: hoje.getMonth() + 1, plannedAmount: { gt: 0 } },
      take: 1,
    }),
  ]);

  const nomes = new Map(personalizadas.map((c) => [c.id, c.name]));
  // A personalizada vem antes da mãe: com uma personalizada, a categoria-mãe do lançamento não vale.
  const chaveDe = (mae: ParentCategory | null, personalizada: string | null) => personalizada ?? mae ?? null;
  const linhas: LinhaDoMes[] = grupos.map((g) => {
    const chave = chaveDe(g.parentCategory, g.customCategoryId);
    const rotulo = g.customCategoryId
      ? (nomes.get(g.customCategoryId) ?? "Personalizada")
      : g.parentCategory
        ? categoryLabel(ctx.categorias ?? ctx.profileKind, g.parentCategory)
        : null;
    return { category: g.category, chave, rotulo, valor: Number(g._sum.amount ?? 0) };
  });
  const planejados = orcamentos.flatMap((o) => {
    const chave = chaveDe(o.parentCategory, o.customCategoryId);
    return chave ? [{ chave, planejado: Number(o.plannedAmount) }] : [];
  });
  return { ...montarRevelacao(linhas, planejados), temOrcamento: orcamentoDeHoje > 0 || planejados.some((p) => p.planejado > 0) };
}
