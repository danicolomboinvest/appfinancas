import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { mediaDaRenda, mesesDaMedia, type RendaMedia } from "@/lib/planning/renda-media";

/**
 * A renda média do perfil de quem está logado (userId + profileId, como a renda típica que ela
 * substitui: a leitura que junta o casal fica só nas telas da proposta, ver casa/nunca-vaza).
 * Null quando não há entrada em nenhum dos 12 meses fechados.
 */
export async function getRendaMedia(ctx: AuthContext, hoje: Date = nowInBrazil()): Promise<RendaMedia | null> {
  const meses = mesesDaMedia(hoje);
  const linhas = await prisma.monthlyEntry.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, category: "INCOME", OR: meses },
    select: { year: true, month: true, amount: true, description: true },
  });
  return mediaDaRenda(
    linhas.map((l) => ({ year: l.year, month: l.month, amount: Number(l.amount), description: l.description })),
    hoje,
  );
}
