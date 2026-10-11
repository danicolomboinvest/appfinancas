import { prisma } from "@/lib/db/prisma";

/**
 * "Não quero ver ofertas da assessoria" (Configurações › Assessoria, rodada 34): desligado, nenhum
 * cartão de oferta da Fatos Capital aparece no app (abrir conta, acompanhamento, conversar com um
 * assessor). O que já é de quem é cliente (ajustes para aprovar) não é oferta e continua.
 */
export async function ofertasDaAssessoriaLigadas(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { ofertasDesligadas: true } });
  return !u?.ofertasDesligadas;
}
