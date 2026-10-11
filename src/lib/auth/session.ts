import type { ProfileKind } from "@prisma/client";
import { auth } from "@/lib/auth/auth.config";
import { getOrCreateActiveProfile } from "@/lib/repositories/profile.repo";
import { lerPreferenciasDeCategoria, type PreferenciasDeCategoria } from "@/lib/categories";
import { chaveDoTema } from "@/lib/profiles/themes";
import { perfilDoPar, type ParNaSessao } from "@/lib/repositories/casal-login.repo";

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
  /**
   * O tipo do perfil com as preferências de categoria dele (nome, ícone, escondida). É o que se
   * passa para categoryLabel/categoryIcon. Opcional porque os crons montam o contexto à mão;
   * sem ele, os nomes de fábrica.
   */
  categorias?: { kind: ProfileKind; prefs: PreferenciasDeCategoria };
  /**
   * Login do par (11/10/2026). Presente quando quem está logado é o par, dentro do Nós dois da
   * titular: o `userId` continua sendo o DELE (então toda consulta antiga devolve vazio para ele,
   * nunca o dinheiro dela) e o `profileId` é o do Casal. Só as leituras de
   * src/lib/casal-login/privacidade.ts usam a dona do perfil (`par.donoId`).
   */
  par?: ParNaSessao | null;
  /** A dona do perfil quando quem olha é o par (o mesmo que `par.donoId`). */
  donoId?: string;
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
  // O par entra direto no Nós dois da titular, sem perfil próprio (a não ser que tenha comprado).
  const doPar = session.user.par === "em-uso" ? await perfilDoPar(session.user.id) : null;
  if (doPar) {
    return {
      userId: session.user.id,
      role: session.user.role,
      profileId: doPar.perfil.id,
      profileTheme: chaveDoTema(doPar.perfil.theme),
      profileKind: doPar.perfil.kind,
      categorias: { kind: doPar.perfil.kind, prefs: lerPreferenciasDeCategoria(doPar.perfil.categorias) },
      par: doPar.par,
      donoId: doPar.par.donoId,
    };
  }
  const perfil = await getOrCreateActiveProfile(session.user.id);
  return {
    userId: session.user.id,
    role: session.user.role,
    profileId: perfil.id,
    // Já na chave que vale: um tema que saiu (Game, Minimalista...) chega como o substituto dele.
    profileTheme: chaveDoTema(perfil.theme),
    profileKind: perfil.kind,
    categorias: { kind: perfil.kind, prefs: lerPreferenciasDeCategoria(perfil.categorias) },
  };
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
