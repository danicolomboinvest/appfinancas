import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { calcularAcerto, chaveDaConta, chaveDoMes, lerConfigCasal, type Acerto, type ConfigCasal, type ModoDaConta } from "@/lib/casal/acerto";
import type { ParentCategory } from "@prisma/client";
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

/** Uma conta da casa no mês (os lançamentos com o mesmo nome somados), para o conta por conta. */
export type ContaDoMes = {
  chave: string;
  nome: string;
  parentCategory: ParentCategory | null;
  valor: number;
  pagou: { A: number; B: number };
  /** O jeito gravado para esta conta; nulo = o geral. */
  modo: ModoDaConta | null;
};

export type AcertoDoMes = Acerto & {
  config: ConfigCasal;
  acertado: boolean;
  ano: number;
  mes: number;
  /** A proporção pela renda (0,55), que os dois podem ver. O valor da renda não vem para o par. */
  fracaoRenda: number;
  /** Os gastos da casa agrupados por conta, com quem pagou e o jeito de cada uma. */
  contas: ContaDoMes[];
};

/** O acerto de um mês do perfil Casal ativo, a partir dos lançamentos dele. */
export async function carregarAcertoDoMes(ctx: AuthContext, ano: number, mes: number): Promise<AcertoDoMes> {
  const [config, lancamentos] = await Promise.all([
    lerConfigDoCasal(ctx),
    // Sem nenhum "só meu" (de ninguém) e, para o par, lido no servidor: a renda da titular entra
    // na fração, mas a tela dele recebe só a proporção.
    prisma.monthlyEntry.findMany({
      where: { ...lancamentosDoAcerto(ctx), year: ano, month: mes },
      select: { category: true, amount: true, pessoa: true, doCasal: true, description: true, subcategory: true, parentCategory: true },
      orderBy: { amount: "desc" },
    }),
  ]);
  const regras = config.regras ?? {};
  const comChave = lancamentos.map((l) => {
    const nome = l.description || l.subcategory || "";
    const chave = chaveDaConta(nome, l.parentCategory);
    return { l, nome, chave };
  });
  const acerto = calcularAcerto(
    comChave.map(({ l, chave }) => ({ category: l.category, amount: Number(l.amount), pessoa: l.pessoa, doCasal: l.doCasal, modo: regras[chave] })),
    config.divisao,
    { pctA: config.pctA },
  );
  // As contas da casa: gastos "nosso" com quem pagou, somados pelo nome.
  const contas = new Map<string, ContaDoMes>();
  for (const { l, nome, chave } of comChave) {
    if (l.category !== "EXPENSE" || l.doCasal === false || (l.pessoa !== "A" && l.pessoa !== "B")) continue;
    const valor = Math.abs(Number(l.amount));
    const c = contas.get(chave) ?? { chave, nome: nome || "Sem nome", parentCategory: l.parentCategory, valor: 0, pagou: { A: 0, B: 0 }, modo: regras[chave] ?? null };
    c.valor += valor;
    c.pagou[l.pessoa] += valor;
    contas.set(chave, c);
  }
  const fracaoRenda = acerto.rendas.A > 0 && acerto.rendas.B > 0 ? acerto.rendas.A / (acerto.rendas.A + acerto.rendas.B) : 0.5;
  // O par vê só a proporção da renda (55% e 45%), nunca o valor, a menos que a titular mostre.
  // Zerado aqui, no servidor: o que vai para a tela dele nem carrega o número.
  const rendas = ctx.par && !ctx.par.mostrarRenda ? { A: 0, B: 0 } : acerto.rendas;
  return {
    ...acerto,
    rendas,
    config,
    acertado: config.acertos.includes(chaveDoMes(ano, mes)),
    ano,
    mes,
    fracaoRenda,
    contas: [...contas.values()].sort((a, b) => b.valor - a.valor),
  };
}

/** O plano da casa do mês (a soma do orçamento do perfil Casal). Nulo = sem plano montado. */
export async function planoDaCasa(ctx: AuthContext, ano: number, mes: number): Promise<number | null> {
  const r = await prisma.budget.aggregate({ where: { userId: donoDoPerfil(ctx), profileId: ctx.profileId, year: ano, month: mes }, _sum: { plannedAmount: true } });
  const v = Number(r._sum.plannedAmount ?? 0);
  return v > 0 ? v : null;
}
