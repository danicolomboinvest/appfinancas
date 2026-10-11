import {
  House,
  Target,
  Wallet,
  Plane,
  Calculator,
  ChartLine,
  MessageCircle,
  SlidersHorizontal,
  CircleHelp,
  ShieldCheck,
  Scale,
  Store,
  type LucideIcon,
} from "lucide-react";
import { ROTAS_DA_VISAO_GERAL } from "./flow-tabs";

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

/**
 * O menu ☰ (versão nova, 11/10/2026): uma lista só, na ordem do protótipo aprovado. Visão
 * geral, Metas, Carteira, Viagem, Calculadoras, Análises, Decidir, Configurações e Como
 * funciona; Dívidas entra quando a área existir (fase 5). A Empresa troca o que é de pessoa
 * física pelo "Vale a pena investir?"; o Casal ganha o "Quanto cada um contribui?".
 *
 * A mesma lista serve à gaveta do celular e à barra lateral do computador.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    basePath: "/mensal",
    href: "/mensal/foco",
    label: "Visão geral",
    icon: House,
    // As quatro abas (Resumo, Orçamento, Transações, Recorrentes) moram em duas pastas, e a
    // Visão geral antiga (/dashboard) continua sendo parte dela.
    alsoMatches: [...ROTAS_DA_VISAO_GERAL.filter((r) => r !== "/mensal"), "/dashboard"],
  },
  {
    basePath: "/planejamento",
    href: "/planejamento/metas",
    label: "Metas",
    icon: Target,
    children: [
      { href: "/planejamento/metas", label: "Metas" },
      { href: "/planejamento/reserva-emergencia", label: "Reserva de Emergência" },
      { href: "/planejamento/acumulo", label: "Aposentadoria", premium: true, soPessoa: true },
    ],
  },
  {
    basePath: "/carteira",
    href: "/carteira",
    label: "Carteira",
    icon: Wallet,
    premium: true,
    children: [
      { href: "/carteira", label: "Meus Ativos" },
      { href: "/carteira/por-objetivo", label: "Por Objetivo", soPessoa: true },
      { href: "/carteira/estrategia", label: "Estratégia", soPessoa: true },
    ],
  },
  { basePath: "/viagem", href: "/viagem", label: "Viagem", icon: Plane, soPessoa: true },
  { basePath: "/simuladores", href: "/simuladores", label: "Calculadoras", icon: Calculator, premium: true, soPessoa: true },
  {
    basePath: "/fichas",
    href: "/fichas",
    label: "Análises",
    icon: ChartLine,
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
    basePath: "/decidir",
    href: "/decidir",
    label: "Decidir",
    icon: MessageCircle,
    soPessoa: true,
    children: [
      { href: "/decidir", label: "Perguntas" },
      { href: "/decidir/comprar", label: "Posso comprar?" },
    ],
  },
  { basePath: "/investir", href: "/investir", label: "Vale a pena investir?", icon: Store, soEmpresa: true },
  { basePath: "/divisao", href: "/divisao", label: "Quanto cada um contribui?", icon: Scale, soCasal: true },
  {
    basePath: "/configuracoes",
    href: "/configuracoes",
    label: "Configurações",
    icon: SlidersHorizontal,
    alsoMatches: ["/perfis"],
    children: [
      { href: "/configuracoes", label: "Geral" },
      { href: "/perfis", label: "Perfis financeiros" },
      { href: "/configuracoes/categorias", label: "Categorias" },
      { href: "/configuracoes/notificacoes", label: "Notificações" },
      { href: "/configuracoes/conexoes", label: "Conexões", flag: "openFinance" },
      { href: "/configuracoes/dados", label: "Dados" },
      { href: "/configuracoes/taxas", label: "Taxas do Sistema" },
    ],
  },
  { basePath: "/guia", href: "/guia", label: "Como funciona", icon: CircleHelp },
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

/**
 * O título no centro do topo: o nome da seção do menu em que a tela está. As telas de fora do
 * menu (perfis, assinatura, Money Reset) caem no nome da marca.
 */
export function tituloDaTela(pathname: string, sections: NavSection[], rotulo: (s: NavSection) => string = (s) => s.label): string {
  const secao = sections.find((s) => sectionMatches(s, pathname));
  return secao ? rotulo(secao) : "SPI Finance";
}

/** O nome no menu e no título do topo: o mesmo nos quatro temas (protótipo aprovado). A
 * Empresa chama a Carteira de Caixa. */
export function rotuloDoMenu(section: Pick<NavSection, "basePath" | "label">, empresa = false): string {
  if (empresa && section.basePath === "/carteira") return "Caixa";
  return section.label;
}
