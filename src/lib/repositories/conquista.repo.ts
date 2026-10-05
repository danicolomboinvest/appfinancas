import { prisma } from "@/lib/db/prisma";
import { doDono, type AuthContext } from "@/lib/auth/session";
import { registrarDecisaoUnica } from "@/lib/repositories/decisao.repo";
import { listGoalsWithProgress } from "@/lib/repositories/goal.repo";

/**
 * Conquistas (05/10/2026): os poucos momentos que ganham a notificação com confete. A Dani:
 * "é muito raro; não é para ser do nada na tela, é para quando abrir a notificação aparecer o
 * confete". Cada uma aparece uma vez só e fica marcada como comemorada.
 */

export type ChaveDeConquista = `meta|${string}` | "primeiro-fechamento" | "reset";

export async function jaComemorou(ctx: AuthContext, chave: ChaveDeConquista): Promise<boolean> {
  return (await prisma.decisao.count({ where: { ...doDono(ctx), tipo: "conquista", chave } })) > 0;
}

export async function marcarConquista(ctx: AuthContext, chave: ChaveDeConquista) {
  return registrarDecisaoUnica(ctx, { tipo: "conquista", chave });
}

/** Metas/sonhos que chegaram no valor e ainda não ganharam a comemoração. */
export async function metasParaComemorar(ctx: AuthContext): Promise<{ chave: ChaveDeConquista; nome: string }[]> {
  const metas = await listGoalsWithProgress(ctx);
  const chegaram = metas.filter((g) => Number(g.targetAmount) > 0 && g.computedCurrentAmount >= Number(g.targetAmount));
  if (chegaram.length === 0) return [];
  const vistas = await prisma.decisao.findMany({ where: { ...doDono(ctx), tipo: "conquista", chave: { in: chegaram.map((g) => `meta|${g.id}`) } }, select: { chave: true } });
  const ja = new Set(vistas.map((v) => v.chave));
  return chegaram.filter((g) => !ja.has(`meta|${g.id}`)).map((g) => ({ chave: `meta|${g.id}` as const, nome: g.name }));
}

/** É o primeiro mês que ela fecha? (Nenhum outro fechamento e a conquista ainda não comemorada.) */
export async function ehPrimeiroFechamento(ctx: AuthContext, chaveDoMes: string): Promise<boolean> {
  if (await jaComemorou(ctx, "primeiro-fechamento")) return false;
  const outros = await prisma.decisao.count({ where: { ...doDono(ctx), tipo: "fechamento", NOT: { chave: chaveDoMes } } });
  return outros === 0;
}
