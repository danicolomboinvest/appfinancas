import {
  House,
  Target,
  CreditCard,
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
  LayoutGrid,
  TrendingUp,
  Users,
  Tag,
  Shield,
  FileText,
  List,
  Sprout,
  Coffee,
  type LucideIcon,
} from "lucide-react";
import { ROTAS_DA_VISAO_GERAL } from "./flow-tabs";
import type { FerramentasDoMei } from "@/lib/empresa/legal";

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
  /** Rotas dentro do basePath que são de OUTRO item do menu (o ritual mora em /mensal/foco/ritual,
   * mas tem item próprio): a seção não acende nelas. */
  exceto?: string[];
  children?: NavChild[];
  /** Seção que só faz sentido pra pessoa física (viagem, simuladores, análises): some na Empresa. */
  soPessoa?: boolean;
  /** Seção que só faz sentido pra empresa ("Vale a pena investir?"): some nos outros perfis. */
  soEmpresa?: boolean;
  /** Seção que só faz sentido pro casal ("Quanto cada um contribui?"): some nos outros perfis. */
  soCasal?: boolean;
  /** Só para quem comprou o Money Reset (ou é admin), 12/10/2026. */
  soMoneyReset?: boolean;
};

/**
 * As seções que o perfil vê: a Empresa não tem viagem, simuladores nem análises (`soPessoa`);
 * cada tipo tem sua própria ferramenta extra (`soEmpresa`, `soCasal`) que só aparece nele.
 * O Casal continua vendo tudo que é `soPessoa` — a diferença dele pro Pessoal é só ganhar
 * a calculadora de divisão a mais, não perder nada.
 */
export function secoesVisiveis<T extends NavSection>(sections: T[], flags: { empresa: boolean; casal: boolean; moneyReset?: boolean }): T[] {
  return sections.filter((s) => (flags.empresa ? !s.soPessoa : !s.soEmpresa) && (flags.casal || !s.soCasal) && (flags.moneyReset || !s.soMoneyReset));
}

/** Uma rota pertence à seção se está sob o basePath ou sob alguma rota extra declarada.
 * Serve também pras abas da barra de baixo (`MobileTab`), que têm os mesmos dois campos. */
export function sectionMatches(section: Pick<NavSection, "basePath" | "alsoMatches" | "exceto">, pathname: string): boolean {
  const bate = (base: string) => pathname === base || pathname.startsWith(`${base}/`);
  if (section.exceto?.some(bate)) return false;
  return bate(section.basePath) || (section.alsoMatches?.some(bate) ?? false);
}

/**
 * O menu ☰ (versão nova, 11/10/2026): uma lista só, na ordem do protótipo aprovado. Visão
 * geral, Metas, Dívidas, Carteira, Viagem, Calculadoras, Análises, Decidir, Configurações e
 * Como funciona. A Empresa troca o que é de pessoa
 * física pelo "Vale a pena investir?"; o Casal ganha o "Nós dois".
 *
 * A mesma lista serve à gaveta do celular e à barra lateral do computador.
 */
