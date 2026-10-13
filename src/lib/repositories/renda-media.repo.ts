import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { comFiltro, lancamentosDosTotais } from "@/lib/casa/regras";
import { mediaDaRenda, mesesDaMedia, type RendaMedia } from "@/lib/planning/renda-media";

/**
 * A renda média do perfil (o mesmo conjunto de lançamentos dos totais do Resumo: no casal, os
 * dela e os visíveis do outro). Null quando não há entrada em nenhum dos 12 meses fechados.
 */
export async function getRendaMedia(ctx: AuthContext, hoje: Date = nowInBrazil()): Promise<RendaMedia | null> {
  const meses = mesesDaMedia(hoje);
  const linhas = await prisma.monthlyEntry.findMany({
    where: comFiltro(lancamentosDosTotais(ctx), { category: "INCOME", OR: meses }),
    select: { year: true, month: true, amount: true, description: true },
  });
  return mediaDaRenda(
    linhas.map((l) => ({ year: l.year, month: l.month, amount: Number(l.amount), description: l.description })),
    hoje,
  );
}
