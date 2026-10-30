import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { mediaDaRenda, mediaDosAportes, mesesDaMedia, type RendaMedia } from "@/lib/planning/renda-media";
import { getMonthlyPlan } from "@/lib/repositories/monthly-plan.repo";
import { limiteDasMetas, type LimiteDasMetas } from "@/lib/metas/prazo-que-cabe";

/**
 * A renda média do perfil de quem está logado (userId + profileId, como a renda típica que ela
 * substitui: a leitura que junta o casal fica só nas telas da proposta, ver casa/nunca-vaza).
 * Null quando não há entrada em nenhum dos 12 meses fechados.
 */
export async function getRendaMedia(ctx: AuthContext, hoje: Date = nowInBrazil()): Promise<RendaMedia | null> {
  const meses = mesesDaMedia(hoje);
  // O nome dela: o Pix recebido da própria conta em outro banco não é renda (ver ehRendaDeVerdade).
  const [linhas, usuario] = await Promise.all([
    prisma.monthlyEntry.findMany({
      where: { userId: ctx.userId, profileId: ctx.profileId, category: "INCOME", OR: meses },
      select: { year: true, month: true, amount: true, description: true },
    }),
    prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } }),
  ]);
  return mediaDaRenda(
    linhas.map((l) => ({ year: l.year, month: l.month, amount: Number(l.amount), description: l.description })),
    hoje,
    usuario?.name ?? null,
  );
}

/** O que ela guardou por mês, em média, nos 12 meses fechados (só os meses com aporte). */
export async function getAporteMedio(ctx: AuthContext, hoje: Date = nowInBrazil()): Promise<number | null> {
  const linhas = await prisma.monthlyEntry.groupBy({
    by: ["year", "month"],
    where: { userId: ctx.userId, profileId: ctx.profileId, category: "INVESTMENT_CONTRIBUTION", OR: mesesDaMedia(hoje) },
    _sum: { amount: true },
  });
  return mediaDosAportes(
    linhas.map((l) => ({ year: l.year, month: l.month, amount: Number(l._sum.amount ?? 0) })),
    hoje,
  );
}

/**
 * Quanto cabe guardar por mês nas metas (ver lib/metas/prazo-que-cabe): o "quanto guardar" do
 * plano do mês, 20% da renda (plano ou média de 12 meses) ou os aportes médios. Null sem nada.
 */
export async function getLimiteDasMetas(ctx: AuthContext, hoje: Date = nowInBrazil()): Promise<LimiteDasMetas | null> {
  const [plano, renda] = await Promise.all([getMonthlyPlan(ctx, hoje.getFullYear(), hoje.getMonth() + 1), getRendaMedia(ctx, hoje)]);
  const semRenda = !(plano && plano.plannedInvestment > 0) && !(plano && plano.plannedIncome > 0) && !renda;
  return limiteDasMetas({
    planoGuardar: plano?.plannedInvestment,
    planoRenda: plano?.plannedIncome,
    rendaMedia: renda?.valor,
    // Os aportes só importam quando nada acima diz o limite: uma leitura a menos no caso comum.
    aporteMedio: semRenda ? await getAporteMedio(ctx, hoje) : null,
  });
}
