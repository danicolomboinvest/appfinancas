import type { EntryCategory, ParentCategory } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { PARENT_CATEGORIES } from "@/lib/categories";
import { sameDayInMonth } from "@/lib/date/recurrence";

export async function listMonthlyEntries(ctx: AuthContext, year: number, month: number) {
  return prisma.monthlyEntry.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, year, month },
    orderBy: { createdAt: "desc" },
  });
}

export type MonthlyEntryInput = {
  year: number;
  month: number;
  category: EntryCategory;
  parentCategory?: ParentCategory;
  customCategoryId?: string;
  subcategory?: string;
  description?: string;
  amount: number;
  /** Data em que a despesa/renda aconteceu (o dia). year/month seguem mandando na consolidação. */
  entryDate?: Date;
  /** Meta vinculada (faz sentido principalmente em aportes). */
  goalId?: string;
  /** Lote de importação que criou este lançamento (só em imports de extrato/fatura). */
  importBatchId?: string;
  /** Lançado em outra moeda: o valor digitado, a moeda dele e a cotação. `amount` já vem convertido. */
  originalAmount?: number;
  originalCurrency?: string;
  exchangeRate?: number;
  /** Perfil dono deste lançamento, quando é OUTRO que não o ativo na sessão — o import de
   * fatura manda pra cá compra que é da Empresa mas caiu no cartão Pessoal. `undefined` = o
   * perfil ativo de sempre. Quem chama já validou que o id é mesmo de um perfil do usuário. */
  profileId?: string;
};

/**
 * goalId/customCategoryId chegam do cliente: só valem se pertencerem MESMO ao usuário E ao
 * perfil de destino do lançamento (não necessariamente o perfil ativo — ver `profileId` em
 * `MonthlyEntryInput`), senão um id adivinhado/vazado linkaria lançamento à meta ou categoria
 * de outro perfil. Id que não bate é simplesmente descartado (vira sem vínculo).
 */
async function resolveOwnRefs(
  ctx: AuthContext,
  profileId: string,
  input: Pick<MonthlyEntryInput, "goalId" | "customCategoryId">,
): Promise<{ goalId?: string; customCategoryId?: string }> {
  const [goal, category] = await Promise.all([
    input.goalId ? prisma.goal.findFirst({ where: { id: input.goalId, userId: ctx.userId, profileId }, select: { id: true } }) : null,
    input.customCategoryId
      ? prisma.customCategory.findFirst({ where: { id: input.customCategoryId, userId: ctx.userId, profileId }, select: { id: true } })
      : null,
  ]);
  return { goalId: goal?.id, customCategoryId: category?.id };
}

/**
 * O Postgres recusa texto com o caractere NULO (código 0) e derruba a gravação inteira — foi
 * assim que uma importação de 32 lançamentos falhou 12 vezes seguidas. Tira antes de gravar,
 * venha o texto de arquivo importado ou de onde for.
 */
function semNulo<T extends string | undefined>(text: T): T {
  return (text?.includes("\u0000") ? text.replace(/\u0000/g, "") : text) as T;
}

export async function createMonthlyEntry(ctx: AuthContext, input: MonthlyEntryInput) {
  const profileId = input.profileId ?? ctx.profileId;
  const refs = await resolveOwnRefs(ctx, profileId, input);
  return prisma.monthlyEntry.create({
    data: { ...input, ...refs, userId: ctx.userId, profileId, description: semNulo(input.description), subcategory: semNulo(input.subcategory) },
  });
}

