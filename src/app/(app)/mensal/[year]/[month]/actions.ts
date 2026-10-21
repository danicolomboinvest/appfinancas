"use server";

import { registrarFalhaDaAcao } from "@/lib/erros/registrar-falha";
import { mensagemDeValidacao } from "@/lib/validations/mensagem";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getRequiredSession } from "@/lib/auth/session";
import { MSG_TROCOU_DE_PERFIL, trocouDePerfil } from "@/lib/profiles/perfil-da-tela";
import {
  createMonthlyEntry,
  createRecurringMonthlyEntries,
  createParcelasDaCompra,
  updateOwnMonthlyEntry,
  listParcelasFrom,
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
import { aprenderComCorrecao, linhasAntesDaCorrecao, upsertTransactionRule } from "@/lib/repositories/transaction-rule.repo";
import { regraDaCorrecaoDaVoz } from "@/lib/entries/aprender-da-voz";
import { situacaoDoCartao } from "@/lib/repositories/limite-cartao.repo";
import { agendarAvisoDoCartao } from "@/lib/cartao/agendar";
import { cartaoDoPerfil } from "@/lib/repositories/cartao.repo";
import { mesDoGastoNoCartao } from "@/lib/cartao/fatura";
import { mesDoPeriodo } from "@/lib/mes/periodo";
import { getDiaInicioMes } from "@/lib/repositories/user.repo";
import { descricaoDaParcela, dividirEmParcelas, parcelasNasFaturas, parcelasValidas } from "@/lib/cartao/parcelas";
import { vozDoTema } from "@/lib/profiles/voice";
import { serverMoney } from "@/lib/money-server";
import type { z } from "zod";
import { casaAtiva } from "@/lib/casa/regras";
import { lerEscolhasDoFormulario } from "@/lib/casa/escolhas";

/** `aviso`: o texto do toast quando não é o "Lançado" de sempre (gasto no cartão com limite). */
export type MonthlyEntryState = { error?: string; aviso?: string };

type Sessao = Awaited<ReturnType<typeof getRequiredSession>>;

/**
 * Limite do cartão (06/10/2026), depois de salvar um gasto: o aviso de 70/90/100% sai depois da
 * resposta (não atrasa o "Lançado"), e o gasto marcado no cartão já volta com quanto falta.
 */
async function depoisDoGasto(ctx: Sessao, entry: MonthlyEntryInput): Promise<string | undefined> {
  if (entry.category !== "EXPENSE") return undefined;
  await agendarAvisoDoCartao(ctx, entry.year, entry.month);
  if (entry.noCartao !== true) return undefined;
  const situacao = await situacaoDoCartao(ctx, entry.year, entry.month);
  if (!situacao) return undefined;
  const t = vozDoTema(ctx.profileTheme, ctx.profileKind).titulos;
  const money = await serverMoney();
  return situacao.falta >= 0 ? t.limToastFalta(money(situacao.falta)) : t.limToastPassou(money(-situacao.falta));
}

/**
 * Cartão cadastrado escolhido no Digitar (15/10/2026, CartaoNoDigitar): só gasto, e só um cartão
 * dela no perfil aberto. Com cartão, o gasto é "no cartão" (o limite já conta) e conta no mês da
 * fatura, o do vencimento (decisão da Dani, 15/10/2026, igual à fatura importada): year/month
 * viram o da fatura e entryDate continua a data da compra. Devolve o cartão, para a despesa fixa
 * calcular o mês de cada cópia.
 */
async function ligarAoCartao(ctx: Sessao, formData: FormData, entry: MonthlyEntryInput) {
  const id = formData.get("cartaoId");
  if (entry.category !== "EXPENSE" || typeof id !== "string" || !id) return null;
  const cartao = await cartaoDoPerfil(ctx, id);
  if (!cartao) return null;
  entry.cartaoId = cartao.id;
  entry.noCartao = true;
  const conta = mesDoGastoNoCartao(entry.entryDate, cartao);
  if (conta) Object.assign(entry, conta);
  return cartao;
}

/** "AAAA-MM-DD" de uma data do formulário (meio-dia local) ou do banco (@db.Date, meia-noite UTC). */
const diaDoForm = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;


/**
 * O mês que a pessoa definiu (lib/mes/periodo.ts, 21/10/2026): quem fecha o mês do dia 15 ao 14
 * tem o lançamento de 3/11 em outubro. Só gasto ou entrada À VISTA com data: o cartão tem o mês
 * da fatura, "para o mês seguinte" é escolha dela e a despesa fixa mensal segue o mês da tela.
 * Na edição só muda se a data mudou, para editar outra coisa não mover o lançamento de mês.
 */
async function aplicarMesDaPessoa(ctx: Sessao, formData: FormData, entry: MonthlyEntryInput, repete: boolean, entryId?: string) {
  if (entry.cartaoId || repete || formData.get("paraMesSeguinte") === "on" || !entry.entryDate) return;
  const dia = await getDiaInicioMes(ctx);
  if (!dia) return;
  if (entryId) {
    const atual = await prisma.monthlyEntry.findFirst({
      where: { id: entryId, userId: ctx.userId, profileId: ctx.profileId },
      select: { entryDate: true, cartaoId: true },
    });
    if (atual?.cartaoId) return;
    const igual = atual?.entryDate && atual.entryDate.toISOString().slice(0, 10) === diaDoForm(entry.entryDate);
    if (!atual || igual) return;
  }
  const mes = mesDoPeriodo(entry.entryDate, dia);
  if (mes) Object.assign(entry, mes);
}

/**
 * Edição de um gasto (15/10/2026): o cartão vem do formulário quando a folha mostra a escolha
 * ("" tira o cartão); sem o campo, fica o que estava. Mudou a data ou o cartão: o mês vira o da
 * fatura. Nada mudou nos dois: o mês que estava gravado fica, para a edição de outra coisa (a
 * categoria) não mover o gasto de mês, nem nos lançamentos de antes desta regra.
 */
async function cartaoNaEdicao(ctx: Sessao, formData: FormData, entryId: string, entry: MonthlyEntryInput) {
  const atual = await prisma.monthlyEntry.findFirst({
    where: { id: entryId, userId: ctx.userId, profileId: ctx.profileId },
    select: { cartaoId: true, entryDate: true, year: true, month: true, category: true },
  });
  if (!atual) return;
  let cartaoId = atual.cartaoId;
  const doForm = formData.get("cartaoId");
  if (typeof doForm === "string") cartaoId = doForm ? ((await cartaoDoPerfil(ctx, doForm))?.id ?? null) : null;
  if (entry.category !== "EXPENSE") {
    if (atual.cartaoId) entry.cartaoId = null;
    return;
  }
  if (typeof doForm === "string") {
    entry.cartaoId = cartaoId;
    if (cartaoId) entry.noCartao = true;
  }
  if (!cartaoId) return;
  const mudouData = (atual.entryDate ? atual.entryDate.toISOString().slice(0, 10) : null) !== (entry.entryDate ? diaDoForm(entry.entryDate) : null);
  if (mudouData || cartaoId !== atual.cartaoId || atual.category !== "EXPENSE") {
    const cartao = await cartaoDoPerfil(ctx, cartaoId);
    const conta = cartao ? mesDoGastoNoCartao(entry.entryDate, cartao) : null;
    if (conta) Object.assign(entry, conta);
  } else {
    entry.year = atual.year;
    entry.month = atual.month;
  }
}

/**
 * "Esse dinheiro é para o mês seguinte" (03/10/2026). Cliente: "recebo dia 25 e as contas vencem
 * dia 5; preciso deixar o dinheiro reservado para o mês seguinte". A entrada passa a CONTAR no mês
 * seguinte (year/month), com a data real guardada (entryDate), como a compra de fatura, que também
 * conta num mês diferente do dia. Assim o mês em que o salário caiu não mostra esse dinheiro como
 * livre, e o mês das contas mostra a entrada que vai pagá-las. Só vale para entrada (INCOME).
 * Desmarcar na edição volta o lançamento para o mês da data (o schema já deriva o mês dela).
 */
function aplicarMesSeguinte(formData: FormData, data: { category: string; year: number; month: number }): boolean {
  if (formData.get("paraMesSeguinte") !== "on" || data.category !== "INCOME") return false;
  const proximo = new Date(data.year, data.month, 1);
  data.year = proximo.getFullYear();
  data.month = proximo.getMonth() + 1;
  return true;
}

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
    pessoa: formData.get("pessoa") ?? undefined,
    tipoCasal: formData.get("tipoCasal") ?? undefined,
    noCartao: formData.get("noCartao") ?? undefined,
    casaDeQuem: formData.get("casaDeQuem") ?? undefined,
    casaPagou: formData.get("casaPagou") ?? undefined,
    casaDivisao: formData.get("casaDivisao") ?? undefined,
    casaParte: formData.get("casaParte") ?? undefined,
  });
}

