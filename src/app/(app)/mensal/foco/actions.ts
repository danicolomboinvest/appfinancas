"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequiredSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { existeDecisao, registrarDecisao, registrarDecisaoUnica, resolverCompraAmanha, travarNaTransacao } from "@/lib/repositories/decisao.repo";
import { applyBudgetToWholeYear, applyBudgetToWholeYearForCustomCategory } from "@/lib/repositories/budget.repo";
import { applyMonthlyPlanToWholeYear } from "@/lib/repositories/monthly-plan.repo";
import { createRecurringMonthlyEntries, updateOwnMonthlyEntriesCategory } from "@/lib/repositories/monthly-entry.repo";
import { upsertTransactionRule } from "@/lib/repositories/transaction-rule.repo";
import { serverMoney } from "@/lib/money-server";
import { carregarViradaDoAno } from "./ano/dados";
import { ehEmpresa } from "@/lib/profiles/empresa";
import { MESES } from "./dados";
import { chaveRaioX } from "@/lib/decisoes/raio-x";
import { classificarAntigo, type TipoRevisao } from "@/lib/decisoes/revisao-antigos";
import { classify, normalizeMerchant } from "@/lib/import/classify";
import { upsertBudget } from "@/lib/repositories/budget.repo";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { PARENT_CATEGORIES } from "@/lib/categories";
import type { ParentCategory } from "@prisma/client";
import { chaveDaSemana, type Ritmo } from "./ritmo";

/** Semanal ou mensal. Vale pra conta toda (é o jeito da PESSOA, não do perfil). */
export async function escolherRitmoAction(ritmo: Ritmo) {
  if (ritmo !== "semanal" && ritmo !== "mensal") return;
  const ctx = await getRequiredSession();
  await prisma.user.update({ where: { id: ctx.userId }, data: { ritmoAcompanhamento: ritmo } });
  revalidatePath("/mensal/foco");
}

const compraSchema = z.object({
  tipo: z.enum(["compra_desisti", "compra_amanha", "compra_comprei"]),
  // Valor enorme ou descrição longa não podem derrubar a tela: corta em vez de recusar.
  valor: z.number().positive().transform((v) => Math.min(v, 100_000_000)),
  descricao: z.string().optional().transform((s) => s?.slice(0, 120)),
  modo: z.enum(["vista", "parcelado"]),
  parcelas: z.number().int().min(1).max(48),
});

/** O que a pessoa decidiu no "Posso comprar?". Só registra: não lança gasto nenhum. */
export async function registrarCompraAction(input: z.infer<typeof compraSchema>) {
  const d = compraSchema.parse(input);
  const ctx = await getRequiredSession();
  await registrarDecisao(ctx, {
    tipo: d.tipo,
    valor: d.valor,
    descricao: d.descricao?.trim() || "Compra",
    dados: { modo: d.modo, parcelas: d.parcelas },
  });
  revalidatePath("/mensal/foco");
}

export async function responderCompraAmanhaAction(id: string, desistiu: boolean) {
  const ctx = await getRequiredSession();
  await resolverCompraAmanha(ctx, z.string().min(1).parse(id), Boolean(desistiu));
  revalidatePath("/mensal/foco");
}

const tetoSchema = z.object({ categoria: z.string().min(1).max(60), valor: z.number().min(0).max(100_000_000) });

/** "Teto de R$ 90 até o fim do mês" numa categoria. Um por categoria por mês. */
export async function definirTetoAction(input: z.infer<typeof tetoSchema>) {
  const d = tetoSchema.parse(input);
  const ctx = await getRequiredSession();
  const now = nowInBrazil();
  const anoMes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  await registrarDecisaoUnica(ctx, { tipo: "teto", chave: `${anoMes}|${d.categoria}`, valor: d.valor });
  revalidatePath("/mensal/foco");
}

/**
 * "Já transferi": lança o aporte do mês que faltava. O valor é recalculado aqui (planejado −
 * já lançado), nunca o da tela: uma aba aberta desde segunda não lança o mesmo aporte duas vezes.
 */
