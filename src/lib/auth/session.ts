import type { ProfileKind } from "@prisma/client";
import { auth } from "@/lib/auth/auth.config";
import { getOrCreateActiveProfile } from "@/lib/repositories/profile.repo";

/**
 * Quem é a pessoa, sem dizer em qual perfil ela está.
 *
 * Existe pra separar o que é da CONTA do que é de dinheiro. Ler o tema, a moeda e o plano não
 * depende de perfil nenhum — e exigir perfil nessas leituras custaria uma consulta a mais em
 * TODA navegação, justamente a que o layout evita de propósito.
 */
export type AccountContext = {
  userId: string;
  role: "ADMIN" | "CLIENT";
};

export type AuthContext = AccountContext & {
  /**
   * Perfil financeiro ativo. TODA consulta a dado de dinheiro filtra por ele.
   *
   * Vem junto do usuário, e não separado, porque o isolamento entre perfis não pode depender de
   * alguém lembrar de passar mais um parâmetro: quem tem o contexto tem os dois, e esquecer o
   * perfil vira um erro visível (ver o teste de cobertura de isolamento).
   */
  profileId: string;
  /**
   * Tema do perfil ativo. Vem junto porque a voz do app (o que ele DIZ) depende dele, e as
   * páginas de servidor não têm como ler contexto de React. Já estava na mesma consulta.
   */
  profileTheme: string;
  /** Tipo do perfil ativo (PESSOAL, EMPRESA, CASAL…). Empresa muda vocabulário, categorias e a DRE. */
  profileKind: ProfileKind;
};

/**
 * Contexto de sessão autenticado, para ser passado explicitamente à camada de
 * repositories. Nunca aceitar userId vindo do client/body da requisição.
 */
export async function getRequiredSession(): Promise<AuthContext> {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Não autenticado.");
  }
  const perfil = await getOrCreateActiveProfile(session.user.id);
  return { userId: session.user.id, role: session.user.role, profileId: perfil.id, profileTheme: perfil.theme, profileKind: perfil.kind };
}

/**
 * O filtro de dono de um registro com escopo de perfil.
 *
 * Existe pra dar um nome ao que antes era `{ userId: ctx.userId }` espalhado: agora o par
 * usuário+perfil anda junto e não tem como sair só metade. O teste de isolamento procura por
 * consultas que filtram por usuário SEM usar isto.
 */
export function doDono(ctx: AuthContext): { userId: string; profileId: string } {
  return { userId: ctx.userId, profileId: ctx.profileId };
}
