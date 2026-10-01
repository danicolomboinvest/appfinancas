"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getRequiredSession } from "@/lib/auth/session";
import { MSG_TROCOU_DE_PERFIL, trocouDePerfil } from "@/lib/profiles/perfil-da-tela";
import {
  createMonthlyEntry,
  createRecurringMonthlyEntries,
  updateOwnMonthlyEntry,
  deleteOwnMonthlyEntry,
  deleteOwnMonthlyEntries,
  updateOwnMonthlyEntriesCategory,
  listSeriesFrom,
  updateSeriesFrom,
  type MonthlyEntryInput,
} from "@/lib/repositories/monthly-entry.repo";
import { monthlyEntrySchema } from "@/lib/validations/monthly-entry.schema";
import { getUserCurrency } from "@/lib/money-server";
import { convertAmount, getExchangeRate } from "@/lib/fx/rates";
import type { ParentCategory } from "@prisma/client";
import { allocationsToRestore, type SnapshotAllocation } from "@/lib/portfolio/contribution-link";
import { listRecentlyPaidDividends } from "@/lib/repositories/dividend.repo";
import { aprenderComCorrecao, linhasAntesDaCorrecao } from "@/lib/repositories/transaction-rule.repo";
import type { z } from "zod";

export type MonthlyEntryState = { error?: string };

function parseEntryForm(formData: FormData) {
  return monthlyEntrySchema.safeParse({
    year: formData.get("year"),
    month: formData.get("month"),
    category: formData.get("category"),
    parentCategory: formData.get("parentCategory") || undefined,
    customCategoryId: formData.get("customCategoryId") || undefined,
    subcategory: formData.get("subcategory"),
    description: formData.get("description"),
    amount: formData.get("amount"),
    entryDate: formData.get("entryDate") ?? undefined,
    goalId: formData.get("goalId") || undefined,
    repeatMonthly: formData.get("repeatMonthly") ?? undefined,
    currency: formData.get("currency") || undefined,
    exchangeRate: formData.get("exchangeRate") || undefined,
    resgate: formData.get("resgate") ?? undefined,
  });
}

type ConversionError = { error: string };

/**
 * Lançamento em outra moeda: o valor digitado vira `amount` na moeda do usuário pela cotação
 * que veio do formulário (a pessoa pôde ajustar) ou, se ela apagou, pela cotação do dia.
 * Na moeda do próprio usuário não há nada a converter e os três campos ficam vazios.
 */
async function toEntryInput(data: z.output<typeof monthlyEntrySchema>): Promise<MonthlyEntryInput | ConversionError> {
  const userCurrency = await getUserCurrency();
  const currency = data.currency || userCurrency;
  let amount = data.amount;
  let conversion: Pick<MonthlyEntryInput, "originalAmount" | "originalCurrency" | "exchangeRate"> = {};
  if (currency !== userCurrency) {
    const rate = data.exchangeRate ?? (await getExchangeRate(currency, userCurrency))?.rate;
    if (!rate) return { error: "Não consegui a cotação de hoje. Informe a cotação pra continuar." };
    amount = convertAmount(data.amount, rate);
    conversion = { originalAmount: data.amount, originalCurrency: currency, exchangeRate: rate };
  }
  // Resgate: guardado negativo, o valor E o original (a lista mostra o original quando há).
  if (data.resgate) {
    amount = -amount;
    if (conversion.originalAmount) conversion = { ...conversion, originalAmount: -conversion.originalAmount };
  }
  return {
    year: data.year,
    month: data.month,
    category: data.category,
    amount,
    ...conversion,
    entryDate: data.entryDate,
    parentCategory: data.parentCategory || undefined,
    customCategoryId: data.customCategoryId || undefined,
    subcategory: data.subcategory || undefined,
    description: data.description || undefined,
    goalId: data.goalId || undefined,
  };
}

export async function createMonthlyEntryAction(
  _prevState: MonthlyEntryState,
  formData: FormData,
): Promise<MonthlyEntryState> {
  const parsed = parseEntryForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const ctx = await getRequiredSession();
  // Lançamento novo vai pro perfil ATIVO: se a tela foi aberta em outro (ela trocou em outra aba
  // ou aparelho), gravar aqui punha o gasto da Empresa no Pessoal. Ver perfil-da-tela.ts.
  if (trocouDePerfil(formData.get("profileId"), ctx.profileId)) return { error: MSG_TROCOU_DE_PERFIL };
  const entry = await toEntryInput(parsed.data);
  if ("error" in entry) return entry;
  try {
    if (parsed.data.repeatMonthly) {
      await createRecurringMonthlyEntries(ctx, entry);
    } else {
      await createMonthlyEntry(ctx, entry);
    }
  } catch (err) {
    console.error("createMonthlyEntryAction falhou:", err);
    return { error: "Não consegui salvar o lançamento. Tente novamente." };
  }
  revalidatePath(`/mensal/${parsed.data.year}`);
  revalidatePath(`/mensal/${parsed.data.year}/${parsed.data.month}`);
  return {};
}

