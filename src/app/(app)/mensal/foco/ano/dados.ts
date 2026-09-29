import type { ParentCategory } from "@prisma/client";
import type { AuthContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { categoryLabel } from "@/lib/categories";
import { getYearlySummary } from "@/lib/consolidation/yearly";
import { listBudgetsForYear } from "@/lib/repositories/budget.repo";
import { listCustomCategories } from "@/lib/repositories/custom-category.repo";
import { getMonthlyPlan } from "@/lib/repositories/monthly-plan.repo";
import { chaveDaContaFixa, sugerirAno, type ViradaCategoria } from "@/lib/decisoes/virada-ano";

/** Quantos meses do fim do ano entram na média do "gasto de verdade". */
const MESES_DA_MEDIA = 3;
/** Quantos gastos lançados à mão em dezembro a tela oferece como "talvez conta fixa". */
const MAX_CANDIDATAS = 12;

export type ContaFixa = {
  /** Identifica a linha na tela (marcar/desmarcar) e na action, que confere contra esta lista. */
  chave: string;
  descricao: string;
  valor: number;
  dia: number | null;
  parentCategory: ParentCategory | null;
  customCategoryId: string | null;
  subcategory: string | null;
  categoria: string;
};

/**
 * Tudo que a virada do ano precisa: o resumo do ano que passou e a sugestão pro ano novo. Usado
 * pela tela (pra mostrar) e pela action (que recalcula tudo, nunca confia no que veio da tela).
 */
export async function carregarViradaDoAno(ctx: AuthContext, money: (v: number) => string) {
  const agora = nowInBrazil();
  const ano = agora.getFullYear();
  const passado = ano - 1;

  const [resumo, orcamentos, personalizadas, porCategoriaAno, orcamentosDoAnoNovo] = await Promise.all([
    getYearlySummary(ctx, passado),
    listBudgetsForYear(ctx, passado),
    listCustomCategories(ctx),
    prisma.monthlyEntry.groupBy({
      by: ["parentCategory"],
      where: { userId: ctx.userId, profileId: ctx.profileId, year: passado, category: "EXPENSE", parentCategory: { not: null } },
      _sum: { amount: true },
    }),
    prisma.budget.count({ where: { userId: ctx.userId, profileId: ctx.profileId, year: ano } }),
  ]);

  // O último mês do ano que tinha orçamento é o "plano" que ela levava (quase sempre dezembro).
  const ultimoMesComPlano = orcamentos.reduce((m, b) => Math.max(m, b.month), 0);
  const plano = ultimoMesComPlano > 0 ? orcamentos.filter((b) => b.month === ultimoMesComPlano && Number(b.plannedAmount) > 0) : [];
  const planoDoMes = await getMonthlyPlan(ctx, passado, ultimoMesComPlano || 12);

  // Gasto de verdade nos últimos meses do ano, por categoria (só meses que tiveram gasto).
  const mesesDaMedia = Array.from({ length: MESES_DA_MEDIA }, (_, i) => 12 - i);
  const [porMae, porPersonalizada, mesesComGasto] = await Promise.all([
    prisma.monthlyEntry.groupBy({
      by: ["parentCategory"],
      where: { userId: ctx.userId, profileId: ctx.profileId, year: passado, month: { in: mesesDaMedia }, category: "EXPENSE", parentCategory: { not: null } },
      _sum: { amount: true },
    }),
    prisma.monthlyEntry.groupBy({
      by: ["customCategoryId"],
      where: { userId: ctx.userId, profileId: ctx.profileId, year: passado, month: { in: mesesDaMedia }, category: "EXPENSE", customCategoryId: { not: null } },
      _sum: { amount: true },
    }),
    prisma.monthlyEntry.groupBy({
      by: ["month"],
      where: { userId: ctx.userId, profileId: ctx.profileId, year: passado, month: { in: mesesDaMedia }, category: "EXPENSE" },
      _count: { _all: true },
    }),
  ]);
  const nMeses = Math.max(1, mesesComGasto.length);
  const nomePersonalizada = new Map(personalizadas.map((c) => [c.id, c.name]));
  const realMae = new Map(porMae.map((g) => [g.parentCategory as string, Number(g._sum.amount ?? 0) / nMeses]));
  const realPers = new Map(porPersonalizada.map((g) => [g.customCategoryId as string, Number(g._sum.amount ?? 0) / nMeses]));

  const categorias = new Map<string, ViradaCategoria>();
  for (const b of plano) {
    if (b.parentCategory) {
      categorias.set(b.parentCategory, { key: b.parentCategory, label: categoryLabel(ctx.profileKind, b.parentCategory), planejado: Number(b.plannedAmount), realMedio: realMae.get(b.parentCategory) ?? 0, mae: true });
    } else if (b.customCategoryId && nomePersonalizada.has(b.customCategoryId)) {
      categorias.set(b.customCategoryId, { key: b.customCategoryId, label: nomePersonalizada.get(b.customCategoryId)!, planejado: Number(b.plannedAmount), realMedio: realPers.get(b.customCategoryId) ?? 0, mae: false });
    }
  }
  // Categoria em que ela gastou sem ter planejado também entra (com o gasto de verdade).
  for (const [key, real] of realMae) {
    if (!categorias.has(key)) categorias.set(key, { key, label: categoryLabel(ctx.profileKind, key as ParentCategory), planejado: 0, realMedio: real, mae: true });
  }
  for (const [key, real] of realPers) {
    if (!categorias.has(key) && nomePersonalizada.has(key)) categorias.set(key, { key, label: nomePersonalizada.get(key)!, planejado: 0, realMedio: real, mae: false });
  }

  const rendas = resumo.months.map((m) => m.totalIncome).filter((v) => v > 0).sort((a, b) => a - b);
  const mediana = rendas.length === 0 ? null : rendas.length % 2 ? rendas[(rendas.length - 1) / 2] : (rendas[rendas.length / 2 - 1] + rendas[rendas.length / 2]) / 2;

  const sugestao = sugerirAno(
    {
      ano: passado,
      renda: { planejada: planoDoMes?.plannedIncome ?? null, mediana },
      guardarPlanejado: planoDoMes?.plannedInvestment ?? null,
      categorias: [...categorias.values()],
    },
    money,
  );

  // Contas fixas: as cópias da despesa recorrente que estavam lançadas pra dezembro antes de
  // dezembro começar. São elas que "somem" na virada, e que a sugestão traz pro ano novo.
  // Os lançados à mão DENTRO de dezembro ficam de fora dessa lista: a conta fixa que ela
  // configurou em dezembro ("repetir todo mês") só tem a cópia de dezembro, igual a um gasto
  // avulso, e não há como distinguir as duas. Esses vão pra uma segunda lista, desmarcados:
  // ela escolhe quais continuam, em vez de ter que lançar tudo de novo em janeiro.
  const inicioDeDezembro = new Date(Date.UTC(passado, 11, 1, 3));
  const deDezembro = await prisma.monthlyEntry.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, year: passado, month: 12, category: "EXPENSE", importBatchId: null, externalId: null, amount: { gt: 0 } },
    select: { description: true, amount: true, entryDate: true, parentCategory: true, customCategoryId: true, subcategory: true, createdAt: true },
    orderBy: { amount: "desc" },
  });
  const vistas = new Set<string>();
  const paraConta = (c: (typeof deDezembro)[number]): ContaFixa => {
    const descricao = c.description ?? c.subcategory ?? "Conta fixa";
    return {
      chave: chaveDaContaFixa({ descricao, valor: Number(c.amount), parentCategory: c.parentCategory, customCategoryId: c.customCategoryId }),
      descricao,
      valor: Number(c.amount),
      dia: c.entryDate ? c.entryDate.getUTCDate() : null,
      parentCategory: c.parentCategory,
      customCategoryId: c.customCategoryId,
      subcategory: c.subcategory,
      categoria: c.parentCategory ? categoryLabel(ctx.profileKind, c.parentCategory) : c.customCategoryId ? (nomePersonalizada.get(c.customCategoryId) ?? "Personalizada") : "Sem categoria",
    };
  };
  const fixas: ContaFixa[] = [];
  for (const c of deDezembro.filter((e) => e.createdAt < inicioDeDezembro)) {
    const conta = paraConta(c);
    if (vistas.has(conta.chave)) continue;
    vistas.add(conta.chave);
    fixas.push(conta);
  }
  const talvezFixas: ContaFixa[] = [];
  for (const c of deDezembro.filter((e) => e.createdAt >= inicioDeDezembro && e.description)) {
    const conta = paraConta(c);
    if (vistas.has(conta.chave) || talvezFixas.length >= MAX_CANDIDATAS) continue;
    vistas.add(conta.chave);
    talvezFixas.push(conta);
  }

  const maior = porCategoriaAno
    .map((g) => ({ label: categoryLabel(ctx.profileKind, g.parentCategory as ParentCategory), valor: Number(g._sum.amount ?? 0) }))
    .sort((a, b) => b.valor - a.valor)[0] ?? null;

  return {
    ano,
    passado,
    resumo: {
      renda: resumo.totalIncome,
      gastos: resumo.totalExpense,
      guardado: resumo.totalInvestment,
      sobrou: resumo.balance,
      pctGuardado: resumo.totalIncome > 0 ? resumo.totalInvestment / resumo.totalIncome : null,
      maior,
    },
    sugestao,
    fixas,
    talvezFixas,
    jaTemOrcamentoNoAnoNovo: orcamentosDoAnoNovo > 0,
  };
}

export type DadosVirada = Awaited<ReturnType<typeof carregarViradaDoAno>>;