/** Atualiza um lançamento do próprio usuário (updateMany garante o filtro por userId). */
export async function updateOwnMonthlyEntry(ctx: AuthContext, id: string, input: MonthlyEntryInput) {
  const refs = await resolveOwnRefs(ctx, ctx.profileId, input);
  // Estorno é gravado como gasto negativo; o formulário só aceita valor positivo. Editar um
  // estorno (trocar a categoria, corrigir o valor) não pode transformá-lo numa compra.
  const atual = await prisma.monthlyEntry.findFirst({ where: { id, userId: ctx.userId, profileId: ctx.profileId }, select: { amount: true } });
  const eraEstorno = atual !== null && Number(atual.amount) < 0 && input.category === "EXPENSE";
  return prisma.monthlyEntry.updateMany({
    where: { id, userId: ctx.userId, profileId: ctx.profileId },
    data: {
      ...input,
      amount: eraEstorno ? -Math.abs(input.amount) : input.amount,
      // Campos opcionais ausentes devem LIMPAR o valor antigo (ex.: trocar de categoria-mãe
      // para personalizada), não manter, por isso null explícito em vez de undefined.
      parentCategory: input.parentCategory ?? null,
      customCategoryId: refs.customCategoryId ?? null,
      subcategory: semNulo(input.subcategory) ?? null,
      description: semNulo(input.description) ?? null,
      entryDate: input.entryDate ?? null,
      goalId: refs.goalId ?? null,
      originalAmount: input.originalAmount ?? null,
      originalCurrency: input.originalCurrency ?? null,
      exchangeRate: input.exchangeRate ?? null,
    },
  });
}

/**
 * Cria o mesmo lançamento em todos os meses restantes do ano corrente (despesa fixa recorrente).
 *
 * A data acompanha: antes, as cópias dos meses seguintes nasciam SEM data nenhuma — o que
 * deixava quem usa recorrência fora do gráfico diário e do "gastos da semana registrados",
 * justamente quem lança de forma mais organizada. Sem data no lançamento original (ninguém é
 * obrigado a preencher), as cópias seguem sem data também: não dá pra inventar um dia.
 */
export async function createRecurringMonthlyEntries(
  ctx: AuthContext,
  input: {
    year: number;
    month: number;
    category: EntryCategory;
    parentCategory?: ParentCategory;
    customCategoryId?: string;
    subcategory?: string;
    description?: string;
    amount: number;
    entryDate?: Date;
  },
) {
  const refs = await resolveOwnRefs(ctx, ctx.profileId, input);
  const months = [];
  for (let m = input.month; m <= 12; m++) {
    months.push(m);
  }
  return prisma.monthlyEntry.createMany({
    data: months.map((month) => ({
      ...input,
      customCategoryId: refs.customCategoryId,
      month,
      entryDate: input.entryDate ? sameDayInMonth(input.entryDate, input.year, month) : null,
      userId: ctx.userId, profileId: ctx.profileId,
    })),
  });
}

/**
 * Subcategorias mais usadas recentemente pelo usuário, por categoria-mãe (para sugestão no
 * lançamento rápido), agrupado por parentCategory pra não sugerir, por exemplo, "Aluguel"
 * (Moradia) quando o usuário está lançando uma despesa em Alimentação.
 */
export async function listRecentSubcategories(
  ctx: AuthContext,
  limit = 6,
): Promise<Record<ParentCategory, string[]>> {
  const recent = await prisma.monthlyEntry.groupBy({
    by: ["parentCategory", "subcategory"],
    where: { userId: ctx.userId, profileId: ctx.profileId, category: "EXPENSE", parentCategory: { not: null }, subcategory: { not: null } },
    _count: { subcategory: true },
    orderBy: { _count: { subcategory: "desc" } },
  });

  const result = Object.fromEntries(PARENT_CATEGORIES.map((pc) => [pc, [] as string[]])) as Record<
    ParentCategory,
    string[]
  >;
  for (const row of recent) {
    if (!row.parentCategory || !row.subcategory) continue;
    const bucket = result[row.parentCategory];
    if (bucket.length < limit) bucket.push(row.subcategory);
  }
  return result;
}

/** Só remove lançamentos do próprio usuário. */
export async function deleteOwnMonthlyEntry(ctx: AuthContext, id: string) {
  return prisma.monthlyEntry.deleteMany({ where: { id, userId: ctx.userId, profileId: ctx.profileId } });
}