/** Edição de um lançamento existente, mesmo formulário do create, com `entryId` extra. */
export async function updateMonthlyEntryAction(
  _prevState: MonthlyEntryState,
  formData: FormData,
): Promise<MonthlyEntryState> {
  const entryId = String(formData.get("entryId") ?? "");
  if (!entryId) return { error: "Lançamento não encontrado." };

  const parsed = parseEntryForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const ctx = await getRequiredSession();
  if (trocouDePerfil(formData.get("profileId"), ctx.profileId)) return { error: MSG_TROCOU_DE_PERFIL };
  const entry = await toEntryInput(parsed.data);
  if ("error" in entry) return entry;
  // Gasto importado que ela põe em outra categoria-mãe ensina o app (ver padroesDaCorrecao).
  // O "antes" é lido antes de salvar: é ele que diz se a categoria mudou e qual era a descrição
  // do extrato (ela pode ter renomeado a linha, e o próximo extrato vem com o nome do banco).
  const aprender = entry.category === "EXPENSE" && entry.parentCategory && !entry.customCategoryId ? entry.parentCategory : null;
  const antes = aprender ? await linhasAntesDaCorrecao(ctx, [entryId]) : [];
  // Despesa fixa: "Só este mês" (o padrão) ou "Este e os próximos" (a série inteira daqui pra frente).
  const serie = formData.get("escopo") === "proximos";
  try {
    const { count } = serie ? await updateSeriesFrom(ctx, entryId, entry) : await updateOwnMonthlyEntry(ctx, entryId, entry);
    // Nada casou: o lançamento é de outro perfil (ela trocou de perfil em outra aba ou
    // aparelho, e esta tela ficou pra trás) ou já foi apagado. Antes respondia "salvo" e a
    // edição sumia sem aviso.
    if (count === 0) {
      return { error: "Não achei esse lançamento no perfil aberto agora. Se você trocou de perfil em outra tela, recarregue a página." };
    }
  } catch (err) {
    console.error("updateMonthlyEntryAction falhou:", err);
    return { error: "Não consegui salvar as alterações. Tente novamente." };
  }
  if (aprender) await aprenderComCorrecao(ctx, antes, { parentCategory: aprender, subcategory: entry.subcategory });
  if (serie) revalidatePath("/mensal", "layout");
  revalidatePath(`/mensal/${parsed.data.year}`);
  revalidatePath(`/mensal/${parsed.data.year}/${parsed.data.month}`);
  return {};
}

export async function deleteMonthlyEntryAction(id: string, year: number, month: number) {
  const ctx = await getRequiredSession();
  await deleteOwnMonthlyEntry(ctx, id);
  revalidatePath(`/mensal/${year}`);
  revalidatePath(`/mensal/${year}/${month}`);
}

/**
 * Quantos dos lançamentos que estão sendo apagados já tinham sido distribuídos em ativos.
 *
 * Apagar o aporte do mês NÃO tira o dinheiro da carteira de propósito: o valor do ativo é a
 * posição real da pessoa, e mexer nele por tabela seria pior. Mas ela precisa saber disso na
 * hora, senão o mês e a carteira passam a contar histórias diferentes sem ninguém perceber.
 */
async function allocationsOf(ctx: Awaited<ReturnType<typeof getRequiredSession>>, ids: string[]) {
  if (ids.length === 0) return [];
  return prisma.contributionAllocation.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, entryId: { in: ids } },
    select: { entryId: true, assetId: true, amount: true },
  });
}

/**
 * Exclusão em lote (modo "Selecionar"): uma ida ao banco, uma revalidação.
 *
 * Devolve também as distribuições de cada aporte apagado (a exclusão as leva em cascata): o
 * cliente guarda no snapshot do "Desfazer" pra que o aporte volte já com destino, e não como
 * dinheiro esperando a carteira perguntar de novo.
 */
