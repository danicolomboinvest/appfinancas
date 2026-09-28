import type { PillTab } from "./PillTabs";

/** Sub-abas do módulo Fluxo Financeiro. O Orçamento passa a viver aqui (item 4), antes ficava
 * escondido no "Mais". Compartilhado entre /mensal e /orcamento pra a navegação ser a mesma. */
export const FLOW_TABS: PillTab[] = [
  { href: "/mensal/foco", label: "Foco" },
  { href: "/mensal", label: "Mensal" },
  { href: "/mensal/gastos", label: "Gastos" },
  { href: "/orcamento", label: "Orçamento" },
];