/** Vários de uma vez (modo "Selecionar" da lista). O userId no where garante que só apaga o que é da pessoa. */
export async function deleteOwnMonthlyEntries(ctx: AuthContext, ids: string[]) {
  if (ids.length === 0) return { count: 0 };
  return prisma.monthlyEntry.deleteMany({ where: { id: { in: ids }, userId: ctx.userId, profileId: ctx.profileId } });
}

/**
 * Muda a categoria de VÁRIOS lançamentos de uma vez (modo "Selecionar" da lista) — pras parcelas
 * de uma mesma compra que a classificação automática jogou em "Outros" e são, todas, a mesma
 * categoria de verdade. `customCategoryId` e `parentCategory` são exclusivos: manda só um dos
 * dois, o outro precisa vir `null` explícito pra limpar o que já tinha.
 */
export async function updateOwnMonthlyEntriesCategory(
  ctx: AuthContext,
  ids: string[],
  category: { parentCategory: ParentCategory | null; customCategoryId: string | null },
) {
  if (ids.length === 0) return { count: 0 };
  const refs = await resolveOwnRefs(ctx, ctx.profileId, { customCategoryId: category.customCategoryId ?? undefined });
  return prisma.monthlyEntry.updateMany({
    where: { id: { in: ids }, userId: ctx.userId, profileId: ctx.profileId },
    data: { parentCategory: category.parentCategory, customCategoryId: refs.customCategoryId ?? null },
  });
}

/**
 * Quantos lançamentos COM DATA caíram nos últimos `days` dias — alimenta o "já registrei os
 * gastos da semana?" do checklist. Conta só quem tem entryDate: sem data não dá pra afirmar
 * que aconteceu nesta semana (o mês/ano do lançamento não diz o dia).
 */
export async function countRecentDatedEntries(ctx: AuthContext, days: number): Promise<number> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return prisma.monthlyEntry.count({
    where: { userId: ctx.userId, profileId: ctx.profileId, entryDate: { gte: since } },
  });
}

/** Lançamentos de uma lista de meses (ex.: os três anteriores), pra detectar o que se repete. */
export async function listEntriesForMonths(ctx: AuthContext, months: { year: number; month: number }[]) {
  if (months.length === 0) return [];
  return prisma.monthlyEntry.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, OR: months.map((m) => ({ year: m.year, month: m.month })) },
    select: {
      year: true, month: true, category: true, parentCategory: true, customCategoryId: true,
      subcategory: true, description: true, amount: true, entryDate: true,
    },
  });
}

/**
 * Receita por TIPO (a subcategoria dos lançamentos de entrada: "Vendas", "Serviços",
 * "Assinaturas"…). É o "receita por linha de produto" do painel da empresa. Sem mês, soma o
 * ano inteiro. Entrada sem tipo cai em "Sem tipo", pra soma bater com o total do período.
 */