export async function deleteMonthlyEntriesAction(ids: string[], year: number, month: number) {
  const ctx = await getRequiredSession();
  const [linhas, origem] = await Promise.all([
    allocationsOf(ctx, ids),
    // De onde o lançamento veio (lote de importação, transação do Open Finance). Não aparece
    // na lista, então o snapshot do cliente não tinha: o "Desfazer" devolvia um lançamento
    // "à mão" — o "Desfazer importação" deixava de levá-lo e o próximo sync o trazia de novo.
    ids.length === 0
      ? []
      : prisma.monthlyEntry.findMany({
          where: { id: { in: ids }, userId: ctx.userId, profileId: ctx.profileId, OR: [{ importBatchId: { not: null } }, { externalId: { not: null } }] },
          select: { id: true, importBatchId: true, externalId: true },
        }),
  ]);
  await deleteOwnMonthlyEntries(ctx, ids);
  revalidatePath(`/mensal/${year}`);
  revalidatePath(`/mensal/${year}/${month}`);
  const allocations: Record<string, SnapshotAllocation[]> = {};
  for (const l of linhas) (allocations[l.entryId] ??= []).push({ assetId: l.assetId, amount: Number(l.amount) });
  const origens: Record<string, { importBatchId: string | null; externalId: string | null }> = {};
  for (const o of origem) origens[o.id] = { importBatchId: o.importBatchId, externalId: o.externalId };
  return { jaNaCarteira: linhas.length, allocations, origens };
}

/**
 * Troca a categoria de vários lançamentos de uma vez (modo "Selecionar"): as parcelas de uma
 * mesma compra que caíram em "Outros" na importação, por exemplo — todas pra mesma categoria,
 * num toque só. `customCategoryId` manda; sem ele, usa a categoria-mãe fixa.
 */
export async function updateMonthlyEntriesCategoryAction(
  ids: string[],
  category: { parentCategory: ParentCategory | null; customCategoryId: string | null },
  year: number,
  month: number,
) {
  const ctx = await getRequiredSession();
  // Trocar pra uma categoria-mãe também ensina o app (categoria personalizada não vira regra:
  // a regra só guarda a categoria-mãe). Ver padroesDaCorrecao.
  const aprender = category.parentCategory && !category.customCategoryId ? category.parentCategory : null;
  const antes = aprender ? await linhasAntesDaCorrecao(ctx, ids) : [];
  const { count } = await updateOwnMonthlyEntriesCategory(ctx, ids, category);
  if (aprender && count > 0) await aprenderComCorrecao(ctx, antes, { parentCategory: aprender });
  revalidatePath(`/mensal/${year}`);
  revalidatePath(`/mensal/${year}/${month}`);
  return { count };
}

export type DeletedEntrySnapshot = {
  year: number;
  month: number;
  category: "INCOME" | "EXPENSE" | "INVESTMENT_CONTRIBUTION";
  parentCategory: string | null;
  customCategoryId: string | null;
  subcategory: string | null;
  description: string | null;
  amount: number;
  entryDate: string | null;
  goalId: string | null;
  originalAmount?: number | null;
  originalCurrency?: string | null;
  exchangeRate?: number | null;
  /** Em quais ativos este aporte já tinha entrado (vem de deleteMonthlyEntriesAction). */
  allocations?: SnapshotAllocation[];
  /** Lote de importação e id do Open Finance do lançamento apagado (vêm de deleteMonthlyEntriesAction). */
  importBatchId?: string | null;
  externalId?: string | null;
  /** Série de despesa fixa: o "Desfazer" devolve a cópia pra mesma série. */
  recurrenceId?: string | null;
};

/**
 * "Apagar este e os próximos" numa despesa fixa. Devolve o snapshot de cada cópia apagada
 * (com os ativos de um aporte e a série), pro "Desfazer" trazer todas de volta.
 *
 * `jaNaCarteira` é o mesmo aviso do "Só este mês" (deleteMonthlyEntriesAction): numa série de
 * aportes já distribuídos, o dinheiro fica nos ativos de propósito, e sem dizer isso o mês
 * perdia o aporte enquanto a carteira continuava com ele, sem ninguém perceber.
 */
