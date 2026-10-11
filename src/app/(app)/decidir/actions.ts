"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequiredSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { registrarDecisaoUnica } from "@/lib/repositories/decisao.repo";
import { chaveDaSemana } from "@/app/(app)/mensal/foco/ritmo";
import { ehEmpresa } from "@/lib/profiles/empresa";

/**
 * As respostas da pilha do Decidir (rodadas 38 e 49) que ainda não tinham uma ação pronta, e o
 * Desfazer de cada uma. Cobrir com outra categoria e o teto do mês usam as ações que já existem
 * (cobrirCategoriaAction, definirTetoAction). Tudo só no perfil de quem está logada.
 */

const idDoAviso = z.string().regex(/^[a-z]+(-[A-Za-z0-9_]+)?$/).max(80);
const escopo = z.enum(["mes", "semana"]);

function periodo(e: "mes" | "semana") {
  const now = nowInBrazil();
  return e === "semana" ? chaveDaSemana(now) : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function revalidarDecisoes() {
  revalidatePath("/decidir");
  revalidatePath("/mensal", "layout");
  revalidatePath("/orcamento", "layout");
  revalidatePath("/planejamento/metas", "layout");
}

/** Desfazer de "Deixar assim", "Usar o livre", "Foi pontual": o aviso volta para a pilha. */
export async function desfazerDispensaAction(itemId: string, quando: "mes" | "semana" = "mes") {
  const id = idDoAviso.parse(itemId);
  const e = escopo.parse(quando);
  const ctx = await getRequiredSession();
  await prisma.decisao.deleteMany({ where: { userId: ctx.userId, profileId: ctx.profileId, tipo: "aviso_dispensado", chave: `${periodo(e)}|${id}` } });
  revalidarDecisoes();
}

async function dispensar(ctx: Awaited<ReturnType<typeof getRequiredSession>>, id: string) {
  await registrarDecisaoUnica(ctx, { tipo: "aviso_dispensado", chave: `${periodo("mes")}|${id}` });
}

async function metaDela(goalId: string) {
  const ctx = await getRequiredSession();
  const meta = await prisma.goal.findFirst({ where: { id: goalId, userId: ctx.userId, profileId: ctx.profileId }, select: { id: true, monthlyContribution: true, targetDate: true } });
  return { ctx, meta };
}

export type MetaAntes = { goalId: string; monthlyContribution: number | null; targetDate: string | null };

/**
 * Meta atrasada, "Guardar mais R$ X por mês": o combinado da meta passa a ser o que ela pede para
 * chegar no prazo. O aviso sai da pilha até o mês virar (o atraso só some quando o dinheiro entra).
 */
export async function guardarMaisNaMetaAction(goalId: string, porMes: number): Promise<MetaAntes | null> {
  const id = z.string().min(1).max(60).parse(goalId);
  const valor = z.number().positive().max(100_000_000).parse(Math.ceil(porMes));
  const { ctx, meta } = await metaDela(id);
  if (!meta) return null;
  await prisma.goal.updateMany({ where: { id, userId: ctx.userId, profileId: ctx.profileId }, data: { monthlyContribution: valor } });
  await dispensar(ctx, `meta-${id}`);
  revalidarDecisoes();
  return { goalId: id, monthlyContribution: meta.monthlyContribution === null ? null : Number(meta.monthlyContribution), targetDate: meta.targetDate?.toISOString() ?? null };
}

/** Meta atrasada, "Mudar a data": o prazo vira o mês em que ela chega no ritmo de hoje. */
export async function mudarDataDaMetaAction(goalId: string, ano: number, mes: number): Promise<MetaAntes | null> {
  const id = z.string().min(1).max(60).parse(goalId);
  const a = z.number().int().min(2000).max(2100).parse(ano);
  const m = z.number().int().min(1).max(12).parse(mes);
  const { ctx, meta } = await metaDela(id);
  if (!meta) return null;
  await prisma.goal.updateMany({ where: { id, userId: ctx.userId, profileId: ctx.profileId }, data: { targetDate: new Date(Date.UTC(a, m - 1, 1)) } });
  await dispensar(ctx, `meta-${id}`);
  revalidarDecisoes();
  return { goalId: id, monthlyContribution: meta.monthlyContribution === null ? null : Number(meta.monthlyContribution), targetDate: meta.targetDate?.toISOString() ?? null };
}

/** Desfazer da meta: volta o valor e a data de antes, e o aviso volta para a pilha. */
export async function restaurarMetaAction(antes: MetaAntes) {
  const id = z.string().min(1).max(60).parse(antes.goalId);
  const valor = antes.monthlyContribution === null ? null : z.number().min(0).max(100_000_000).parse(antes.monthlyContribution);
  const data = antes.targetDate === null ? null : new Date(z.string().datetime().parse(antes.targetDate));
  const { ctx, meta } = await metaDela(id);
  if (!meta) return;
  await prisma.goal.updateMany({ where: { id, userId: ctx.userId, profileId: ctx.profileId }, data: { monthlyContribution: valor, targetDate: data } });
  await prisma.decisao.deleteMany({ where: { userId: ctx.userId, profileId: ctx.profileId, tipo: "aviso_dispensado", chave: `${periodo("mes")}|meta-${id}` } });
  revalidarDecisoes();
}

/**
 * Reserva curta, "Mandar a sobra do mês": fica combinado, e o aviso sai até o mês virar. O
 * dinheiro vai de verdade no "Fechar o mês" (que já oferece mandar a sobra para a reserva), porque
 * a sobra só existe quando o mês acaba.
 */
export async function combinarSobraNaReservaAction(valor: number) {
  const v = z.number().min(0).max(100_000_000).parse(valor);
  const ctx = await getRequiredSession();
  await registrarDecisaoUnica(ctx, { tipo: "reserva_sobra_combinada", chave: periodo("mes"), valor: v });
  await dispensar(ctx, "reserva");
  revalidarDecisoes();
}

export async function desfazerSobraNaReservaAction() {
  const ctx = await getRequiredSession();
  await prisma.decisao.deleteMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, OR: [{ tipo: "reserva_sobra_combinada", chave: periodo("mes") }, { tipo: "aviso_dispensado", chave: `${periodo("mes")}|reserva` }] },
  });
  revalidarDecisoes();
}