/**
 * Casal simples (15/10/2026): as três escolhas do Digitar (de quem é, quem pagou, como divide).
 * Só valem num gasto e dentro de uma casa; fora disso o formulário nem manda. O que entra no
 * acerto nunca fica no "Só meu".
 */
function aplicarEscolhasDoCasal(ctx: Sessao, data: z.output<typeof monthlyEntrySchema>, entry: MonthlyEntryInput) {
  if (entry.category !== "EXPENSE" || !casaAtiva(ctx)) return;
  const e = lerEscolhasDoFormulario(data);
  if (!e) return;
  Object.assign(entry, e, e.doPar || e.pagouOPar ? { soMeu: false } : {});
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
    if (!rate) return { error: "Não consegui a cotação de hoje. Informe a cotação para continuar." };
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
    // Perfil Casal. Fora dele o formulário nem manda os campos, e undefined não mexe no que
    // estava gravado.
    pessoa: data.pessoa || undefined,
    doCasal: data.tipoCasal === "pessoal" || data.tipoCasal === "so_meu" ? false : data.tipoCasal === "casa" ? true : undefined,
    // Login do par: "Só meu" fica fora do acerto e o outro não vê nem o total. Só vale no Casal.
    // "Pessoal" não mexe no só meu (undefined): este formulário ainda não sabe mostrar um só meu
    // salvo, e editar um deles não pode destampar o que estava escondido.
    soMeu: data.tipoCasal === "so_meu" ? true : data.tipoCasal === "casa" ? false : undefined,
    // Limite do cartão: só gasto é "no cartão". Virou renda ou guardado na edição: limpa.
    noCartao: data.category === "EXPENSE" ? (data.noCartao ? data.noCartao === "sim" : undefined) : null,
  };
}

