import { cache } from "react";
import type { ProfileKind } from "@prisma/client";
import { auth } from "@/lib/auth/auth.config";
import { getOrCreateActiveProfile } from "@/lib/repositories/profile.repo";
import { lerPreferenciasDeCategoria, type PreferenciasDeCategoria } from "@/lib/categories";
import { chaveDoTema } from "@/lib/profiles/themes";
import { perfilDoPar, type ParNaSessao } from "@/lib/repositories/casal-login.repo";
import { casaDoUsuario } from "@/lib/repositories/casa.repo";
import type { CasaNaSessao } from "@/lib/casa/regras";

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
  /**
   * Casal simples (13/10/2026). Presente quando a conta está numa casa do modelo simples E o
   * perfil ativo é o Pessoal dela na casa. O `userId` e o `profileId` continuam os de quem está
   * logado (toda escrita segue só dele); só as leituras de src/lib/casa/regras.ts juntam o que o
   * outro deixou visível.
   */
  casa?: CasaNaSessao | null;
};

/**
 * A sessão e o perfil ativo, uma vez por requisição (11/10/2026). O `auth()` lê o banco a cada
 * chamada (confere se a conta ainda existe), e o layout e a página chamavam cada um o seu: em
 * produção, cada ida à Neon é uma viagem de rede, e a tela esperava todas em fila.
 */
export const sessaoDaRequisicao = cache(() => auth());
export const perfilAtivoDaRequisicao = cache((userId: string) => getOrCreateActiveProfile(userId));
const perfilDoParDaRequisicao = cache((userId: string) => perfilDoPar(userId));
export const casaDaRequisicao = cache((userId: string) => casaDoUsuario(userId));

/**
 * Contexto de sessão autenticado, para ser passado explicitamente à camada de
 * repositories. Nunca aceitar userId vindo do client/body da requisição.
 */
export async function getRequiredSession(): Promise<AuthContext> {
  const session = await sessaoDaRequisicao();
  if (!session?.user) {
    throw new Error("Não autenticado.");
  }
  // O par entra direto no Nós dois da titular, sem perfil próprio (a não ser que tenha comprado).
  const doPar = session.user.par === "em-uso" ? await perfilDoParDaRequisicao(session.user.id) : null;
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
  const [perfil, casa] = await Promise.all([
    perfilAtivoDaRequisicao(session.user.id),
    // Só quem está numa casa simples paga a consulta a mais (o token já diz).
    session.user.casa ? casaDaRequisicao(session.user.id) : Promise.resolve(null),
  ]);
  return {
    userId: session.user.id,
    role: session.user.role,
    profileId: perfil.id,
    // Já na chave que vale: um tema que saiu (Game, Minimalista...) chega como o substituto dele.
    profileTheme: chaveDoTema(perfil.theme),
    profileKind: perfil.kind,
    categorias: { kind: perfil.kind, prefs: lerPreferenciasDeCategoria(perfil.categorias) },
    // A casa vale só no Pessoal que faz parte dela (na Empresa, a Empresa é só dela).
    casa: casa && casa.eu.profileId === perfil.id ? casa : null,
  };
}

/**
 * O mesmo contexto do getRequiredSession, a partir só do id da conta (o widget do iPhone, que entra
 * com a chave dele e não tem sessão). Sem isto o widget do casal somava só os gastos de quem
 * olha e lia o orçamento errado: o Resumo dizia uma coisa e o widget outra.
 */
export async function contextoDaConta(user: { id: string; role: AuthContext["role"] }): Promise<AuthContext> {
  const doPar = await perfilDoPar(user.id);
  if (doPar) {
    return {
      userId: user.id,
      role: user.role,
      profileId: doPar.perfil.id,
      profileTheme: chaveDoTema(doPar.perfil.theme),
      profileKind: doPar.perfil.kind,
      categorias: { kind: doPar.perfil.kind, prefs: lerPreferenciasDeCategoria(doPar.perfil.categorias) },
      par: doPar.par,
      donoId: doPar.par.donoId,
    };
  }
  const [perfil, casa] = await Promise.all([getOrCreateActiveProfile(user.id), casaDoUsuario(user.id)]);
  return {
    userId: user.id,
    role: user.role,
    profileId: perfil.id,
    profileTheme: chaveDoTema(perfil.theme),
    profileKind: perfil.kind,
    categorias: { kind: perfil.kind, prefs: lerPreferenciasDeCategoria(perfil.categorias) },
    casa: casa && casa.eu.profileId === perfil.id ? casa : null,
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