export async function sumIncomeBySubcategory(ctx: AuthContext, year: number, month?: number) {
  const grouped = await prisma.monthlyEntry.groupBy({
    by: ["subcategory"],
    where: { userId: ctx.userId, profileId: ctx.profileId, year, ...(month ? { month } : {}), category: "INCOME" },
    _sum: { amount: true },
  });
  return grouped
    .map((g) => ({ subcategory: g.subcategory?.trim() || "Sem tipo", amount: Number(g._sum.amount ?? 0) }))
    .filter((g) => g.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Gastos COM DATA entre dois dias (inclusive), por categoria-mãe — alimenta o "semana passada"
 * do ritual. Sem data não entra: não dá pra afirmar em que semana aconteceu.
 */
export async function sumExpensesBetweenDates(ctx: AuthContext, from: Date, to: Date) {
  const grouped = await prisma.monthlyEntry.groupBy({
    by: ["parentCategory"],
    where: { userId: ctx.userId, profileId: ctx.profileId, category: "EXPENSE", entryDate: { gte: from, lte: to } },
    _sum: { amount: true },
  });
  return grouped.map((g) => ({ parentCategory: g.parentCategory, spent: Number(g._sum.amount ?? 0) }));
}

/**
 * Último gasto com data até `ate` (inclusive), olhando qualquer mês, que a pessoa de fato lançou.
 * Despesa fixa recorrente já nasce com data em todos os meses do ano: a cópia do dia 25 criada
 * em janeiro não é "a pessoa lançou gasto dia 25", e contá-la esconderia o aviso de dado velho.
 * Por isso só vale o que veio de importação, ou foi criado no dia do gasto ou depois.
 */
export async function getUltimoGastoAte(ctx: AuthContext, ate: Date): Promise<Date | null> {
  const rows = await prisma.monthlyEntry.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, category: "EXPENSE", entryDate: { not: null, lte: ate } },
    orderBy: { entryDate: "desc" },
    take: 60,
    select: { entryDate: true, createdAt: true, importBatchId: true, externalId: true },
  });
  const real = rows.find((r) => r.importBatchId || r.externalId || (r.entryDate && r.createdAt.getTime() >= r.entryDate.getTime()));
  // Fatura importada não tem dia por compra (entryDate vazio): o dia da importação é o dado mais
  // novo que a pessoa trouxe. Sem isso, quem acabou de importar a fatura via "dados velhos".
  const fatura = await prisma.monthlyEntry.findFirst({
    where: { userId: ctx.userId, profileId: ctx.profileId, category: "EXPENSE", entryDate: null, importBatchId: { not: null }, createdAt: { lte: new Date(ate.getTime() + 86_400_000) } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const diaDaFatura = fatura ? new Date(Date.UTC(fatura.createdAt.getUTCFullYear(), fatura.createdAt.getUTCMonth(), fatura.createdAt.getUTCDate())) : null;
  const datas = [real?.entryDate ?? null, diaDaFatura].filter((d): d is Date => d !== null);
  return datas.length > 0 ? new Date(Math.min(ate.getTime(), Math.max(...datas.map((d) => d.getTime())))) : null;
}

/**
 * Gastos do mês que vieram de fato da vida da pessoa: lançados (à mão ou importados) durante ou
 * depois do mês. O que foi criado ANTES do mês começar não conta: a despesa fixa recorrente
 * lançada em janeiro pra todos os meses, e as parcelas futuras que a importação de uma fatura
 * cria pros meses seguintes. Sem essa separação, "renda − contas fixas − parcelas" pareceria um
 * mês fechado, e a "sobra" do fechamento seria inventada.
 */
export async function contarGastosReaisDoMes(ctx: AuthContext, year: number, month: number): Promise<number> {
  return prisma.monthlyEntry.count({
    where: {
      userId: ctx.userId, profileId: ctx.profileId, year, month, category: "EXPENSE",
      // 03:00 UTC = meia-noite em Brasília: a série recorrente criada dia 31 às 22h não conta como "real".
      createdAt: { gte: new Date(Date.UTC(year, month - 1, 1, 3)) },
    },
  });
}


/**
 * Quanto do gasto do mês, por categoria, veio de lançamento criado ANTES do mês começar: a
 * despesa fixa recorrente (plano de saúde, financiamento) e as parcelas da fatura. É conta que
 * já estava marcada, não "gasto correndo rápido".
 */
export async function somarGastosPreCriados(ctx: AuthContext, year: number, month: number) {
  const where = { userId: ctx.userId, profileId: ctx.profileId, year, month, category: "EXPENSE" as const, createdAt: { lt: new Date(Date.UTC(year, month - 1, 1, 3)) } };
  const [porMae, porPersonalizada] = await Promise.all([
    prisma.monthlyEntry.groupBy({ by: ["parentCategory"], where, _sum: { amount: true } }),
    prisma.monthlyEntry.groupBy({ by: ["customCategoryId"], where, _sum: { amount: true } }),
  ]);
  return {
    porMae: new Map(porMae.filter((g) => g.parentCategory).map((g) => [g.parentCategory as string, Number(g._sum.amount ?? 0)])),
    porPersonalizada: new Map(porPersonalizada.filter((g) => g.customCategoryId).map((g) => [g.customCategoryId as string, Number(g._sum.amount ?? 0)])),
  };
}
