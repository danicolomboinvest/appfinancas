"use client";

import { createContext, useContext, type ReactNode } from "react";
import { vozDoTema, type Voz } from "@/lib/profiles/voice";
import type { ProfileThemeKey } from "@/lib/profiles/themes";
import { profileTheme } from "@/lib/profiles/themes";
import { ehEmpresa } from "@/lib/profiles/empresa";
import { ehCasal } from "@/lib/profiles/casal";
import type { ProfileKind } from "@prisma/client";

type Contexto = {
  key: ProfileThemeKey;
  voz: Voz;
  /** Tipo do perfil ativo: EMPRESA muda categorias e vocabulário; CASAL ganha algumas ferramentas a mais. */
  kind: ProfileKind;
  empresa: boolean;
  casal: boolean;
};

const ProfileThemeContext = createContext<Contexto>({ key: "padrao", voz: vozDoTema("padrao"), kind: "PESSOAL", empresa: false, casal: false });

/**
 * O tema do perfil ativo, pros componentes de cliente que falam com a pessoa (barra de baixo,
 * abas, painel do mês). Quem é servidor lê direto de `ctx.profileTheme`.
 */
export function ProfileThemeProvider({ theme, kind = "PESSOAL", children }: { theme: string; kind?: ProfileKind; children: ReactNode }) {
  const key = profileTheme(theme).key;
  return (
    <ProfileThemeContext.Provider value={{ key, voz: vozDoTema(key, kind), kind, empresa: ehEmpresa(kind), casal: ehCasal(kind) }}>
      {children}
    </ProfileThemeContext.Provider>
  );
}

export function useProfileTheme(): Contexto {
  return useContext(ProfileThemeContext);
}
