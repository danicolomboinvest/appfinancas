"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession, doDono } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { upsertPlanningParams } from "@/lib/repositories/planning-params.repo";
import { planningParamsSchema } from "@/lib/validations/planning-params.schema";
import { TAXA_PADRAO_DAS_METAS } from "@/lib/metas/projecao";
import { paraParametros, patrimonioNecessario, prazoDaLiberdade, type ValoresDaLiberdade } from "@/lib/calculadoras/liberdade";

const NOME_DA_META_LIBERDADE = "Liberdade financeira";

/**
 * "Salvar como meta" da calculadora Liberdade (11/10/2026): grava a conta em PlanningParams (o
 * mesmo lugar que a Aposentadoria antiga gravava, e que a Estratégia da Carteira lê) e cria a meta
 * "Liberdade financeira" com o valor e o prazo da conta. Se ela já existe, é atualizada (o que já
 * foi guardado nela continua).
 */
export async function salvarLiberdadeComoMetaAction(v: ValoresDaLiberdade): Promise<{ ok: true; id: string; criada: boolean } | { ok: false; erro: string }> {
  const p = planningParamsSchema.safeParse(paraParametros(v));
  if (!p.success) return { ok: false, erro: p.error.issues[0]?.message ?? "Confira os números." };
  const alvo = patrimonioNecessario(v);
  if (alvo === null || alvo <= 0) return { ok: false, erro: "Diga quanto quer por mês e um rendimento acima de zero." };
  const ctx = await getRequiredSession();
  const hoje = nowInBrazil();
  const prazo = prazoDaLiberdade(v, hoje);
  const targetDate = new Date(prazo.ano, prazo.mes - 1, 1, 12);

  await upsertPlanningParams(ctx, p.data);
  const existente = await prisma.goal.findFirst({
    where: { ...doDono(ctx), name: { equals: NOME_DA_META_LIBERDADE, mode: "insensitive" } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  const dados = { name: NOME_DA_META_LIBERDADE, icon: "APOSENTADORIA" as const, targetAmount: alvo, targetDate, monthlyContribution: Math.max(0, Math.round(v.porMes * 100) / 100) };
  const meta = existente
    ? await prisma.goal.update({ where: { id: existente.id }, data: dados, select: { id: true } })
    : await prisma.goal.create({ data: { ...doDono(ctx), ...dados, currentAmount: 0, annualRate: TAXA_PADRAO_DAS_METAS, status: "NOT_STARTED" }, select: { id: true } });

  revalidatePath("/planejamento/metas");
  revalidatePath(`/planejamento/metas/${meta.id}`);
  revalidatePath("/carteira/estrategia");
  revalidatePath("/mensal/foco");
  return { ok: true, id: meta.id, criada: !existente };
}