export async function createMonthlyEntryAction(
  _prevState: MonthlyEntryState,
  formData: FormData,
): Promise<MonthlyEntryState> {
  const parsed = parseEntryForm(formData);
  if (!parsed.success) {
    const msg = mensagemDeValidacao(parsed.error.issues[0]);
    await registrarFalhaDaAcao("lancar", `${msg} [${parsed.error.issues[0]?.path.join(".") ?? "?"}]`);
    return { error: msg };
  }

  aplicarMesSeguinte(formData, parsed.data);
  const ctx = await getRequiredSession();
  // Lançamento novo vai pro perfil ATIVO: se a tela foi aberta em outro (ela trocou em outra aba
  // ou aparelho), gravar aqui punha o gasto da Empresa no Pessoal. Ver perfil-da-tela.ts.
  if (trocouDePerfil(formData.get("profileId"), ctx.profileId)) {
    await registrarFalhaDaAcao("lancar", MSG_TROCOU_DE_PERFIL);
    return { error: MSG_TROCOU_DE_PERFIL };
  }
  const entry = await toEntryInput(parsed.data);
  if ("error" in entry) {
    await registrarFalhaDaAcao("lancar", entry.error);
    return entry;
  }
  aplicarEscolhasDoCasal(ctx, parsed.data, entry);
  // A despesa fixa no cartão: cada cópia nasce no mês da compra dela e conta no da fatura.
  const mesDaCompra = { year: entry.year, month: entry.month };
  const cartao = await ligarAoCartao(ctx, formData, entry);
  await aplicarMesDaPessoa(ctx, formData, entry, parsed.data.repeatMonthly === true);
  // Compra parcelada (18/10/2026): só gasto num cartão dela, sem "Repetir" e na moeda dela.
  const vezes = cartao && !parsed.data.repeatMonthly && !entry.originalCurrency ? parcelasValidas(formData.get("parcelas")) : 1;
  const parcelas = cartao && vezes > 1 && entry.entryDate ? parcelasDaCompra(entry, vezes, cartao) : null;
  try {
    if (parcelas) {
      await createParcelasDaCompra(ctx, entry, parcelas);
      Object.assign(entry, { year: parcelas[0].year, month: parcelas[0].month, amount: parcelas[0].amount });
    } else if (parsed.data.repeatMonthly) {
      await createRecurringMonthlyEntries(ctx, cartao ? { ...entry, ...mesDaCompra } : entry, cartao ? (d) => mesDoGastoNoCartao(d, cartao) : undefined);
    } else {
      await createMonthlyEntry(ctx, entry);
    }
  } catch (err) {
    console.error("createMonthlyEntryAction falhou:", err);
    await registrarFalhaDaAcao("lancar", err instanceof Error ? err.message : String(err));
    return { error: "Não consegui salvar o lançamento. Tente novamente." };
  }
  await aprenderDaVoz(ctx, formData, entry);
  revalidatePath(`/mensal/${parsed.data.year}`);
  revalidatePath(`/mensal/${parsed.data.year}/${parsed.data.month}`);
  if (entry.year !== parsed.data.year || entry.month !== parsed.data.month) {
    revalidatePath(`/mensal/${entry.year}`);
    revalidatePath(`/mensal/${entry.year}/${entry.month}`);
  }
  // As parcelas caem em vários meses (e às vezes no ano seguinte): todas as telas do mês e do orçamento.
  if (parcelas) {
    revalidatePath("/mensal", "layout");
    revalidatePath("/orcamento", "layout");
  }
  const aviso = await depoisDoGasto(ctx, entry);
  return aviso ? { aviso } : {};
}

