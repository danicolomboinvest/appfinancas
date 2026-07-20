import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Compass,
  Briefcase,
  Calculator,
  FileSearch,
  Settings,
  ShieldCheck,
  Target,
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
  {
    basePath: "/mensal",
    href: "/mensal",
    label: "Fluxo Financeiro",
    icon: ArrowLeftRight,
    children: [
      { href: "/mensal", label: "Visão mensal" },
      { href: "/mensal/gastos", label: "Só gastos" },
    ],
  },
  { basePath: "/orcamento", href: "/orcamento", label: "Orçamento", icon: Wallet },
  {
    basePath: "/planejamento",
    href: "/planejamento/metas",
    label: "Planejamento Financeiro",
    icon: Compass,
    children: [
      { href: "/planejamento/metas", label: "Metas" },
      { href: "/planejamento/reserva-emergencia", label: "Reserva de Emergência" },
      { href: "/planejamento/acumulo", label: "Aposentadoria" },
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
      { href: "/carteira/estrategia", label: "Estratégia" },
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
      { href: "/simuladores/vale-a-pena", label: "Vale a pena comprar?" },
    ],
  },
  {
    basePath: "/fichas",
    href: "/fichas",
    label: "Análises",
    icon: FileSearch,
    children: [
      { href: "/fichas", label: "Insights" },
      { href: "/fichas/acoes", label: "Ações" },
      { href: "/fichas/fiis", label: "FIIs" },
      { href: "/fichas/stocks", label: "Stocks" },
      { href: "/fichas/etfs", label: "ETFs" },
    ],
  },
  {
    basePath: "/configuracoes",
    href: "/configuracoes/perfil",
    label: "Configurações",
    icon: Settings,
    children: [
      { href: "/configuracoes/perfil", label: "Perfil" },
      { href: "/configuracoes/categorias", label: "Categorias" },
      { href: "/configuracoes/preferencias", label: "Preferências" },
      // Notificações fica fora do menu até existir infra de envio (e-mail/push) — a página
      // promete alertas que hoje não são disparados por nada.
      { href: "/configuracoes/dados", label: "Dados" },
      { href: "/configuracoes/taxas", label: "Taxas do Sistema" },
    ],
  },
];

export const ADMIN_NAV_SECTION: NavSection = {
  basePath: "/admin",
  href: "/admin/criterios",
  label: "Admin",
  icon: ShieldCheck,
};

export type MobileTab = { basePath: string; href: string; label: string; icon: LucideIcon };

/** Destinos de navegação da tab bar inferior. A barra final tem 5 posições:
 * Fluxo | Metas | [ + Registrar ] | Carteira | Mais — o "+" central (registro) e o "Mais"
 * (MoreSheet) são renderizados à parte pelo MobileTabBar, entre e depois destes 3 links. */
export const MOBILE_TABS: MobileTab[] = [
  { basePath: "/mensal", href: "/mensal", label: "Fluxo", icon: ArrowLeftRight },
  { basePath: "/planejamento", href: "/planejamento/metas", label: "Metas", icon: Target },
  { basePath: "/carteira", href: "/carteira", label: "Carteira", icon: Briefcase },
];

/** Seções que não têm tab própria na barra inferior — acessadas via "Mais". */
export const MORE_NAV_SECTIONS: NavSection[] = NAV_SECTIONS.filter(
  (section) => !MOBILE_TABS.some((tab) => tab.basePath === section.basePath),
);
