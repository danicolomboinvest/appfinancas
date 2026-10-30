import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { casaAtiva } from "@/lib/casa/regras";
import { TIPO_AVISO_CASAL_NO_PESSOAL, mostraAvisoDoCasalNoPessoal, type AvisoDoCasalNoPessoal } from "@/lib/casa/aviso-casal-no-pessoal";

/**
 * O aviso "o que você montou no Nós dois está no seu Pessoal" ainda sem resposta, da titular
 * logada no Pessoal dela na casa (ver lib/casa/aviso-casal-no-pessoal). Null quando não há o que
 * mostrar. Quem cria a Decisao é o aceite do convite (casal-dados.registrarAvisoDoCasalNoPessoal).
 */
export async function avisoDoCasalNoPessoalPendente(ctx: AuthContext): Promise<AvisoDoCasalNoPessoal | null> {
  const casa = casaAtiva(ctx);
  if (!casa || casa.eu.papel !== "titular") return null;
  const d = await prisma.decisao.findFirst({
    where: { userId: ctx.userId, profileId: ctx.profileId, tipo: TIPO_AVISO_CASAL_NO_PESSOAL, chave: casa.casalProfileId, resolvidaEm: null },
    select: { valor: true },
  });
  if (!mostraAvisoDoCasalNoPessoal({ naCasa: true, papel: casa.eu.papel, pendente: d !== null })) return null;
  return { movidos: Number(d?.valor ?? 0) };
}

/** "Entendi" (ou "Ver a casa"): o aviso não volta. Só o da própria conta e do perfil ativo. */
export async function marcarAvisoDoCasalNoPessoalVisto(ctx: AuthContext, agora: Date = new Date()): Promise<boolean> {
  const r = await prisma.decisao.updateMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, tipo: TIPO_AVISO_CASAL_NO_PESSOAL, resolvidaEm: null },
    data: { resolvidaEm: agora },
  });
  return r.count > 0;
}
