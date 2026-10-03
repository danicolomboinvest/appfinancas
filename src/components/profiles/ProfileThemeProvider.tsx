"use client";

import { createContext, useContext, type ReactNode } from "react";
import { vozDoTema, type Voz } from "@/lib/profiles/voice";
import type { ProfileThemeKey } from "@/lib/profiles/themes";
import { profileTheme } from "@/lib/profiles/themes";
import { ehEmpresa } from "@/lib/profiles/empresa";
import { ehCasal } from "@/lib/profiles/casal";
import type { ProfileKind } from "@prisma/client";
import type { PreferenciasDeCategoria } from "@/lib/categories";

/** Perfil Casal: os nomes das duas pessoas (quem pagou / recebeu). Nulo nos outros perfis. */
export type NomesDoCasal = { A: string; B: string } | null;

type Contexto = {
  key: ProfileThemeKey;
  voz: Voz;
  /** Tipo do perfil ativo: EMPRESA muda categorias e vocabulário; CASAL ganha algumas ferramentas a mais. */
  kind: ProfileKind;
  empresa: boolean;
  casal: boolean;
  /** Id do perfil que a tela está mostrando. Vai junto no que grava (lançamento, importação): se
   * ela trocou de perfil em outra aba ou aparelho, o servidor recusa em vez de gravar no perfil novo. */
  profileId: string | null;
  /** O tipo com as preferências de categoria do perfil: é o que vai para categoryLabel/categoryIcon. */
  categorias: { kind: ProfileKind; prefs: PreferenciasDeCategoria };
  nomesDoCasal: NomesDoCasal;
};

const ProfileThemeContext = createContext<Contexto>({
  key: "padrao",
  voz: vozDoTema("padrao"),
  kind: "PESSOAL",
  empresa: false,
  casal: false,
  profileId: null,
  categorias: { kind: "PESSOAL", prefs: {} },
  nomesDoCasal: null,
});

/**
 * O tema do perfil ativo, pros componentes de cliente que falam com a pessoa (barra de baixo,
 * abas, painel do mês). Quem é servidor lê direto de `ctx.profileTheme`.
 */
export function ProfileThemeProvider({
  theme,
  kind = "PESSOAL",
  profileId = null,
  prefsDeCategoria = {},
  nomesDoCasal = null,
  children,
}: {
  theme: string;
  kind?: ProfileKind;
  profileId?: string | null;
  prefsDeCategoria?: PreferenciasDeCategoria;
  nomesDoCasal?: NomesDoCasal;
  children: ReactNode;
}) {
  const key = profileTheme(theme).key;
  return (
    <ProfileThemeContext.Provider value={{ key, voz: vozDoTema(key, kind), kind, empresa: ehEmpresa(kind), casal: ehCasal(kind), profileId, categorias: { kind, prefs: prefsDeCategoria }, nomesDoCasal: ehCasal(kind) ? nomesDoCasal : null }}>
      {children}
    </ProfileThemeContext.Provider>
  );
}

export function useProfileTheme(): Contexto {
  return useContext(ProfileThemeContext);
}
