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
  Scale,
  Signpost,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import { ROTAS_DO_FLUXO } from "./flow-tabs";

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
  /** Seção que só faz sentido pro casal ("Quanto cada um contribui?"): some nos outros perfis. */
  soCasal?: boolean;
};

/**
 * As seções que o perfil vê: a Empresa não tem viagem, simuladores nem análises (`soPessoa`);
 * cada tipo tem sua própria ferramenta extra (`soEmpresa`, `soCasal`) que só aparece nele.
 * O Casal continua vendo tudo que é `soPessoa` — a diferença dele pro Pessoal é só ganhar
 * a calculadora de divisão a mais, não perder nada.
 */
export function secoesVisiveis<T extends NavSection>(sections: T[], flags: { empresa: boolean; casal: boolean }): T[] {
  return sections.filter((s) => (flags.empresa ? !s.soPessoa : !s.soEmpresa) && (flags.casal || !s.soCasal));
}

/** Uma rota pertence à seção se está sob o basePath ou sob alguma rota extra declarada.
 * Serve também pras abas da barra de baixo (`MobileTab`), que têm os mesmos dois campos. */
export function sectionMatches(section: Pick<NavSection, "basePath" | "alsoMatches">, pathname: string): boolean {
  const bate = (base: string) => pathname === base || pathname.startsWith(`${base}/`);
  return bate(section.basePath) || (section.alsoMatches?.some(bate) ?? false);
}

export const NAV_SECTIONS: NavSection[] = [
  { basePath: "/dashboard", href: "/dashboard", label: "Visão Geral", icon: LayoutDashboard },
  {
    basePath: "/mensal",
    href: "/mensal/foco",
    label: "Fluxo Financeiro",
    icon: ArrowLeftRight,
    // O Orçamento é a quarta aba do Fluxo, mas mora em /orcamento: sem isso o menu lateral
    // apagava o Fluxo justo quando a pessoa estava numa aba dele.
    alsoMatches: ROTAS_DO_FLUXO,
    children: [
      { href: "/mensal/foco", label: "Foco" },
      // Os mesmos nomes das abas do celular (06/10/2026).
      { href: "/mensal", label: "Mensal" },
      { href: "/mensal/gastos", label: "Gastos" },
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
  { basePath: "/divisao", href: "/divisao", label: "Quanto cada um contribui?", icon: Scale, soCasal: true },
  {
    basePath: "/carteira",
    href: "/carteira",
    label: "Carteira",
    icon: Briefcase,
    premium: true,
    children: [
      { href: "/carteira", label: "Meus Ativos" },
      { href: "/carteira/por-objetivo", label: "Por Objetivo", soPessoa: true },
      { href: "/carteira/estrategia", label: "Estratégia", soPessoa: true },
    ],
  },
  // Decidir junta o que antes eram Simuladores com o "Posso comprar?": o catálogo de perguntas
  // que o app responde com os números da pessoa. O principal já chega sozinho na aba Foco.
  {
    basePath: "/decidir",
    href: "/decidir",
    label: "Decidir",
    icon: Signpost,
    soPessoa: true,
    children: [
      { href: "/decidir", label: "Perguntas" },
      { href: "/decidir/comprar", label: "Posso comprar?" },
    ],
  },
  // Calculadoras com porta própria (06/10/2026). Moravam no fim do Decidir, como "Decisões
  // grandes" + "Ver todas as calculadoras", e nem a Dani achava: "se eu que fiz o app não tô
  // achando, imagina". Decidir são as perguntas sobre o dinheiro dela; aqui, as ferramentas.
  { basePath: "/simuladores", href: "/simuladores", label: "Calculadoras", icon: Calculator, premium: true, soPessoa: true },
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
  // O manual: as regras de importação, orçamento e Foco que ninguém descobre sozinha.
  { basePath: "/guia", href: "/guia", label: "Como usar o app", icon: BookOpen },
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
    { href: "/admin/avisos", label: "Isso está errado?" },
  ],
};

export type MobileTab = {
  basePath: string;
  href: string;
  label: string;
  icon: LucideIcon;
  /** Rotas fora do basePath em que a aba também acende (mesma ideia da `NavSection`). */
  alsoMatches?: string[];
};

/** Destinos de navegação da tab bar inferior. A barra final tem 5 posições:
 * Fluxo | Metas | [ + Registrar ] | Carteira | Mais, o "+" central (registro) e o "Mais"
 * (MoreSheet) são renderizados à parte pelo MobileTabBar, entre e depois destes 3 links. */
export const MOBILE_TABS: MobileTab[] = [
  // Acende também no Orçamento, a quarta aba do Fluxo (ver ROTAS_DO_FLUXO).
  { basePath: "/mensal", href: "/mensal/foco", label: "Fluxo", icon: ArrowLeftRight, alsoMatches: ROTAS_DO_FLUXO },
  { basePath: "/planejamento", href: "/planejamento/metas", label: "Metas", icon: Target },
  { basePath: "/carteira", href: "/carteira", label: "Carteira", icon: Briefcase },
];

/**
 * A aba que entra no lugar da Carteira pra quem não tem a área de investimentos liberada, pra
 * barra não ficar com o "+" fora do meio. Visão Geral porque existe em todo tipo de perfil e
 * não é aba do Fluxo (o Orçamento já acende o "Fluxo"; duas abas acesas juntas confundem).
 * Rótulo curto e fixo: nos temas o nome da seção pode ser longo demais pros 5 espaços da barra.
 */
export const ABA_VISAO_GERAL: MobileTab = { basePath: "/dashboard", href: "/dashboard", label: "Visão geral", icon: LayoutDashboard };

/**
 * As 3 abas da barra de baixo de quem está logado. Sem acesso à área paga, a Carteira sai da
 * barra: era uma das 3 portas principais do celular e abria direto num cadeado, e quem comprou
 * com outro e-mail achava que o app inteiro era pago à parte. Ela continua no "Mais", com o
 * cadeado (ver secoesDoMais).
 */
export function abasDoCelular(isPremium: boolean): MobileTab[] {
  return isPremium ? MOBILE_TABS : MOBILE_TABS.map((tab) => (tab.basePath === "/carteira" ? ABA_VISAO_GERAL : tab));
}

/** Seções que não têm tab própria na barra inferior, acessadas via "Mais". Muda com o acesso:
 * sem a área paga, a Carteira sai da barra e entra aqui, e a Visão Geral faz o caminho inverso.
 * O destaque do "Mais" (AppShell) precisa usar esta mesma lista, senão acende junto com a aba. */
export function secoesDoMais(isPremium: boolean): NavSection[] {
  const abas = abasDoCelular(isPremium);
  return NAV_SECTIONS.filter((section) => !abas.some((tab) => tab.basePath === section.basePath));
}

/** As seções do "Mais" de quem tem a área paga (Carteira na barra de baixo). */
export const MORE_NAV_SECTIONS: NavSection[] = secoesDoMais(true);