/**
 * As parcelas de uma compra no cartão (18/10/2026): o total digitado dividido em `vezes` (a 1ª
 * leva os centavos que sobram, a soma bate exata), cada uma no mês da fatura dela e com "(k/N)"
 * na descrição. A regra mora em lib/cartao/parcelas.ts.
 */
function parcelasDaCompra(entry: MonthlyEntryInput, vezes: number, cartao: { diaFechamento: number | null; diaVencimento: number | null }) {
  const d = entry.entryDate!;
  const data = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const meses = parcelasNasFaturas(data, vezes, cartao);
  const valores = dividirEmParcelas(Math.round(entry.amount * 100), vezes);
  if (meses.length !== valores.length) return null;
  const base = entry.description?.trim() || "Compra parcelada";
  return meses.map((m, i) => ({
    year: m.year,
    month: m.month,
    // Meio-dia local, como a data do formulário (monthly-entry.schema).
    entryDate: new Date(`${m.data}T12:00:00`),
    amount: valores[i] / 100,
    description: descricaoDaParcela(base, m.numero, vezes),
  }));
}

/**
 * Gasto lançado pela voz em que ela trocou a categoria sugerida (ou escolheu uma quando não veio
 * nenhuma): a palavra-chave da fala vira regra dela (ver aprender-da-voz.ts). Falha aqui não
 * desfaz o lançamento, que já foi salvo.
 */
