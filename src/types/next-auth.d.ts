import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      /** Login do par: "em-uso" = está no Nós dois de alguém agora; "fora" = é par, mas está nos
       * perfis próprios; ausente = não é par de ninguém. Relido do banco a cada requisição. */
      par?: "em-uso" | "fora";
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    /** Marca da senha no login (ver versaoDaSenha): trocar a senha invalida as outras sessões. */
    senhaVersao?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    senhaVersao?: string;
    par?: "em-uso" | "fora";
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
    senhaVersao?: string;
    par?: "em-uso" | "fora";
  }
}