export async function deleteSeriesFromAction(
  id: string,
): Promise<{ apagados: number; jaNaCarteira: number; snapshots: DeletedEntrySnapshot[] }> {
  const ctx = await getRequiredSession();
  const serie = await listSeriesFrom(ctx, String(id));
  if (serie.length === 0) return { apagados: 0, jaNaCarteira: 0, snapshots: [] };
  const ids = serie.map((e) => e.id);
  const linhas = await allocationsOf(ctx, ids);
  const snapshots: DeletedEntrySnapshot[] = serie.map((e) => ({
    year: e.year,
    month: e.month,
    category: e.category,
    parentCategory: e.parentCategory,
    customCategoryId: e.customCategoryId,
    subcategory: e.subcategory,
    description: e.description,
    amount: Number(e.amount),
    entryDate: e.entryDate ? e.entryDate.toISOString().slice(0, 10) : null,
    goalId: e.goalId,
    originalAmount: e.originalAmount === null ? null : Number(e.originalAmount),
    originalCurrency: e.originalCurrency,
    exchangeRate: e.exchangeRate === null ? null : Number(e.exchangeRate),
    allocations: linhas.filter((l) => l.entryId === e.id).map((l) => ({ assetId: l.assetId, amount: Number(l.amount) })),
    recurrenceId: e.recurrenceId,
  }));
  const { count } = await deleteOwnMonthlyEntries(ctx, ids);
  revalidatePath("/mensal", "layout");
  return { apagados: count, jaNaCarteira: linhas.length, snapshots };
}

/** Desfazer exclusão: recria o lançamento a partir do snapshot guardado no cliente. */
export async function undoDeleteEntryAction(snapshot: DeletedEntrySnapshot): Promise<{ ok: boolean }> {
  const ctx = await getRequiredSession();
  try {
    // Data do snapshot vem do cliente: fora do formato, vira Invalid Date e estouraria no
    // Prisma — melhor restaurar sem a data do que falhar o "Desfazer" inteiro.
    const entryDate = snapshot.entryDate ? new Date(snapshot.entryDate) : undefined;
    // O lote vem do cliente: só volta se for mesmo um lote desta pessoa neste perfil (e se ainda
    // existir — o "Desfazer importação" pode ter apagado o lote nesse meio-tempo).
    const importBatchId = snapshot.importBatchId
      ? (
          await prisma.importBatch.findFirst({
            where: { id: snapshot.importBatchId, userId: ctx.userId, profileId: ctx.profileId },
            select: { id: true },
          })
        )?.id
      : undefined;
    // Transação do Open Finance que o sync já trouxe de volta nesse meio-tempo: ela já está no
    // mês, recriar seria contar duas vezes (e o externalId é único por perfil).
    if (snapshot.externalId) {
      const jaVoltou = await prisma.monthlyEntry.findFirst({
        where: { userId: ctx.userId, profileId: ctx.profileId, externalId: snapshot.externalId },
        select: { id: true },
      });
      if (jaVoltou) return { ok: true };
    }
    const entry = await createMonthlyEntry(ctx, {
      year: snapshot.year,
      month: snapshot.month,
      category: snapshot.category,
      parentCategory: (snapshot.parentCategory as MonthlyEntryInput["parentCategory"]) ?? undefined,
      customCategoryId: snapshot.customCategoryId ?? undefined,
      subcategory: snapshot.subcategory ?? undefined,
      description: snapshot.description ?? undefined,
      amount: snapshot.amount,
      entryDate: entryDate && !Number.isNaN(entryDate.getTime()) ? entryDate : undefined,
      goalId: snapshot.goalId ?? undefined,
      originalAmount: snapshot.originalAmount ?? undefined,
      originalCurrency: snapshot.originalCurrency ?? undefined,
      exchangeRate: snapshot.exchangeRate ?? undefined,
      importBatchId,
      externalId: snapshot.externalId ?? undefined,
      recurrenceId: typeof snapshot.recurrenceId === "string" && snapshot.recurrenceId.length <= 60 ? snapshot.recurrenceId : undefined,
    });
    // O aporte volta com o destino que tinha. Sem isso a carteira perguntava de novo onde ele
    // entrou (e responder somava outra vez no ativo) e a meta contava aporte + ativo, o dobro.
    if (snapshot.category === "INVESTMENT_CONTRIBUTION" && snapshot.allocations?.length) {
      const own = await prisma.asset.findMany({
        where: { userId: ctx.userId, profileId: ctx.profileId, id: { in: snapshot.allocations.map((a) => a.assetId) } },
        select: { id: true },
      });
      const linhas = allocationsToRestore(snapshot.allocations, new Set(own.map((a) => a.id)), Number(entry.amount));
      try {
        if (linhas.length > 0) {
          await prisma.contributionAllocation.createMany({
            data: linhas.map((l) => ({ userId: ctx.userId, profileId: ctx.profileId, entryId: entry.id, assetId: l.assetId, amount: l.amount })),
          });
        }
      } catch (err) {
        // Meio restaurado é pior que nada: o aporte voltaria "sem destino" e contaria em dobro.
        console.error("undoDeleteEntryAction: distribuições não voltaram, desfazendo o lançamento:", err);
        await deleteOwnMonthlyEntry(ctx, entry.id);
        return { ok: false };
      }
    }
  } catch {
    return { ok: false };
  }
  revalidatePath(`/mensal/${snapshot.year}`);
  revalidatePath(`/mensal/${snapshot.year}/${snapshot.month}`);
  if (snapshot.allocations?.length) {
    revalidatePath("/carteira");
    revalidatePath("/planejamento/metas");
  }
  return { ok: true };
}