export async function registrarAporteDoMesAction(): Promise<boolean> {
  const ctx = await getRequiredSession();
  const now = nowInBrazil();
  const ano = now.getFullYear();
  const mes = now.getMonth() + 1;
  return prisma.$transaction(async (tx) => {
    await travarNaTransacao(tx, `${ctx.userId}|${ctx.profileId ?? ""}|aporte|${ano}-${mes}`);
    const [plano, guardado] = await Promise.all([
      tx.monthlyPlan.findFirst({ where: { userId: ctx.userId, profileId: ctx.profileId, year: ano, month: mes }, select: { plannedInvestment: true } }),
      tx.monthlyEntry.aggregate({ where: { userId: ctx.userId, profileId: ctx.profileId, year: ano, month: mes, category: "INVESTMENT_CONTRIBUTION" }, _sum: { amount: true } }),
    ]);
    const falta = Math.round((Number(plano?.plannedInvestment ?? 0) - Number(guardado._sum.amount ?? 0)) * 100) / 100;
    if (!(falta >= 1)) return false;
    await tx.monthlyEntry.create({
      data: {
        userId: ctx.userId, profileId: ctx.profileId,
        year: ano,
        month: mes,
        category: "INVESTMENT_CONTRIBUTION",
        description: ehEmpresa(ctx.profileKind) ? "Retenção do mês" : "Aporte do mês",
        amount: falta,
        entryDate: new Date(Date.UTC(ano, mes - 1, now.getDate())),
      },
    });
    return true;
  }).finally(() => revalidatePath("/mensal", "layout"));
}

/**
 * "Mandar a sobra de agosto pra reserva", no fechamento. O aporte entra em AGOSTO (o mês de onde
 * o dinheiro sobrou), não no mês atual: assim ele não conta como o aporte deste mês, e a sobra de
 * agosto vira zero — voltar ao fechamento não oferece o mesmo dinheiro de novo. O valor é
 * recalculado aqui, nunca o que veio da tela, dentro de uma transação travada: duas abas não
 * mandam a mesma sobra duas vezes. A reserva cresce junto.
 */
export async function mandarSobraPraReservaAction(ano: number, mes: number): Promise<boolean> {
  const ctx = await getRequiredSession();
  const now = nowInBrazil();
  const anterior = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  if (ano !== anterior.getFullYear() || mes !== anterior.getMonth() + 1) return false;
  const empresa = ehEmpresa(ctx.profileKind);
  const ok = await prisma.$transaction(async (tx) => {
    await travarNaTransacao(tx, `${ctx.userId}|${ctx.profileId ?? ""}|sobra|${ano}-${mes}`);
    const fundo = await tx.emergencyFund.findFirst({ where: { userId: ctx.userId, profileId: ctx.profileId }, select: { id: true, currentAmount: true, targetAmount: true } });
    if (!fundo || Number(fundo.currentAmount) >= Number(fundo.targetAmount)) return false;
    const somas = await tx.monthlyEntry.groupBy({ by: ["category"], where: { userId: ctx.userId, profileId: ctx.profileId, year: ano, month: mes }, _sum: { amount: true } });
    const soma = (c: string) => Number(somas.find((x) => x.category === c)?._sum.amount ?? 0);
    // Nunca passa do que falta pra reserva ficar completa.
    const faltaNaReserva = Number(fundo.targetAmount) - Number(fundo.currentAmount);
    const sobra = Math.min(faltaNaReserva, Math.round((soma("INCOME") - soma("EXPENSE") - soma("INVESTMENT_CONTRIBUTION")) * 100) / 100);
    if (!(sobra >= 1)) return false;
    // Sem gasto de verdade no mês (só contas fixas automáticas, parcelas criadas antes), a sobra
    // é "renda − fixos": não é dinheiro que sobrou, e não vai pra reserva.
    const reais = await tx.monthlyEntry.count({
      where: { userId: ctx.userId, profileId: ctx.profileId, year: ano, month: mes, category: "EXPENSE", createdAt: { gte: new Date(Date.UTC(ano, mes - 1, 1, 3)) } },
    });
    if (reais === 0) return false;
    await tx.monthlyEntry.create({
      data: {
        userId: ctx.userId, profileId: ctx.profileId,
        year: ano,
        month: mes,
        category: "INVESTMENT_CONTRIBUTION",
        description: `Sobra de ${MESES[mes - 1]} ${empresa ? "pro caixa de segurança" : "pra reserva"}`,
        amount: sobra,
        entryDate: new Date(Date.UTC(ano, mes, 0)),
      },
    });
    await tx.emergencyFund.updateMany({ where: { id: fundo.id, userId: ctx.userId, profileId: ctx.profileId }, data: { currentAmount: { increment: sobra } } });
    return true;
  });
  revalidatePath("/mensal", "layout");
  revalidatePath("/planejamento/reserva-emergencia");
  return ok;
}

