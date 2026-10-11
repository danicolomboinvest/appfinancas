import type { PillTab } from "./PillTabs";

/**
 * As quatro abas da Visão geral (versão nova, 11/10/2026): Resumo, Orçamento, Transações e
 * Recorrentes, em pílulas que deslizam de lado. Moram em duas pastas de rota (/mensal e
 * /orcamento), mas para quem usa são uma área só.
 *
 * `rotas`: o que acende a aba além do próprio href. Transações acende no mês por extenso
 * (/mensal/2026/10) e no "Só gastos"; Recorrentes é a tela das contas que se repetem.
 */
export type AbaDaVisaoGeral = PillTab & { rotas: string[] };

export const ABAS_DA_VISAO_GERAL: AbaDaVisaoGeral[] = [
  { href: "/mensal/foco", label: "Resumo", rotas: ["/mensal/foco", "/dashboard"] },
  { href: "/orcamento", label: "Orçamento", rotas: ["/orcamento"] },
  { href: "/mensal", label: "Transações", rotas: ["/mensal"] },
  { href: "/orcamento/contas", label: "Recorrentes", rotas: ["/orcamento/contas"] },
];

/** Compatibilidade: as abas como lista simples (href e nome). */
export const FLOW_TABS: PillTab[] = ABAS_DA_VISAO_GERAL.map(({ href, label }) => ({ href, label }));

/** As pastas de rota que formam a Visão geral. */
export const ROTAS_DA_VISAO_GERAL = ["/mensal", "/orcamento", "/dashboard"];
/** Nome antigo, mantido para quem ainda importa. */
export const ROTAS_DO_FLUXO = ROTAS_DA_VISAO_GERAL;

function sob(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** A tela atual é uma das abas da Visão geral? `/mensalidade` não conta: só a pasta ou o que vem dentro dela. */
export function ehRotaDoFluxo(pathname: string): boolean {
  return ROTAS_DA_VISAO_GERAL.some((base) => sob(pathname, base));
}
export const ehVisaoGeral = ehRotaDoFluxo;

/**
 * Qual aba acende: a de rota mais específica que casa ("/orcamento/contas" é Recorrentes, não
 * Orçamento; "/mensal/foco" é Resumo, não Transações).
 */
export function abaAtiva(pathname: string): AbaDaVisaoGeral | null {
  let melhor: { aba: AbaDaVisaoGeral; tamanho: number } | null = null;
  for (const aba of ABAS_DA_VISAO_GERAL) {
    for (const rota of aba.rotas) {
      if (sob(pathname, rota) && (!melhor || rota.length > melhor.tamanho)) melhor = { aba, tamanho: rota.length };
    }
  }
  return melhor?.aba ?? null;
}
