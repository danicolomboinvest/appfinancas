import {
  LayoutDashboard,
  ArrowLeftRight,
  Compass,
  Briefcase,
  Calculator,
  FileSearch,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export type NavChild = { href: string; label: string };
export type NavSection = {
  basePath: string;
  href: string;
  label: string;
  icon: LucideIcon;
  children?: NavChild[];
};

export const NAV_SECTIONS: NavSection[] = [
  { basePath: "/dashboard", href: "/dashboard", label: "Visão Geral", icon: LayoutDashboard },
  { basePath: "/mensal", href: "/mensal", label: "Fluxo Financeiro", icon: ArrowLeftRight },
  {
    basePath: "/planejamento",
    href: "/planejamento/acumulo",
    label: "Planejamento Financeiro",
    icon: Compass,
    children: [
      { href: "/planejamento/acumulo", label: "Acúmulo" },
      { href: "/planejamento/usufruto", label: "Liberdade Financeira" },
      { href: "/planejamento/projecao", label: "Projeção Patrimonial" },
      { href: "/planejamento/reserva-emergencia", label: "Reserva de Emergência" },
      { href: "/planejamento/metas", label: "Metas" },
    ],
  },
  {
    basePath: "/carteira",
    href: "/carteira",
    label: "Carteira de Investimentos",
    icon: Briefcase,
    children: [
      { href: "/carteira", label: "Meus Ativos" },
      { href: "/carteira/por-objetivo", label: "Por Objetivo" },
    ],
  },
  {
    basePath: "/simuladores",
    href: "/simuladores",
    label: "Simuladores",
    icon: Calculator,
    children: [
      { href: "/simuladores/financiar-vs-alugar", label: "Financiar vs. Alugar" },
      { href: "/simuladores/amortizar-vs-investir", label: "Amortizar vs. Investir" },
      { href: "/simuladores/consorcio", label: "Consórcio vs. Financiamento" },
      { href: "/simuladores/marcacao-mercado", label: "Marcação a Mercado" },
      { href: "/simuladores/carro", label: "Carro: Assinar vs. Comprar" },
    ],
  },
  {
    basePath: "/fichas",
    href: "/fichas/acoes",
    label: "Análises",
    icon: FileSearch,
    children: [
      { href: "/fichas/acoes", label: "Ações" },
      { href: "/fichas/fiis", label: "FIIs" },
    ],
  },
  { basePath: "/parametros", href: "/parametros", label: "Configurações", icon: Settings },
];

export const ADMIN_NAV_SECTION: NavSection = {
  basePath: "/admin",
  href: "/admin/criterios",
  label: "Admin",
  icon: ShieldCheck,
};
