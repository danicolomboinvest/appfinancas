import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { TIPOS_DE_SUGESTAO, type Dispensa, type TipoDeSugestao } from "./regras";

/**
 * As dispensas de sugestão do Resumo novo, guardadas na tabela Decisao (tipo "sugestao_dispensada",
 * chave "<tipo>|<id>"), sem tabela nova. Só as dos últimos 90 dias: a pausa mais longa é de 30.
 */
export async function listarDispensasDeSugestao(ctx: Pick<AuthContext, "userId" | "profileId">): Promise<Dispensa[]> {
  const linhas = await prisma.decisao.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, tipo: "sugestao_dispensada", createdAt: { gte: new Date(Date.now() - 90 * 86_400_000) } },
    select: { chave: true, descricao: true, dados: true, createdAt: true },
    take: 500,
  });
  return linhas.flatMap((l) => {
    const [tipo, ...resto] = (l.chave ?? "").split("|");
    if (!(TIPOS_DE_SUGESTAO as readonly string[]).includes(tipo)) return [];
    const dados = (l.dados ?? {}) as { boa?: unknown; semana?: unknown };
    return [{ tipo: tipo as TipoDeSugestao, id: resto.join("|"), marca: l.descricao ?? "", em: l.createdAt, boa: dados.boa === true, semana: typeof dados.semana === "string" ? dados.semana : undefined }];
  });
}