/** "Subir o orçamento de Restaurantes pra R$ 850" — só o mês atual. */
export async function ajustarOrcamentoAction(categoria: string, valor: number) {
  if (!(PARENT_CATEGORIES as readonly string[]).includes(categoria)) return;
  const v = z.number().positive().max(100_000_000).parse(valor);
  const ctx = await getRequiredSession();
  const now = nowInBrazil();
  await upsertBudget(ctx, { year: now.getFullYear(), month: now.getMonth() + 1, parentCategory: categoria as ParentCategory, plannedAmount: v });
  revalidatePath("/mensal", "layout");
  revalidatePath("/orcamento", "layout");
}

/** Fechou o ritual da semana ("2026-W40") ou o mês ("2026-08"). */
export async function concluirRitualAction(tipo: "ritual" | "fechamento", chave: string, resumo: string) {
  if (tipo !== "ritual" && tipo !== "fechamento") return;
  const k = z.string().regex(/^\d{4}-(W\d{2}|\d{2})$/).parse(chave);
  const texto = z.string().catch("").parse(resumo).slice(0, 200);
  const ctx = await getRequiredSession();
  await registrarDecisaoUnica(ctx, { tipo, chave: k, descricao: texto });
  revalidatePath("/mensal/foco");
}

const erradoSchema = z.object({
  tela: z.string().max(80),
  motivo: z.string().max(80),
  texto: z.string().max(500).optional(),
  regra: z.string().max(200).optional(),
});

/** "Isso está errado?": vai pra fila da Dani. Guarda a tela e a regra, nunca o extrato. */
export async function reportarRespostaErradaAction(input: z.infer<typeof erradoSchema>) {
  const d = erradoSchema.parse(input);
  const ctx = await getRequiredSession();
  await registrarDecisao(ctx, { tipo: "resposta_errada", descricao: d.tela, dados: { motivo: d.motivo, texto: d.texto ?? "", regra: d.regra ?? "" } });
}

const raioxSchema = z.object({
  chave: z.string().min(3).max(120),
  nome: z.string().max(80),
  decisao: z.enum(["raiox_cancelar", "raiox_metade", "raiox_manter"]),
  economiaAnual: z.number().min(0).max(10_000_000),
});

/** Uma decisão do Raio-X por gasto recorrente: mudar de ideia substitui a anterior. */
export async function decidirRaioXAction(input: z.infer<typeof raioxSchema>) {
  const d = raioxSchema.parse(input);
  const ctx = await getRequiredSession();
  await registrarDecisaoUnica(
    ctx,
    { tipo: d.decisao, chave: d.chave, valor: d.economiaAnual, descricao: d.nome },
    ["raiox_cancelar", "raiox_metade", "raiox_manter"],
  );
  revalidatePath("/decidir/raio-x");
  revalidatePath("/mensal/foco");
}

/** Casal: a renda deste perfil é a do casal inteira, ou só o que cada um põe na conta conjunta? */
export async function responderRendaDoCasalAction(resposta: "casal" | "conjunta") {
  if (resposta !== "casal" && resposta !== "conjunta") return;
  const ctx = await getRequiredSession();
  await registrarDecisaoUnica(ctx, { tipo: "casal_renda", chave: "renda", descricao: resposta });
  revalidatePath("/decidir/comprar");
}

/**
 * "Você cancelou a Netflix, como tinha dito?" Sim: as cobranças FUTURAS que já estavam lançadas
 * (cópias da despesa recorrente, criadas antes do mês delas) saem, deste mês em diante — senão o
 * app seguiria contando uma assinatura que não existe mais. O que veio de extrato/fatura fica.
 * Não: pergunta de novo no mês que vem.
 */
export async function confirmarCancelamentoRaioXAction(chave: string, cancelou: boolean) {
  const k = z.string().min(3).max(120).parse(chave);
  const ctx = await getRequiredSession();
  const now = nowInBrazil();
  const ano = now.getFullYear();
  const mes = now.getMonth() + 1;
  if (cancelou) {
    const futuras = await prisma.monthlyEntry.findMany({
      where: {
        userId: ctx.userId, profileId: ctx.profileId,
        category: "EXPENSE",
        importBatchId: null,
        externalId: null,
        OR: [{ year: { gt: ano } }, { year: ano, month: { gte: mes } }],
      },
      select: { id: true, year: true, month: true, createdAt: true, description: true },
    });
    const apagar = futuras
      .filter((e) => e.description && e.createdAt.getTime() < Date.UTC(e.year, e.month - 1, 1, 3) && chaveRaioX(e.description) === k)
      .map((e) => e.id);
    if (apagar.length > 0) await prisma.monthlyEntry.deleteMany({ where: { id: { in: apagar }, userId: ctx.userId, profileId: ctx.profileId } });
    await registrarDecisaoUnica(ctx, { tipo: "raiox_confirmacao", chave: `${k}|sim`, descricao: `${apagar.length} cobranças futuras removidas` });
  } else {
    await registrarDecisaoUnica(ctx, { tipo: "raiox_confirmacao", chave: `${k}|nao|${ano}-${String(mes).padStart(2, "0")}` });
  }
  revalidatePath("/mensal", "layout");
  revalidatePath("/decidir/raio-x");
}

