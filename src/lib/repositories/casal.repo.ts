import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { calcularAcerto, chaveDoMes, lerConfigCasal, type Acerto, type ConfigCasal } from "@/lib/casal/acerto";
import { donoDoPerfil, lancamentosDoAcerto } from "@/lib/casal-login/privacidade";

/**
 * O perfil Casal ativo: nomes, forma de divisão e meses acertados. O dono do perfil é a titular,
 * também quando quem olha é o par (login do par): os dois leem a mesma configuração.
 */
export async function lerConfigDoCasal(ctx: AuthContext): Promise<ConfigCasal> {
  const perfil = await prisma.financialProfile.findFirst({ where: { id: ctx.profileId, userId: donoDoPerfil(ctx) }, select: { casal: true } });
  return lerConfigCasal(perfil?.casal ?? null);
}

export async function salvarConfigDoCasal(ctx: AuthContext, config: ConfigCasal) {
  await prisma.financialProfile.updateMany({ where: { id: ctx.profileId, userId: donoDoPerfil(ctx) }, data: { casal: config } });
}

export type AcertoDoMes = Acerto & { config: ConfigCasal; acertado: boolean; ano: number; mes: number };

/** O acerto de um mês do perfil Casal ativo, a partir dos lançamentos dele. */
export async function carregarAcertoDoMes(ctx: AuthContext, ano: number, mes: number): Promise<AcertoDoMes> {
  const [config, lancamentos] = await Promise.all([
    lerConfigDoCasal(ctx),
    // Sem nenhum "só meu" (de ninguém) e, para o par, lido no servidor: a renda da titular entra
    // na fração, mas a tela dele recebe só a proporção.
    prisma.monthlyEntry.findMany({
      where: { ...lancamentosDoAcerto(ctx), year: ano, month: mes },
      select: { category: true, amount: true, pessoa: true, doCasal: true },
    }),
  ]);
  const acerto = calcularAcerto(
    lancamentos.map((l) => ({ category: l.category, amount: Number(l.amount), pessoa: l.pessoa, doCasal: l.doCasal })),
    config.divisao,
  );
  // O par vê só a proporção da renda (55% e 45%), nunca o valor, a menos que a titular mostre.
  // Zerado aqui, no servidor: o que vai para a tela dele nem carrega o número.
  const rendas = ctx.par && !ctx.par.mostrarRenda ? { A: 0, B: 0 } : acerto.rendas;
  return { ...acerto, rendas, config, acertado: config.acertos.includes(chaveDoMes(ano, mes)), ano, mes };
}
