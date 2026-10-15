import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { estadoDoFechamento, proximoEstado, type AcaoDoFechamento } from "@/app/(app)/mensal/foco/fechamento/estado";

/**
 * O estado do fechamento de um mês do perfil ativo (tabela FechamentoDoMes, seção 3.12).
 * Perfil é obrigatório: o fechamento é de um dinheiro, não da conta.
 */
export async function lerFechamento(ctx: { userId: string; profileId: string | null }, ano: number, mes: number) {
  if (!ctx.profileId) return estadoDoFechamento(null);
  const linha = await prisma.fechamentoDoMes.findUnique({
    where: { profileId_ano_mes: { profileId: ctx.profileId, ano, mes } },
    select: { estado: true, fechadoEm: true, reabertoEm: true, userId: true },
  });
  return estadoDoFechamento(linha && linha.userId === ctx.userId ? linha : null);
}

/**
 * O mês está fechado? O mesmo critério do convite do app (ondeMostrarFechamento recebe
 * `fechamentoFeito: estado === "fechado"`): reaberto conta como não fechado. O e-mail do resumo
 * mensal usa este para não convidar a fechar quem já fechou (15/10/2026).
 */
export async function mesJaFechado(dono: { userId: string; profileId: string | null }, ano: number, mes: number): Promise<boolean> {
  return (await lerFechamento(dono, ano, mes)).estado === "fechado";
}

/** Fecha ou reabre. Devolve false quando a passagem não vale (reabrir o que nunca fechou). */
export async function mudarFechamento(ctx: AuthContext, ano: number, mes: number, acao: AcaoDoFechamento, agora: Date = new Date()): Promise<boolean> {
  if (!ctx.profileId) return false;
  const atual = await lerFechamento(ctx, ano, mes);
  const novo = proximoEstado(atual.estado, acao);
  if (!novo) return acao === "fechar"; // fechar o que já está fechado: já está como ela quer.
  const dados = novo === "fechado" ? { estado: novo, fechadoEm: agora } : { estado: novo, reabertoEm: agora };
  await prisma.fechamentoDoMes.upsert({
    where: { profileId_ano_mes: { profileId: ctx.profileId, ano, mes } },
    create: { userId: ctx.userId, profileId: ctx.profileId, ano, mes, ...dados },
    update: dados,
  });
  return true;
}
