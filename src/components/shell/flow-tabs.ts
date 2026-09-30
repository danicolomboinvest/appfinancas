import type { PillTab } from "./PillTabs";

/** Sub-abas do módulo Fluxo Financeiro. O Orçamento passa a viver aqui (item 4), antes ficava
 * escondido no "Mais". Compartilhado entre /mensal e /orcamento pra a navegação ser a mesma. */
export const FLOW_TABS: PillTab[] = [
  { href: "/mensal/foco", label: "Foco" },
  { href: "/mensal", label: "Mensal" },
  { href: "/mensal/gastos", label: "Gastos" },
  { href: "/orcamento", label: "Orçamento" },
];

/**
 * As pastas de rota que formam o módulo Fluxo. São duas porque o Orçamento mora em /orcamento,
 * mas pra quem usa é a quarta aba do Fluxo: a saudação, as abas de cima, o "Fluxo" da barra de
 * baixo e o do menu lateral precisam acender juntos nas duas. Antes cada lugar tinha a própria
 * lista e só o shell lembrava do /orcamento — no Orçamento a barra de baixo ficava sem nenhuma
 * aba acesa, como se a pessoa tivesse saído do app.
 */
export const ROTAS_DO_FLUXO = ["/mensal", "/orcamento"];

/** A tela atual é uma das abas do Fluxo? `/mensalidade` não conta: só a pasta ou o que vem dentro dela. */
export function ehRotaDoFluxo(pathname: string): boolean {
  return ROTAS_DO_FLUXO.some((base) => pathname === base || pathname.startsWith(`${base}/`));
}