async function aprenderDaVoz(
  ctx: Awaited<ReturnType<typeof getRequiredSession>>,
  formData: FormData,
  entry: { category: string; parentCategory?: ParentCategory | null; customCategoryId?: string | null; subcategory?: string | null },
) {
  const chave = formData.get("vozChave");
  if (entry.category !== "EXPENSE" || typeof chave !== "string" || !chave) return;
  const sugestao = formData.get("vozSugestao");
  const regra = regraDaCorrecaoDaVoz({
    chave,
    sugestao: typeof sugestao === "string" ? sugestao : null,
    parentCategory: entry.parentCategory ?? null,
    customCategoryId: entry.customCategoryId ?? null,
    subcategory: entry.subcategory ?? null,
  });
  if (!regra) return;
  try {
    await upsertTransactionRule(ctx, regra);
  } catch (err) {
    console.error("aprenderDaVoz falhou:", err);
  }
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
    return { error: mensagemDeValidacao(parsed.error.issues[0]) };
  }

  // O mês de onde ele sai (a página aberta): revalidado também, senão continua aparecendo lá.
  const mesDaTela = { year: Number(formData.get("year")), month: Number(formData.get("month")) };
  aplicarMesSeguinte(formData, parsed.data);
  const ctx = await getRequiredSession();
  if (trocouDePerfil(formData.get("profileId"), ctx.profileId)) return { error: MSG_TROCOU_DE_PERFIL };
  const entry = await toEntryInput(parsed.data);
  if ("error" in entry) return entry;
  aplicarEscolhasDoCasal(ctx, parsed.data, entry);
  await cartaoNaEdicao(ctx, formData, entryId, entry);
  await aplicarMesDaPessoa(ctx, formData, entry, false, entryId);
  // Empresa: o cliente da venda (só vem quando a folha mostra o campo; vazio limpa).
  const cliente = formData.get("cliente");
  if (typeof cliente === "string" && entry.category === "INCOME") entry.cliente = cliente.trim().slice(0, 80) || null;
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
  revalidatePath(`/mensal/${entry.year}/${entry.month}`);
  if (Number.isInteger(mesDaTela.year) && Number.isInteger(mesDaTela.month)) revalidatePath(`/mensal/${mesDaTela.year}/${mesDaTela.month}`);
  const aviso = await depoisDoGasto(ctx, entry);
  return aviso ? { aviso } : {};
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
  /** Parcela de uma compra parcelada à mão: o "Desfazer" devolve a parcela à mesma compra. */
  parcelamentoId?: string | null;
  /** Cartão da compra: o "Desfazer" devolve o gasto ao cartão (e à fatura dele). */
  cartaoId?: string | null;
  /** Dividido com alguém: o "Desfazer" do Ignorar devolve a divisão junto. */
  divididoCom?: string | null;
  parteDeOutro?: number | null;
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
  return apagarComDesfazer(ctx, await listSeriesFrom(ctx, String(id)));
}

/**
 * "Esta e as próximas" numa parcela de compra parcelada à mão (18/10/2026, a Dani): as parcelas
 * da mesma compra deste mês em diante, só da dona e do perfil aberto. Mesmo Desfazer da despesa
 * fixa: todas voltam, com o cartão (e por isso na fatura certa).
 */
export async function deleteParcelasFromAction(
  id: string,
): Promise<{ apagados: number; jaNaCarteira: number; snapshots: DeletedEntrySnapshot[] }> {
  const ctx = await getRequiredSession();
  const r = await apagarComDesfazer(ctx, await listParcelasFrom(ctx, String(id)));
  // As parcelas caem em vários meses (e às vezes no ano seguinte): o Orçamento também.
  if (r.apagados > 0) revalidatePath("/orcamento", "layout");
  return r;
}

/** Apaga as linhas (já filtradas pela dona) e devolve o snapshot de cada uma para o Desfazer. */
async function apagarComDesfazer(
  ctx: Sessao,
  linhasParaApagar: Awaited<ReturnType<typeof listSeriesFrom>>,
): Promise<{ apagados: number; jaNaCarteira: number; snapshots: DeletedEntrySnapshot[] }> {
  if (linhasParaApagar.length === 0) return { apagados: 0, jaNaCarteira: 0, snapshots: [] };
  const ids = linhasParaApagar.map((e) => e.id);
  const linhas = await allocationsOf(ctx, ids);
  const snapshots: DeletedEntrySnapshot[] = linhasParaApagar.map((e) => ({
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
    parcelamentoId: e.parcelamentoId,
    cartaoId: e.cartaoId,
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
    // O cartão vem do cliente: só volta se ainda for um cartão dela neste perfil.
    const cartao = typeof snapshot.cartaoId === "string" ? await cartaoDoPerfil(ctx, snapshot.cartaoId) : null;
    const entry = await createMonthlyEntry(ctx, {
      ...(cartao ? { cartaoId: cartao.id, noCartao: true } : {}),
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
      parcelamentoId: typeof snapshot.parcelamentoId === "string" && snapshot.parcelamentoId.length <= 40 ? snapshot.parcelamentoId : undefined,
    });
    if (typeof snapshot.divididoCom === "string" && snapshot.divididoCom.trim()) {
      const parte = Number(snapshot.parteDeOutro ?? 0);
      await prisma.monthlyEntry.update({
        where: { id: entry.id },
        data: { divididoCom: snapshot.divididoCom.trim().slice(0, 40), parteDeOutro: Number.isFinite(parte) && parte > 0 ? parte : null },
      });
    }
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
