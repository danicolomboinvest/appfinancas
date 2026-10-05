import type { AuthContext } from "@/lib/auth/session";
import { metasParaComemorar } from "@/lib/repositories/conquista.repo";
import { vozDoTema } from "@/lib/profiles/voice";
import { NotificacaoDeConquista } from "./NotificacaoDeConquista";

/** Meta (ou sonho) que chegou no valor: a notificação com confete, uma vez por meta. */
export async function ConquistasDeMetas({ ctx }: { ctx: AuthContext }) {
  const metas = await metasParaComemorar(ctx);
  if (metas.length === 0) return null;
  const t = vozDoTema(ctx.profileTheme, ctx.profileKind).titulos;
  return <NotificacaoDeConquista conquistas={metas.map((m) => ({ chave: m.chave, icone: "🏆", titulo: t.conqMetaTitulo, texto: t.conqMetaTexto(m.nome) }))} />;
}
