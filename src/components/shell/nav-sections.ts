import {
  LayoutDashboard,
  ArrowLeftRight,
  Compass,
  Briefcase,
  Calculator,
  FileSearch,
  Settings,
  ShieldCheck,
  Target,
  Plane,
  type LucideIcon,
} from "lucide-react";

export type NavChild = {
  href: string;
  label: string;
  premium?: boolean;
  /** Item que só existe quando a funcionalidade está ligada no servidor (chaves configuradas). */
  flag?: "openFinance";
  /** Item que só faz sentido pra pessoa física (ex.: Aposentadoria — empresa não se aposenta). */
  soPessoa?: boolean;
};

export type NavFlags = { openFinance: boolean };

/** Tira dos menus os itens de funcionalidades desligadas (ex.: Conexões sem as chaves da Pluggy
 * na Vercel): a página continua existindo, mas ninguém tropeça nela. */
export function withNavFlags(sections: NavSection[], flags: NavFlags): NavSection[] {
  return sections.map((s) => ({ ...s, children: s.children?.filter((c) => !c.flag || flags[c.flag]) }));
}

/**
 * Os filhos de uma seção que o perfil ativo deve ver. Num perfil Empresa, o que é de pessoa
 * física (Aposentadoria) some do submenu, sem mexer na lista estática acima: a mesma
 * NAV_SECTIONS serve pros dois tipos de perfil, e quem renderiza filtra na hora.
 */
export function filhosVisiveis(section: NavSection, empresa: boolean): NavChild[] {
  return (section.children ?? []).filter((c) => !empresa || !c.soPessoa);
}
export type NavSection = {
  basePath: string;
  href: string;
  label: string;
  icon: LucideIcon;
  /** Seção inteira é conteúdo do curso (freemium) — cadeado no menu pra quem não tem acesso. */
  premium?: boolean;
  /** Rotas que pertencem à seção mas vivem fora do basePath (ex.: /perfis em Configurações).
   * Sem isso a seção não acende e o submenu fecha justo na tela que o usuário abriu. */
  alsoMatches?: string[];
  children?: NavChild[];
  /** Seção que só faz sentido pra pessoa física (viagem, simuladores, análises): some na Empresa. */
  soPessoa?: boolean;
  /** Seção que só faz sentido pra empresa ("Vale a pena investir?"): some nos outros perfis. */
  soEmpresa?: boolean;
};

/** As seções que o perfil vê: a Empresa não tem viagem, simuladores nem análises; os outros não têm o simulador da empresa. */
export function secoesVisiveis<T extends NavSection>(sections: T[], empresa: boolean): T[] {
  return sections.filter((s) => (empresa ? !s.soPessoa : !s.soEmpresa));
}

/** Uma rota pertence à seção se está sob o basePath ou sob alguma rota extra declarada. */
export function sectionMatches(section: NavSection, pathname: string): boolean {
  const bate = (base: string) => pathname === base || pathname.startsWith(`${base}/`);
  return bate(section.basePath) || (section.alsoMatches?.some(bate) ?? false);
}

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
      { href: "/orcamento", label: "Orçamento" },
    ],
  },
  {
    basePath: "/planejamento",
    href: "/planejamento/metas",
    label: "Planejamento Financeiro",
    icon: Compass,
    children: [
      { href: "/planejamento/metas", label: "Metas" },
      { href: "/planejamento/reserva-emergencia", label: "Reserva de Emergência" },
      { href: "/planejamento/acumulo", label: "Aposentadoria", premium: true, soPessoa: true },
    ],
  },
  // Sem tab própria na barra inferior: no celular entra pelo "Mais" (pedido da Dani).
  { basePath: "/viagem", href: "/viagem", label: "Planejar Viagem", icon: Plane, soPessoa: true },
  { basePath: "/investir", href: "/investir", label: "Vale a pena investir?", icon: Calculator, soEmpresa: true },
  {
    basePath: "/carteira",
    href: "/carteira",
    label: "Carteira de Investimentos",
    icon: Briefcase,
    premium: true,
    children: [
      { href: "/carteira", label: "Meus Ativos" },
      { href: "/carteira/por-objetivo", label: "Por Objetivo", soPessoa: true },
      { href: "/carteira/estrategia", label: "Estratégia", soPessoa: true },
    ],
  },
  {
    basePath: "/simuladores",
    href: "/simuladores",
    label: "Simuladores",
    icon: Calculator,
    premium: true,
    soPessoa: true,
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
    premium: true,
    soPessoa: true,
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
    alsoMatches: ["/perfis"],
    children: [
      // "Perfis financeiros" é o dinheiro separado (Pessoal, Empresa); "Perfil" logo abaixo
      // é o cadastro de quem está logado. Nomes parecidos, coisas diferentes — daí o
      // adjetivo. Antes da entrada existir, a única porta pra /perfis no app inteiro era o
      // link dentro da gaveta do seletor, que no desktop ninguém achava.
      { href: "/perfis", label: "Perfis financeiros" },
      { href: "/configuracoes/perfil", label: "Perfil" },
      { href: "/configuracoes/categorias", label: "Categorias" },
      { href: "/configuracoes/preferencias", label: "Preferências" },
      // Voltou pro menu: agora controla um envio de verdade (o resumo do mês por e-mail), não
      // só alertas de tela. Sem um lugar visível pra desligar, e-mail recorrente vira spam.
      { href: "/configuracoes/notificacoes", label: "Notificações" },
      { href: "/configuracoes/conexoes", label: "Conexões", flag: "openFinance" },
      { href: "/configuracoes/dados", label: "Dados" },
      { href: "/configuracoes/taxas", label: "Taxas do Sistema" },
    ],
  },
];

export const ADMIN_NAV_SECTION: NavSection = {
  basePath: "/admin",
  href: "/admin/acessos",
  label: "Admin",
  icon: ShieldCheck,
  children: [
    { href: "/admin/acessos", label: "Acessos" },
    { href: "/admin/usuarios", label: "Usuários" },
    { href: "/admin/relatorio", label: "Relatório" },
    { href: "/admin/resultados", label: "Resultados" },
    { href: "/admin/criterios", label: "Critérios" },
    { href: "/admin/importacoes", label: "Importações" },
  ],
};

export type MobileTab = { basePath: string; href: string; label: string; icon: LucideIcon };

/** Destinos de navegação da tab bar inferior. A barra final tem 5 posições:
 * Fluxo | Metas | [ + Registrar ] | Carteira | Mais, o "+" central (registro) e o "Mais"
 * (MoreSheet) são renderizados à parte pelo MobileTabBar, entre e depois destes 3 links. */
export const MOBILE_TABS: MobileTab[] = [
  { basePath: "/mensal", href: "/mensal", label: "Fluxo", icon: ArrowLeftRight },
  { basePath: "/planejamento", href: "/planejamento/metas", label: "Metas", icon: Target },
  { basePath: "/carteira", href: "/carteira", label: "Carteira", icon: Briefcase },
];

/** Seções que não têm tab própria na barra inferior, acessadas via "Mais". */
export const MORE_NAV_SECTIONS: NavSection[] = NAV_SECTIONS.filter(
  (section) => !MOBILE_TABS.some((tab) => tab.basePath === section.basePath),
);
