import type { Grupo } from "@/lib/portfolio/classificacao";

/**
 * A cor de cada grupo do "Por tipo" (rodada 39: uma cor por classe, na família das categorias do
 * tema; o dourado fica como acento da marca). Só tokens que cada tema já pinta do seu jeito.
 */
export const COR_DO_GRUPO: Record<Grupo, string> = {
  tesouro: "var(--color-strat-ipca)",
  rendafixa: "var(--color-strat-pos)",
  fiis: "var(--color-strat-fiis)",
  acoes: "var(--color-strat-acoes)",
  exterior: "var(--color-strat-exterior)",
  fundos: "var(--color-strat-pre)",
  cripto: "var(--color-chart-5)",
  outros: "var(--color-strat-outros)",
};