/**
 * Virada do ano: "começar com a sugestão" grava o orçamento (deste mês até dezembro), o plano do
 * mês (renda e quanto guardar) e as contas fixas do ano passado no ano novo. "Começar do zero"
 * só registra a escolha. A sugestão é recalculada aqui, nunca a que veio da tela.
 */
export async function comecarAnoAction(modo: "sugestao" | "zerado"): Promise<boolean> {
  if (modo !== "sugestao" && modo !== "zerado") return false;
  const ctx = await getRequiredSession();
  const money = await serverMoney();
  const v = await carregarViradaDoAno(ctx, (x) => money(x, { round: true }));
  const chave = String(v.ano);
  if (await existeDecisao(ctx, "virada_ano", chave)) return false;
  if (modo === "sugestao") {
    for (const c of v.sugestao.categorias) {
      if (!(c.sugerido > 0)) continue;
      if (c.mae) await applyBudgetToWholeYear(ctx, { year: v.ano, parentCategory: c.key as ParentCategory, plannedAmount: c.sugerido });
      else await applyBudgetToWholeYearForCustomCategory(ctx, { year: v.ano, customCategoryId: c.key, plannedAmount: c.sugerido });
    }
    if (v.sugestao.renda > 0) await applyMonthlyPlanToWholeYear(ctx, v.ano, { plannedIncome: v.sugestao.renda, plannedInvestment: v.sugestao.guardar });
    const now = nowInBrazil();
    const mes = now.getFullYear() === v.ano ? now.getMonth() + 1 : 1;
    // Não recria a conta fixa que ela já lançou no ano novo (mesma descrição e valor neste mês).
    const jaNoMes = await prisma.monthlyEntry.findMany({
      where: { userId: ctx.userId, profileId: ctx.profileId, year: v.ano, month: mes, category: "EXPENSE" },
      select: { description: true, amount: true },
    });
    const existe = new Set(jaNoMes.map((e) => `${(e.description ?? "").trim().toLowerCase()}|${Number(e.amount).toFixed(2)}`));
    for (const f of v.fixas) {
      if (existe.has(`${f.descricao.trim().toLowerCase()}|${f.valor.toFixed(2)}`)) continue;
      const ultimoDia = new Date(v.ano, mes, 0).getDate();
      await createRecurringMonthlyEntries(ctx, {
        year: v.ano,
        month: mes,
        category: "EXPENSE",
        parentCategory: f.parentCategory ?? undefined,
        customCategoryId: f.customCategoryId ?? undefined,
        subcategory: f.subcategory ?? undefined,
        description: f.descricao,
        amount: f.valor,
        entryDate: f.dia ? new Date(Date.UTC(v.ano, mes - 1, Math.min(f.dia, ultimoDia), 12)) : undefined,
      });
    }
  }
  await registrarDecisaoUnica(ctx, { tipo: "virada_ano", chave, descricao: modo });
  revalidatePath("/mensal", "layout");
  revalidatePath("/orcamento", "layout");
  return true;
}

/**
 * Revisão de um lançamento antigo que parece dinheiro dela mesma ou estorno. O tipo é
 * recalculado aqui a partir do lançamento (nunca o que veio da tela), e só as ações que fazem
 * sentido pra ele são aceitas:
 * - "guardado": vira aporte (aplicação, dinheiro que ela guardou);
 * - "tirar": sai do app (pagamento de fatura já detalhada, dinheiro só mudando de conta, resgate);
 * - "estorno": vira gasto negativo na categoria da compra;
 * - "manter": fica como está, e não é perguntado de novo.
 */