// Regra do menu (11/10/2026, pedido da dona): nenhuma área abre subitens no ☰. Cada área é um
// item só e as abas dela ficam dentro da tela (Carteira, Visão geral, Decidir, Configurações...).
// Só o Admin, que é da dona, guarda a lista de telas, e ela vira abas dentro do /admin.
export const NAV_SECTIONS: NavSection[] = [
  {
    basePath: "/mensal",
    href: "/mensal/foco",
    label: "Visão geral",
    icon: House,
    // As quatro abas (Resumo, Orçamento, Transações, Recorrentes) moram em duas pastas. A Visão
    // geral antiga por ano (/dashboard) saiu em 12/10/2026 e o link velho cai no Resumo.
    alsoMatches: ROTAS_DA_VISAO_GERAL.filter((r) => r !== "/mensal"),
    exceto: ["/mensal/foco/ritual"],
  },
  // O ritual da semana (15/10/2026, feedback de uma cliente): antes só aparecia como sugestão do
  // Resumo às segundas e terças. Agora abre em qualquer dia; fora de segunda e terça mostra a
  // semana que passou. Logo depois da Visão geral, de onde ele sai. A Empresa tem o menu dela.
  { basePath: "/mensal/foco/ritual", href: "/mensal/foco/ritual", label: "Ritual da semana", icon: Coffee, soPessoa: true },
  {
    basePath: "/planejamento",
    href: "/planejamento/metas",
    label: "Metas",
    icon: Target,
    // Sem submenu (aprovado no branch de Metas): a Reserva e a Aposentadoria abrem pelo link
    // discreto no fim da lista de Metas ("Reserva · Liberdade"); as rotas continuam acesas aqui.
  },
  // Dívidas (fase 2, 11/10/2026): logo depois de Metas. A Empresa tem o menu dela, sem esta área.
  { basePath: "/dividas", href: "/dividas", label: "Dívidas", icon: CreditCard, soPessoa: true },
  {
    basePath: "/carteira",
    href: "/carteira",
    label: "Carteira",
    icon: Wallet,
    premium: true,
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
    // Versão nova (11/10/2026): Análises é uma tela só, em anéis. As fichas antigas e os Insights
    // saíram em 12/10/2026 (pedido da dona); os links velhos caem nas Análises.
  },
  {
    basePath: "/decidir",
    href: "/decidir",
    label: "Decidir",
    icon: MessageCircle,
    soPessoa: true,
  },
  { basePath: "/investir", href: "/investir", label: "Vale a pena investir?", icon: Store, soEmpresa: true },
  // Quem comprou o Money Reset não achava onde ele estava (12/10/2026): item próprio, logo depois
  // das áreas principais, só para quem tem o produto.
  { basePath: "/money-reset", href: "/money-reset", label: "Money Reset", icon: Sprout, soMoneyReset: true, soPessoa: true },
  // "Nós dois" (11/10/2026, login do par): o nome do protótipo no menu e no título do topo. A
  // calculadora "Quanto cada um contribui?" continua dentro da tela, com o título dela.
  { basePath: "/divisao", href: "/divisao", label: "Nós dois", icon: Scale, soCasal: true },
  {
    basePath: "/configuracoes",
    href: "/configuracoes",
    label: "Configurações",
    icon: SlidersHorizontal,
    alsoMatches: ["/perfis"],
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
    { href: "/admin/pedidos", label: "Antes de cancelar" },
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

/**
 * O menu ☰ do perfil Empresa (versão nova, 11/10/2026, protótipo "Ateliê da Ana"): no lugar das
 * seções de pessoa física, as ferramentas do negócio. `titulo` é o nome no topo da tela; a Visão
 * geral leva o nome do perfil ("Ateliê da Ana").
 */
export type ItemDaEmpresa = {
  href: string;
  label: string;
  icon: LucideIcon;
  titulo: string;
  novo?: boolean;
  /** Só aparece quando a tela tem o que mostrar (MEI com os números legais na tabela). */
  soComMei?: keyof FerramentasDoMei;
};

export const MENU_DA_EMPRESA: ItemDaEmpresa[] = [
  { href: "/empresa", label: "Visão geral", icon: LayoutGrid, titulo: "" },
  { href: "/empresa/como-vai", label: "Como vai a empresa", icon: TrendingUp, titulo: "Como vai", novo: true },
  { href: "/empresa/clientes", label: "Clientes", icon: Users, titulo: "Clientes", novo: true },
  { href: "/empresa/preco", label: "Preço certo", icon: Tag, titulo: "Quanto cobrar", novo: true },
  { href: "/empresa/limite", label: "Limite do MEI", icon: Shield, titulo: "Limite do MEI", novo: true, soComMei: "limite" },
  { href: "/empresa/impostos", label: "Impostos", icon: FileText, titulo: "Impostos", soComMei: "impostos" },
  { href: "/empresa/relatorios", label: "Relatórios", icon: List, titulo: "Relatórios" },
  { href: "/empresa/configuracoes", label: "Configurações da empresa", icon: SlidersHorizontal, titulo: "Configurações" },
];

/**
 * O menu da Empresa que esta conta vê: sem "em breve" (12/10/2026, pedido da dona). Autônoma e ME
 * não veem Limite do MEI nem Impostos; o MEI vê quando o app tem os números legais para mostrar.
 */
export function menuDaEmpresa(ferramentas: FerramentasDoMei): ItemDaEmpresa[] {
  return MENU_DA_EMPRESA.filter((i) => !i.soComMei || ferramentas[i.soComMei]);
}

/** O que a Empresa já tinha e continua a um toque, depois das ferramentas: o caixa, investir no negócio, a conta e a ajuda. */
export const MAIS_DA_EMPRESA: ItemDaEmpresa[] = [
  { href: "/carteira", label: "Caixa", icon: Wallet, titulo: "Caixa" },
  { href: "/investir", label: "Vale a pena investir?", icon: Store, titulo: "Vale a pena investir?" },
  { href: "/configuracoes", label: "Configurações", icon: SlidersHorizontal, titulo: "Configurações" },
  { href: "/guia", label: "Como funciona", icon: CircleHelp, titulo: "Como funciona" },
];

const TITULOS_EXTRAS_DA_EMPRESA: Record<string, string> = { "/empresa/salario": "Seu salário", "/empresa/recebimentos": "Recebimentos" };

/** O item do menu da Empresa que acende nesta tela (o mais específico). */
export function itemDaEmpresaAtivo(pathname: string): ItemDaEmpresa | null {
  const todos = [...MENU_DA_EMPRESA, ...MAIS_DA_EMPRESA];
  const bate = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  return todos.filter((i) => bate(i.href)).sort((a, b) => b.href.length - a.href.length)[0] ?? null;
}

/** O título do topo nas telas da Empresa: o nome do negócio na Visão geral; nulo fora da área. */
export function tituloDaEmpresa(pathname: string, nomeDoPerfil: string): string | null {
  if (TITULOS_EXTRAS_DA_EMPRESA[pathname]) return TITULOS_EXTRAS_DA_EMPRESA[pathname];
  const item = itemDaEmpresaAtivo(pathname);
  if (!item) return null;
  return item.href === "/empresa" ? nomeDoPerfil : item.titulo;
}
