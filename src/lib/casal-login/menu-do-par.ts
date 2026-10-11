import { HeartHandshake, SlidersHorizontal } from "lucide-react";
import type { NavSection } from "@/components/shell/nav-sections";

/**
 * O menu ☰ do par (login do par, 11/10/2026): só o Nós dois e as configurações dele. Nada da
 * Visão geral, Carteira, Decidir ou Análises da titular aparece, nem com cadeado.
 */
export const SECOES_DO_PAR: NavSection[] = [
  { basePath: "/divisao", href: "/divisao", label: "Nós dois", icon: HeartHandshake },
  {
    basePath: "/configuracoes",
    href: "/configuracoes/nos-dois",
    label: "Configurações",
    icon: SlidersHorizontal,
  },
];