/**
 * "Já guardei" (falta guardar o do mês): lança o aporte que falta no mês. Devolve o id para o
 * Desfazer apagar exatamente esse lançamento. O valor é recalculado aqui, nunca o da tela.
 */
export async function guardeiOQueFaltaAction(): Promise<string | null> {
  const ctx = await getRequiredSession();
  const now = nowInBrazil();
  const ano = now.getFullYear();
  const mes = now.getMonth() + 1;
  const [plano, guardado] = await Promise.all([
    prisma.monthlyPlan.findFirst({ where: { userId: ctx.userId, profileId: ctx.profileId, year: ano, month: mes }, select: { plannedInvestment: true } }),
    prisma.monthlyEntry.aggregate({ where: { userId: ctx.userId, profileId: ctx.profileId, year: ano, month: mes, category: "INVESTMENT_CONTRIBUTION" }, _sum: { amount: true } }),
  ]);
  const falta = Math.round((Number(plano?.plannedInvestment ?? 0) - Number(guardado._sum.amount ?? 0)) * 100) / 100;
  if (!(falta >= 1)) return null;
  const e = await prisma.monthlyEntry.create({
    data: {
      userId: ctx.userId, profileId: ctx.profileId,
      year: ano,
      month: mes,
      category: "INVESTMENT_CONTRIBUTION",
      description: ehEmpresa(ctx.profileKind) ? "Retenção do mês" : "Aporte do mês",
      amount: falta,
      entryDate: new Date(Date.UTC(ano, mes - 1, now.getDate())),
    },
    select: { id: true },
  });
  revalidarDecisoes();
  return e.id;
}

export async function apagarAporteDaPilhaAction(entryId: string) {
  const id = z.string().min(1).max(60).parse(entryId);
  const ctx = await getRequiredSession();
  await prisma.monthlyEntry.deleteMany({ where: { id, userId: ctx.userId, profileId: ctx.profileId, category: "INVESTMENT_CONTRIBUTION" } });
  revalidarDecisoes();
}

/** Desfazer no Raio-X: o gasto volta para os abertos. */
export async function desfazerRaioXAction(chave: string) {
  const k = z.string().min(1).max(200).parse(chave);
  const ctx = await getRequiredSession();
  await prisma.decisao.deleteMany({ where: { userId: ctx.userId, profileId: ctx.profileId, chave: k, tipo: { in: ["raiox_cancelar", "raiox_metade", "raiox_manter"] } } });
  revalidatePath("/decidir/raio-x");
  revalidatePath("/decidir");
  revalidatePath("/mensal/foco");
}
