import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { calcularAcerto, chaveDaConta as chaveDaContaDoAcerto, chaveDoMes, lerConfigCasal, type Acerto, type ConfigCasal } from "@/lib/casal/acerto";
import { primeiroNome } from "@/lib/casal-login/regras";
import { casaAtiva, lancamentosDoAcertoDaCasa, letraDoDono, outraLetra, type CasaNaSessao, type Letra } from "@/lib/casa/regras";

/**
 * Casal simples (13/10/2026): a casa de quem está logado e o acerto do mês dela. A leitura que
 * junta os dois mora em src/lib/casa/regras.ts; aqui só o que precisa do banco.
 */

const NOME_DE_FABRICA = /^Pessoa [12]$/;

function nomeDaPessoa(config: ConfigCasal, letra: Letra, nomeDaConta: string | null, email: string): string {
  const daConfig = letra === "A" ? config.nomeA : config.nomeB;
  if (daConfig && !NOME_DE_FABRICA.test(daConfig)) return primeiroNome(daConfig, daConfig);
  return primeiroNome(nomeDaConta, email.split("@")[0]);
}

/**
 * A casa do modelo simples em que a conta está (como par ou como titular), vista por ela. Nula
 * quando não está em casa nenhuma, quando a casa ainda é do Nós dois, quando falta um dos dois
 * Pessoais ou quando o Casal da titular está parado (bloqueadoEm: não renovou).
 */
export async function casaDoUsuario(userId: string): Promise<CasaNaSessao | null> {
  const m = await prisma.membroCasal.findFirst({
    where: { saiuEm: null, modelo: "simples", OR: [{ userId }, { profile: { userId } }] },
    select: {
      id: true,
      letra: true,
      userId: true,
      profileId: true,
      perfilTitularId: true,
      perfilParId: true,
      bloqueadoEm: true,
      user: { select: { name: true, email: true } },
      profile: { select: { userId: true, casal: true, user: { select: { name: true, email: true } } } },
    },
  });
  if (!m || !m.perfilTitularId || !m.perfilParId || m.bloqueadoEm) return null;
  const config = lerConfigCasal(m.profile.casal);
  const letraPar: Letra = m.letra === "A" ? "A" : "B";
  const titular = {
    userId: m.profile.userId,
    profileId: m.perfilTitularId,
    letra: outraLetra(letraPar),
    nome: nomeDaPessoa(config, outraLetra(letraPar), m.profile.user.name, m.profile.user.email),
    papel: "titular" as const,
  };
  const par = { userId: m.userId, profileId: m.perfilParId, letra: letraPar, nome: nomeDaPessoa(config, letraPar, m.user.name, m.user.email), papel: "par" as const };
  if (titular.userId === par.userId) return null;
  const souPar = m.userId === userId;
  return { membroId: m.id, casalProfileId: m.profileId, eu: souPar ? par : titular, outro: souPar ? titular : par };
}

export type AcertoDaCasa = Acerto & {
  ano: number;
  mes: number;
  config: ConfigCasal;
  /** O mês já foi marcado como acertado (os "acertos" do Nós dois continuam valendo). */
  acertado: boolean;
  /** O mês foi fechado a dois no Nós dois (os dois disseram "Confere"). */
  fechado: boolean;
  eu: { letra: Letra; nome: string; papel: "titular" | "par" };
  outro: { letra: Letra; nome: string; papel: "titular" | "par" };
  /** Positivo: eu mando isso para o outro. Negativo: eu recebo. Zero: quites. */
  euMando: number;
};

/**
 * O acerto do mês da casa: os gastos que os dois enxergam (nada de "Só meu" nem de conta
 * escondida de ninguém), quem pagou pelo dono do registro, e o jeito de dividir de sempre
 * (renda, meio a meio ou combinado, e o conta por conta). É o mesmo calcularAcerto do Nós dois.
 */
export async function acertoDaCasa(ctx: AuthContext, ano: number, mes: number): Promise<AcertoDaCasa | null> {
  const casa = casaAtiva(ctx);
  if (!casa) return null;
  const [perfilCasal, linhas, fechamento] = await Promise.all([
    prisma.financialProfile.findUnique({ where: { id: casa.casalProfileId }, select: { casal: true } }),
    prisma.monthlyEntry.findMany({
      where: { AND: [lancamentosDoAcertoDaCasa(casa), { year: ano, month: mes, category: { in: ["EXPENSE", "INCOME"] } }] },
      select: { userId: true, category: true, amount: true, doCasal: true, description: true, subcategory: true, parentCategory: true },
    }),
    prisma.fechamentoCasal.findUnique({ where: { profileId_ano_mes: { profileId: casa.casalProfileId, ano, mes } }, select: { fechadoEm: true } }),
  ]);
  const config = lerConfigCasal(perfilCasal?.casal ?? null);
  const regras = config.regras ?? {};
  const acerto = calcularAcerto(
    linhas.map((l) => ({
      category: l.category,
      amount: Number(l.amount),
      pessoa: letraDoDono(casa, l.userId),
      doCasal: l.doCasal,
      modo: regras[chaveDaContaDoAcerto(l.description || l.subcategory, l.parentCategory)],
    })),
    config.divisao,
    { pctA: config.pctA },
  );
  const saldoDoEu = casa.eu.letra === "A" ? acerto.saldoA : -acerto.saldoA;
  const pessoa = (p: CasaNaSessao["eu"]) => ({ letra: p.letra, nome: p.nome, papel: p.papel });
  return {
    ...acerto,
    ano,
    mes,
    config,
    acertado: config.acertos.includes(chaveDoMes(ano, mes)),
    fechado: Boolean(fechamento?.fechadoEm),
    eu: pessoa(casa.eu),
    outro: pessoa(casa.outro),
    euMando: Math.round(-saldoDoEu * 100) / 100,
  };
}
