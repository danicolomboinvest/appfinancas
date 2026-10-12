import { prisma } from "@/lib/db/prisma";

/**
 * Falha que a ação DEVOLVE (não lança): validação, cotação, perfil trocado (12/10/2026). Antes elas
 * só voltavam para a tela, e quando a tela não mostrava, não sobrava rastro nenhum. Vai para o
 * AppError, agrupada por onde + mensagem, sem dado da pessoa.
 */
export async function registrarFalhaDaAcao(onde: string, mensagem: string): Promise<void> {
  try {
    const routePath = `ação: ${onde}`.slice(0, 200);
    const message = mensagem.slice(0, 300);
    await prisma.appError.upsert({
      where: { routePath_message: { routePath, message } },
      create: { routePath, routeType: "action-result", method: "POST", message },
      update: { vezes: { increment: 1 }, ultimoEm: new Date() },
    });
  } catch {
    // nunca vira o erro seguinte
  }
}
