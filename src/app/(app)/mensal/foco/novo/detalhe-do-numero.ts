import { somaAteODia, type GastoDoDia } from "./regras";

/**
 * "O que entrou nos R$ 2.282" (pedido da Dani, 14/10/2026): tocar no número grande do Resumo abre
 * os lançamentos que somam esse número, por categoria. A regra é a MESMA do número (somaAteODia):
 * gasto do mês com dia até o corte, e o gasto sem dia conta desde o dia 1. O que fica de fora
 * (gasto depois do corte, aplicação) vai para "Fora da conta", com o porquê.
 */

export type LancamentoDoNumero = GastoDoDia & { id: string; descricao: string };
export type CategoriaDoNumero = { categoria: string; total: number; itens: LancamentoDoNumero[] };
export type MotivoDeFora = "depois" | "aplicacao";
export type ForaDoNumero = LancamentoDoNumero & { motivo: MotivoDeFora };
export type DetalheDoNumero = { corte: number; total: number; n: number; categorias: CategoriaDoNumero[]; fora: ForaDoNumero[] };

const centavos = (v: number) => Math.round(v * 100) / 100;
/** O mesmo teste do somaAteODia: é ele que decide o que entra no número. */
const entra = (g: Pick<GastoDoDia, "dia">, corte: number) => (g.dia ?? 1) <= corte;
/** Dia mais recente primeiro; o sem dia por último. Mesmo dia: o maior primeiro. */
const ordem = (a: LancamentoDoNumero, b: LancamentoDoNumero) => (b.dia ?? 0) - (a.dia ?? 0) || b.valor - a.valor;

export function detalharONumero(gastos: LancamentoDoNumero[], corte: number, aplicacoes: LancamentoDoNumero[] = []): DetalheDoNumero {
  const dentro = gastos.filter((g) => entra(g, corte));
  const porCategoria = new Map<string, LancamentoDoNumero[]>();
  for (const g of dentro) porCategoria.set(g.categoria, [...(porCategoria.get(g.categoria) ?? []), g]);
  const categorias = [...porCategoria.entries()]
    .map(([categoria, itens]) => ({ categoria, total: centavos(itens.reduce((s, g) => s + g.valor, 0)), itens: [...itens].sort(ordem) }))
    .sort((a, b) => b.total - a.total);
  const fora: ForaDoNumero[] = [
    ...gastos.filter((g) => !entra(g, corte)).map((g) => ({ ...g, motivo: "depois" as const })),
    ...aplicacoes.filter((g) => entra(g, corte)).map((g) => ({ ...g, motivo: "aplicacao" as const })),
  ].sort(ordem);
  return { corte, total: somaAteODia(gastos, corte), n: dentro.length, categorias, fora };
}
