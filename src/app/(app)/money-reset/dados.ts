import type { ParentCategory } from "@prisma/client";
import type { AuthContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { doDono } from "@/lib/auth/session";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { categoryLabel, PARENT_CATEGORIES } from "@/lib/categories";
import { listEntriesForMonths } from "@/lib/repositories/monthly-entry.repo";
import { getMonthlyPlan } from "@/lib/repositories/monthly-plan.repo";
import { getEmergencyFund } from "@/lib/repositories/emergency-fund.repo";
import { listGoalsWithProgress } from "@/lib/repositories/goal.repo";
import { getSavingsTargets } from "@/lib/planning/savings-targets";
import { splitSavings } from "@/lib/planning/savings-split";
import { courseShareOf } from "@/lib/planning/ideal-budget";
import { acharRecorrentes } from "@/lib/decisoes/raio-x";
import { carregarFoco } from "@/app/(app)/mensal/foco/dados";
import { getOwnUser } from "@/lib/repositories/user.repo";

/**
 * Os números de cada missão do Money Reset, com os dados DELA (o protótipo mostrava os da
 * Mariana da aula). Só carrega o que a tela do dia usa.
 */

function mesesAntes(ano: number, mes: number, n: number) {
  const out: { year: number; month: number }[] = [];
  for (let i = 1; i <= n; i++) {
    const d = new Date(ano, mes - 1 - i, 1);
    out.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  return out;
}

type Entrada = Awaited<ReturnType<typeof listEntriesForMonths>>[number];

/** A média por mês dos meses que TÊM lançamento (quem chegou há 2 meses não divide por 3). */
function media(entradas: Entrada[], filtro: (e: Entrada) => boolean) {
  const meses = new Set(entradas.map((e) => e.year * 12 + e.month));
  if (meses.size === 0) return { valor: 0, meses: 0 };
  const total = entradas.filter(filtro).reduce((s, e) => s + Number(e.amount), 0);
  return { valor: total / meses.size, meses: meses.size };
}

export type DadosDaMissao =
  | { dia: 3; entra: number; sai: number; meses: number }
  | { dia: 5; fixas: { chave: string; nome: string; mensal: number }[]; parcelas: number }
  | { dia: 6; categorias: { cat: ParentCategory; nome: string; voce: number; regua: number; valor: number }[]; renda: number }
  | { dia: 7; sai: number; pctDaRenda: number | null; fixas: number | null }
  | { dia: 11; guardar: number | null; renda: number | null }
  | { dia: 12; guardar: number | null; fatias: { nome: string; tipo: string; valor: number }[]; sobra: number }
  | { dia: 13; proximaFatura: number }
  | { dia: 14; livreSemana: number | null; ritmo: string | null }
  | { dia: 20; semana: number; mediaSemana: number }
  | { dia: 21; livreSemana: number | null; guardar: number | null; reserva: number | null; sonho: { nome: string; data: string | null } | null; ritmo: string | null }
  | { dia: number };

export async function carregarDadosDaMissao(ctx: AuthContext, dia: number, extras: { fixasTotal?: number } = {}): Promise<DadosDaMissao> {
  const agora = nowInBrazil();
  const ano = agora.getFullYear();
  const mes = agora.getMonth() + 1;
  const tres = () => listEntriesForMonths(ctx, mesesAntes(ano, mes, 3));
  const plano = () => getMonthlyPlan(ctx, ano, mes);

  switch (dia) {
    case 3: {
      const e = await tres();
      const entra = media(e, (x) => x.category === "INCOME");
      const sai = media(e, (x) => x.category === "EXPENSE");
      return { dia: 3, entra: entra.valor, sai: sai.valor, meses: sai.meses };
    }
    case 5: {
      const e = await listEntriesForMonths(ctx, mesesAntes(ano, mes, 4));
      const itens = acharRecorrentes(
        e.filter((x) => x.category === "EXPENSE").map((x) => ({ description: x.description, amount: Number(x.amount), year: x.year, month: x.month, parentCategory: x.parentCategory, subcategory: x.subcategory })),
        30,
        { essenciais: true },
      ).filter((i) => i.tipo === "assinatura");
      // Parcelas que já caem no mês que vem (a fatura importada lança as próximas sozinha).
      const prox = new Date(ano, mes, 1);
      const parcelas = await prisma.monthlyEntry.aggregate({ where: { ...doDono(ctx), year: prox.getFullYear(), month: prox.getMonth() + 1, category: "EXPENSE", importBatchId: { not: null } }, _sum: { amount: true } });
      return { dia: 5, fixas: itens.map((i) => ({ chave: i.chave, nome: i.nome, mensal: i.mensal })), parcelas: Number(parcelas._sum.amount ?? 0) };
    }
    case 6: {
      const e = await tres();
      const renda = media(e, (x) => x.category === "INCOME").valor;
      const categorias = PARENT_CATEGORIES.filter((c) => courseShareOf(c, ctx.profileKind) > 0).map((cat) => {
        const valor = media(e, (x) => x.category === "EXPENSE" && x.parentCategory === cat).valor;
        return { cat, nome: categoryLabel(ctx.categorias ?? ctx.profileKind, cat), voce: renda > 0 ? valor / renda : 0, regua: courseShareOf(cat, ctx.profileKind), valor };
      });
      return { dia: 6, categorias: categorias.sort((a, b) => b.voce - b.regua - (a.voce - a.regua)), renda };
    }
    case 7: {
      const e = await tres();
      const sai = media(e, (x) => x.category === "EXPENSE").valor;
      const entra = media(e, (x) => x.category === "INCOME").valor;
      return { dia: 7, sai, pctDaRenda: entra > 0 ? sai / entra : null, fixas: extras.fixasTotal ?? null };
    }
    case 11: {
      const p = await plano();
      return { dia: 11, guardar: p && p.plannedInvestment > 0 ? p.plannedInvestment : null, renda: p?.plannedIncome ?? null };
    }
    case 12: {
      const [p, alvos] = await Promise.all([plano(), getSavingsTargets(ctx)]);
      const guardar = p && p.plannedInvestment > 0 ? p.plannedInvestment : null;
      const { slices, leftover } = splitSavings(guardar ?? 0, alvos);
      return { dia: 12, guardar, fatias: slices.map((s) => ({ nome: s.name, tipo: s.kind, valor: s.amount })), sobra: leftover };
    }
    case 13: {
      const prox = new Date(ano, mes, 1);
      const r = await prisma.monthlyEntry.aggregate({ where: { ...doDono(ctx), year: prox.getFullYear(), month: prox.getMonth() + 1, category: "EXPENSE" }, _sum: { amount: true } });
      return { dia: 13, proximaFatura: Number(r._sum.amount ?? 0) };
    }
    case 14: {
      const [foco, user] = await Promise.all([carregarFoco(ctx), getOwnUser(ctx)]);
      const l = foco.foco.livre;
      return { dia: 14, livreSemana: l.tipo === "semana" || l.tipo === "mes" ? l.porSemana : null, ritmo: user.ritmoAcompanhamento ?? null };
    }
    case 20: {
      const desde = new Date(Date.now() - 7 * 86_400_000);
      const [semana, e] = await Promise.all([
        prisma.monthlyEntry.aggregate({ where: { ...doDono(ctx), category: "EXPENSE", entryDate: { gte: desde } }, _sum: { amount: true } }),
        tres(),
      ]);
      const mediaMes = media(e, (x) => x.category === "EXPENSE").valor;
      return { dia: 20, semana: Number(semana._sum.amount ?? 0), mediaSemana: mediaMes / 4.33 };
    }
    case 21: {
      const [foco, p, fund, goals, user] = await Promise.all([carregarFoco(ctx), plano(), getEmergencyFund(ctx), listGoalsWithProgress(ctx), getOwnUser(ctx)]);
      const l = foco.foco.livre;
      const sonho = goals.find((g) => g.targetDate) ?? goals[0] ?? null;
      return {
        dia: 21,
        livreSemana: l.tipo === "semana" || l.tipo === "mes" ? l.porSemana : null,
        guardar: p && p.plannedInvestment > 0 ? p.plannedInvestment : null,
        reserva: fund ? fund.targetMonths * Number(fund.monthlyExpenseBase) : null,
        sonho: sonho ? { nome: sonho.name, data: sonho.targetDate ? sonho.targetDate.toISOString().slice(0, 10) : null } : null,
        ritmo: user.ritmoAcompanhamento ?? null,
      };
    }
    default:
      return { dia };
  }
}