/**
 * "Desfazer" de uma exclusão em lote. Restaura um a um pelo mesmo caminho do desfazer
 * individual, então qualquer proteção que exista lá vale aqui. `ok` só se TODOS voltaram.
 */
export async function undoDeleteEntriesAction(snapshots: DeletedEntrySnapshot[]): Promise<{ ok: boolean }> {
  const results = await Promise.all(snapshots.map((s) => undoDeleteEntryAction(s)));
  return { ok: results.every((r) => r.ok) };
}

/**
 * "Parece que se repete": lança agora o que o app viu nos meses anteriores e ainda não está
 * neste mês. `repeat` = também até dezembro, como o checkbox do formulário.
 */
export async function createFromRecurringAction(
  candidate: {
    category: "INCOME" | "EXPENSE" | "INVESTMENT_CONTRIBUTION";
    parentCategory: string | null;
    customCategoryId: string | null;
    subcategory: string | null;
    description: string | null;
    amount: number;
    typicalDay: number | null;
  },
  year: number,
  month: number,
  repeat: boolean,
): Promise<{ ok: boolean }> {
  const ctx = await getRequiredSession();
  const lastDay = new Date(year, month, 0).getDate();
  const day = candidate.typicalDay ? Math.min(candidate.typicalDay, lastDay) : undefined;
  const input: MonthlyEntryInput = {
    year,
    month,
    category: candidate.category,
    parentCategory: (candidate.parentCategory as MonthlyEntryInput["parentCategory"]) ?? undefined,
    customCategoryId: candidate.customCategoryId ?? undefined,
    subcategory: candidate.subcategory ?? undefined,
    description: candidate.description ?? undefined,
    amount: candidate.amount,
    entryDate: day ? new Date(year, month - 1, day, 12) : undefined,
  };
  try {
    if (repeat) await createRecurringMonthlyEntries(ctx, input);
    else await createMonthlyEntry(ctx, input);
  } catch (err) {
    console.error("createFromRecurringAction falhou:", err);
    return { ok: false };
  }
  revalidatePath(`/mensal/${year}`);
  revalidatePath(`/mensal/${year}/${month}`);
  return { ok: true };
}

/**
 * "Caiu na conta": lança o provento como renda, no dia do pagamento, com a descrição padrão que
 * evita repetir.
 *
 * Recebe só o id do provento: ticker, tipo, dia e valor saem do servidor (a mesma conta que
 * montou o card), então ninguém lança um valor inventado pela requisição, e o que já foi lançado
 * — noutra aba, num toque duplo — não vira um segundo lançamento.
 */
export async function registerDividendIncomeAction(input: { eventId: string }): Promise<{ ok: boolean }> {
  const ctx = await getRequiredSession();
  // Janela maior que a do card (10 dias): quem deixou a página aberta de um dia pro outro
  // ainda consegue lançar o que estava vendo.
  const paid = (await listRecentlyPaidDividends(ctx, 31)).find((d) => d.id === input.eventId);
  if (!paid) return { ok: false };
  if (paid.registered) return { ok: true };
  const date = new Date(`${paid.paymentDate.toISOString().slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime()) || !(paid.amount > 0)) return { ok: false };
  try {
    await createMonthlyEntry(ctx, {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      category: "INCOME",
      subcategory: "Dividendos",
      description: `Proventos ${paid.ticker} (${paid.kind})`,
      amount: paid.amount,
      entryDate: date,
    });
  } catch (err) {
    console.error("registerDividendIncomeAction falhou:", err);
    return { ok: false };
  }
  revalidatePath(`/mensal/${date.getFullYear()}`);
  revalidatePath(`/mensal/${date.getFullYear()}/${date.getMonth() + 1}`);
  return { ok: true };
}
