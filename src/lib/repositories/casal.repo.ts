import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { calcularAcerto, chaveDoMes, lerConfigCasal, type Acerto, type ConfigCasal } from "@/lib/casal/acerto";

/** O perfil Casal ativo: nomes, forma de divisão e meses acertados. */
export async function lerConfigDoCasal(ctx: AuthContext): Promise<ConfigCasal> {
  const perfil = await prisma.financialProfile.findFirst({ where: { id: ctx.profileId, userId: ctx.userId }, select: { casal: true } });
  return lerConfigCasal(perfil?.casal ?? null);
}

export async function salvarConfigDoCasal(ctx: AuthContext, config: ConfigCasal) {
  await prisma.financialProfile.updateMany({ where: { id: ctx.profileId, userId: ctx.userId }, data: { casal: config } });
}

export type AcertoDoMes = Acerto & { config: ConfigCasal; acertado: boolean; ano: number; mes: number };

/** O acerto de um mês do perfil Casal ativo, a partir dos lançamentos dele. */
export async function carregarAcertoDoMes(ctx: AuthContext, ano: number, mes: number): Promise<AcertoDoMes> {
  const [config, lancamentos] = await Promise.all([
    lerConfigDoCasal(ctx),
    prisma.monthlyEntry.findMany({
      where: { userId: ctx.userId, profileId: ctx.profileId, year: ano, month: mes },
      select: { category: true, amount: true, pessoa: true, doCasal: true },
    }),
  ]);
  const acerto = calcularAcerto(
    lancamentos.map((l) => ({ category: l.category, amount: Number(l.amount), pessoa: l.pessoa, doCasal: l.doCasal })),
    config.divisao,
  );
  return { ...acerto, config, acertado: config.acertos.includes(chaveDoMes(ano, mes)), ano, mes };
}