export async function resolverLancamentoAntigoAction(entryId: string, acao: "guardado" | "tirar" | "estorno" | "manter") {
  const id = z.string().min(1).max(60).parse(entryId);
  const ctx = await getRequiredSession();
  const entrada = await prisma.monthlyEntry.findFirst({
    where: { id, userId: ctx.userId, profileId: ctx.profileId },
    select: { id: true, category: true, description: true, amount: true, year: true, month: true },
  });
  if (!entrada) return;
  const [usuario, faturas] = await Promise.all([
    prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } }),
    prisma.importBatch.count({ where: { userId: ctx.userId, profileId: ctx.profileId, docType: "fatura" } }),
  ]);
  const tipo = classificarAntigo({ category: entrada.category, description: entrada.description, amount: Number(entrada.amount) }, usuario?.name ?? null, faturas > 0);
  const permitidas: Record<TipoRevisao, string[]> = {
    aplicacao: ["guardado", "manter"],
    fatura: ["tirar", "manter"],
    conta_propria_saida: ["guardado", "tirar", "manter"],
    conta_propria_entrada: ["tirar", "manter"],
    resgate: ["tirar", "manter"],
    estorno: ["estorno", "manter"],
  };
  if (!tipo || !permitidas[tipo].includes(acao)) return;
  const onde = { id: entrada.id, userId: ctx.userId, profileId: ctx.profileId };
  if (acao === "guardado") {
    await prisma.monthlyEntry.updateMany({ where: onde, data: { category: "INVESTMENT_CONTRIBUTION", parentCategory: null, customCategoryId: null, subcategory: null } });
  } else if (acao === "tirar") {
    await prisma.monthlyEntry.deleteMany({ where: onde });
  } else if (acao === "estorno") {
    const categoria = classify(entrada.description ?? "", [], ctx.profileKind)?.parentCategory ?? "OUTROS";
    await prisma.monthlyEntry.updateMany({ where: onde, data: { category: "EXPENSE", amount: -Math.abs(Number(entrada.amount)), parentCategory: categoria, customCategoryId: null } });
  }
  await registrarDecisaoUnica(ctx, { tipo: "revisao_lancamento", chave: entrada.id, descricao: acao });
  revalidatePath("/mensal", "layout");
}

/**
 * "Foi pontual, sigo o plano" / "Entendi" num aviso do Foco: ele some até o mês virar. O aviso de
 * guardar ("vou transferir essa semana") some só até a semana virar.
 */
export async function dispensarAvisoAction(itemId: string, escopo: "mes" | "semana") {
  const id = z.string().regex(/^[a-z]+(-[A-Za-z0-9_]+)?$/).max(80).parse(itemId);
  const ctx = await getRequiredSession();
  const now = nowInBrazil();
  const periodo = escopo === "semana" ? chaveDaSemana(now) : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  await registrarDecisaoUnica(ctx, { tipo: "aviso_dispensado", chave: `${periodo}|${id}` });
  revalidatePath("/mensal/foco");
}

/**
 * Classificar um gasto na hora, de dentro de um aviso do Foco: põe na categoria escolhida (ou
 * marca como aplicação, que é guardar e não gasto) e ensina o app, pra próxima importação já
 * vir certa. Só categorias do próprio perfil.
 */
export async function classificarGastoAction(entryId: string, destino: string) {
  const id = z.string().min(1).max(60).parse(entryId);
  const alvo = z.string().min(1).max(60).parse(destino);
  const ctx = await getRequiredSession();
  const gasto = await prisma.monthlyEntry.findFirst({ where: { id, userId: ctx.userId, profileId: ctx.profileId, category: "EXPENSE" }, select: { id: true, description: true } });
  if (!gasto) return false;
  if (alvo === "aplicacao") {
    await prisma.monthlyEntry.updateMany({ where: { id, userId: ctx.userId, profileId: ctx.profileId }, data: { category: "INVESTMENT_CONTRIBUTION", parentCategory: null, customCategoryId: null, subcategory: null } });
  } else if ((PARENT_CATEGORIES as readonly string[]).includes(alvo)) {
    await updateOwnMonthlyEntriesCategory(ctx, [id], { parentCategory: alvo as ParentCategory, customCategoryId: null });
    const padrao = gasto.description ? normalizeMerchant(gasto.description) : "";
    if (padrao) await upsertTransactionRule(ctx, { pattern: padrao, parentCategory: alvo as ParentCategory });
  } else {
    const propria = await prisma.customCategory.findFirst({ where: { id: alvo, userId: ctx.userId, profileId: ctx.profileId }, select: { id: true } });
    if (!propria) return false;
    await updateOwnMonthlyEntriesCategory(ctx, [id], { parentCategory: null, customCategoryId: propria.id });
  }
  revalidatePath("/mensal", "layout");
  revalidatePath("/orcamento", "layout");
  return true;
}
