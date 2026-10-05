import { prisma } from "@/lib/db/prisma";
import { doDono, type AuthContext } from "@/lib/auth/session";
import { depoisDePagar, type ContaParaRegra } from "@/lib/contas/contas";

export type ContaAPagarInput = {
  nome: string;
  /** null = o valor muda todo mês. */
  valor: number | null;
  vencimento: Date;
  repete: boolean;
  lembrar: boolean;
};

export type ContaDaTela = ContaParaRegra & { pagaEm: Date | null };

function paraTela(c: { id: string; nome: string; valor: unknown; vencimento: Date; repete: boolean; lembrar: boolean; quitada: boolean; pagaEm: Date | null }): ContaDaTela {
  return { id: c.id, nome: c.nome, valor: c.valor == null ? null : Number(c.valor), vencimento: c.vencimento, repete: c.repete, lembrar: c.lembrar, quitada: c.quitada, pagaEm: c.pagaEm };
}

/** As contas em aberto do perfil, da que vence primeiro. As quitadas não voltam. */
export async function listarContasAPagar(ctx: AuthContext): Promise<ContaDaTela[]> {
  const contas = await prisma.contaAPagar.findMany({ where: { ...doDono(ctx), quitada: false }, orderBy: [{ vencimento: "asc" }, { nome: "asc" }] });
  return contas.map(paraTela);
}

/** As últimas que ela pagou e não repetem (pra desfazer um "paguei" sem querer). */
export async function listarQuitadasRecentes(ctx: AuthContext, limite = 5): Promise<ContaDaTela[]> {
  const contas = await prisma.contaAPagar.findMany({ where: { ...doDono(ctx), quitada: true }, orderBy: { pagaEm: "desc" }, take: limite });
  return contas.map(paraTela);
}

export async function criarContaAPagar(ctx: AuthContext, d: ContaAPagarInput) {
  return prisma.contaAPagar.create({ data: { ...doDono(ctx), ...d, diaDoMes: d.vencimento.getUTCDate() } });
}

/** Mudar a data muda o dia de sempre também: ela escolheu outro dia. */
export async function editarContaAPagar(ctx: AuthContext, id: string, d: ContaAPagarInput) {
  return prisma.contaAPagar.updateMany({ where: { id, ...doDono(ctx) }, data: { ...d, diaDoMes: d.vencimento.getUTCDate() } });
}

export async function apagarContaAPagar(ctx: AuthContext, id: string) {
  return prisma.contaAPagar.deleteMany({ where: { id, ...doDono(ctx) } });
}

/**
 * "Paguei": a que repete vai pro mês seguinte; a outra fica quitada. Não lança gasto: quem importa
 * extrato veria o mesmo pagamento duas vezes.
 *
 * O `vencimento` no filtro do update segura o toque duplo: o segundo "paguei" não acha mais a
 * conta no vencimento antigo e não pula mais um mês.
 */
export async function marcarContaPaga(ctx: AuthContext, id: string) {
  const c = await prisma.contaAPagar.findFirst({ where: { id, ...doDono(ctx), quitada: false } });
  if (!c) return null;
  const depois = depoisDePagar(c, c.diaDoMes ?? undefined);
  const r = await prisma.contaAPagar.updateMany({ where: { id, ...doDono(ctx), vencimento: c.vencimento, quitada: false }, data: { ...depois, pagaEm: new Date() } });
  if (r.count === 0) return null;
  return { antes: c.vencimento, ...depois };
}

/** Desfaz o último "paguei": volta o vencimento que ela tinha marcado como pago. */
export async function desfazerContaPaga(ctx: AuthContext, id: string, vencimentoAntes: Date) {
  return prisma.contaAPagar.updateMany({ where: { id, ...doDono(ctx) }, data: { vencimento: vencimentoAntes, quitada: false, pagaEm: null } });
}
