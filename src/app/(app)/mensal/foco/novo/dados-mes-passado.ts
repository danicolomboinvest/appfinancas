import type { ParentCategory } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { comFiltro, lancamentosDosTotais } from "@/lib/casa/regras";
import { CHAVE_SEM_CATEGORIA, NOME_SEM_CATEGORIA, chaveDoGasto, CUSTOM_CATEGORY_ICON_MAP, categoryIcon, categoryLabel, colorForCategorySlice, isParentCategoryKey } from "@/lib/categories";
import { listCustomCategories } from "@/lib/repositories/custom-category.repo";
import { mesesAte, valoresDosMeses } from "@/lib/consolidation/seis-meses";
import { CATEGORIAS_FIXAS } from "@/lib/decisoes/semana-fixa";
import { lerFechamento } from "@/lib/repositories/fechamento.repo";
import type { HeroiMesFechado, InfoDaCategoria, LinhaDeCategoria } from "./dados";
import { mesAnterior, type Mes } from "./regras";
import { heroiDoMesPassado, paraOndeFoiNoMes, statusDoFechamento, type StatusDoFechamento } from "./mes-passado";

export type MesPassado = {
  mes: Mes;
  anterior: Mes;
  /** null: o mês não tem nenhum lançamento. */
  heroi: HeroiMesFechado | null;
  categorias: LinhaDeCategoria[];
  /** false: o mês anterior não tem gasto no app, as linhas são as maiores, sem diferença. */
  comparou: boolean;
  fechamento: StatusDoFechamento;
};

/** O que o Resumo de um mês passado desenha: os mesmos números do Resumo e das Transações. */
export async function carregarMesPassado(ctx: AuthContext, mes: Mes, agora: Mes): Promise<MesPassado> {
  const anterior = mesAnterior(mes);
  const [valores, gastos, personalizadas, fechamento] = await Promise.all([
    // 7 meses: as 6 barras terminando nele e o anterior da primeira.
    valoresDosMeses(ctx, mesesAte(mes.ano, mes.mes, 7)),
    prisma.monthlyEntry.groupBy({
      by: ["year", "month", "parentCategory", "customCategoryId"],
      where: comFiltro(lancamentosDosTotais(ctx), { category: "EXPENSE", OR: [{ year: mes.ano, month: mes.mes }, { year: anterior.ano, month: anterior.mes }] }),
      _sum: { amount: true },
      _count: { _all: true },
    }),
    listCustomCategories(ctx),
    lerFechamento(ctx, mes.ano, mes.mes),
  ]);

  const valorDe = (m: Mes) => valores.find((v) => v.ano === m.ano && v.mes === m.mes) ?? { entrou: 0, gastou: 0, guardou: 0 };
  const heroi = heroiDoMesPassado(mes, valorDe);

  // Um "gasto" por categoria com a soma, e as compras contadas à parte (o groupBy já soma).
  const chaveDe = chaveDoGasto;
  const doMes = (m: Mes) => gastos.filter((g) => g.year === m.ano && g.month === m.mes);
  const compras = new Map<string, number>();
  for (const g of doMes(mes)) compras.set(chaveDe(g), (compras.get(chaveDe(g)) ?? 0) + g._count._all);
  const paraLinha = (g: (typeof gastos)[number]) => ({ valor: Number(g._sum.amount ?? 0), categoria: chaveDe(g) });
  const { linhas, comparou } = paraOndeFoiNoMes(doMes(mes).map(paraLinha), doMes(anterior).map(paraLinha), CATEGORIAS_FIXAS);

  const nomePersonalizada = new Map(personalizadas.map((c) => [c.id, c]));
  const doPerfil = ctx.categorias ?? ctx.profileKind;
  const info = (chave: string): InfoDaCategoria => {
    if (isParentCategoryKey(chave)) {
      return { chave, nome: categoryLabel(doPerfil, chave as ParentCategory), icone: categoryIcon(doPerfil, chave as ParentCategory), cor: colorForCategorySlice({ kind: "parent", value: chave }, doPerfil) };
    }
    if (chave === CHAVE_SEM_CATEGORIA) return { chave, nome: NOME_SEM_CATEGORIA, icone: CUSTOM_CATEGORY_ICON_MAP.tag, cor: colorForCategorySlice({ kind: "custom", value: chave }, doPerfil) };
    const c = nomePersonalizada.get(chave);
    return { chave, nome: c?.name ?? "Outros", icone: CUSTOM_CATEGORY_ICON_MAP[c?.icon ?? "tag"] ?? CUSTOM_CATEGORY_ICON_MAP.tag, cor: colorForCategorySlice({ kind: "custom", value: chave }, doPerfil) };
  };

  return {
    mes,
    anterior,
    heroi,
    categorias: heroi ? linhas.map((l) => ({ ...info(l.categoria), ...l, compras: compras.get(l.categoria) ?? 0 })) : [],
    comparou,
    fechamento: heroi ? statusDoFechamento(mes, agora, fechamento) : null,
  };
}
