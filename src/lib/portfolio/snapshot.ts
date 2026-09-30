import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { nowInBrazil } from "@/lib/date/brazil-now";

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Grava o snapshot de hoje se ainda não existir (upsert idempotente, chamar em toda
 * leitura do dashboard/insights não gera duplicatas nem sobrescreve o valor de dias
 * anteriores). É a única forma de reconstruir "quanto o patrimônio cresceu" no futuro,
 * já que Asset só guarda o valor atual.
 */
export async function recordPatrimonySnapshotIfNeeded(ctx: AuthContext, totalValue: number) {
  const today = startOfDay(nowInBrazil());
  await prisma.patrimonySnapshot.upsert({
    where: { userId_profileId_date: { userId: ctx.userId, profileId: ctx.profileId, date: today } },
    create: { userId: ctx.userId, profileId: ctx.profileId, date: today, totalValue },
    update: { totalValue },
  });
}

/** Snapshot mais próximo (na data ou antes dela) de N meses atrás, null se não houver histórico suficiente. */
export async function getPatrimonySnapshotMonthsAgo(ctx: AuthContext, monthsAgo: number) {
  const now = nowInBrazil();
  // Dia que não existe no mês de destino encosta no último dia dele: `new Date(ano, mês - N, 31)`
  // sozinho transbordava pro mês seguinte (29/02 "um ano atrás" virava 01/03; 31/03 "um mês
  // atrás" virava 03/03) e a comparação pegava um período mais curto do que o anunciado.
  const ultimoDiaDoDestino = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0).getDate();
  const targetDate = startOfDay(
    new Date(now.getFullYear(), now.getMonth() - monthsAgo, Math.min(now.getDate(), ultimoDiaDoDestino)),
  );
  const snapshot = await prisma.patrimonySnapshot.findFirst({
    where: { userId: ctx.userId, profileId: ctx.profileId, date: { lte: targetDate } },
    orderBy: { date: "desc" },
  });
  return snapshot ? Number(snapshot.totalValue) : null;
}

/** Maior valor de patrimônio já registrado ANTES de hoje, usado para detectar "novo recorde". */
export async function getPatrimonyAllTimeHighBeforeToday(ctx: AuthContext) {
  const today = startOfDay(nowInBrazil());
  const snapshot = await prisma.patrimonySnapshot.findFirst({
    where: { userId: ctx.userId, profileId: ctx.profileId, date: { lt: today } },
    orderBy: { totalValue: "desc" },
  });
  return snapshot ? Number(snapshot.totalValue) : null;
}
