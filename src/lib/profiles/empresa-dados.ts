import type { ParentCategory } from "@prisma/client";
import type { AuthContext } from "@/lib/auth/session";
import { listAssets } from "@/lib/repositories/asset.repo";
import { listEntriesForMonths } from "@/lib/repositories/monthly-entry.repo";
import { calcularDRE, naturezaDaCategoria, saudeDoCaixa, type DRE, type SaudeDoCaixa } from "./empresa";

/**
 * Os números do perfil Empresa já calculados pra tela: a DRE do período e a saúde do caixa.
 *
 * Fica fora da página porque o painel do ano e a tela do mês usam a mesma conta com
 * períodos diferentes. Só consulta o que a DRE precisa e que a página ainda não tem: o caixa
 * (ativos marcados como reserva) e as despesas fixas dos últimos meses, pra medir em meses
 * quanto o caixa aguenta.
 */
export type DadosDaEmpresa = {
  dre: DRE;
  caixa: SaudeDoCaixa;
  /** Impostos sobre o faturamento do período, 0–1. `null` sem faturamento. */
  cargaTributaria: number | null;
};

export type PeriodoDRE = {
  receita: number;
  retido: number;
  gastoPorCategoria: { parentCategory: string; spent: number }[];
  gastoPersonalizado: number;
};

/** Os N meses fechados antes deste, do mais antigo pro mais recente. */
function mesesAnteriores(year: number, month: number, n: number): { year: number; month: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(year, month - 1 - (n - i), 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });
}

export async function dadosDaEmpresa(ctx: AuthContext, periodo: PeriodoDRE, ref: { year: number; month: number }): Promise<DadosDaEmpresa> {
  const [ativos, historico] = await Promise.all([listAssets(ctx), listEntriesForMonths(ctx, mesesAnteriores(ref.year, ref.month, 3))]);

  const gastoPorCategoria: Partial<Record<ParentCategory, number>> = {};
  for (const g of periodo.gastoPorCategoria) gastoPorCategoria[g.parentCategory as ParentCategory] = (gastoPorCategoria[g.parentCategory as ParentCategory] ?? 0) + g.spent;
  const dre = calcularDRE({ receita: periodo.receita, gastoPorCategoria, gastoPersonalizado: periodo.gastoPersonalizado, retido: periodo.retido });

  // Caixa: o que a empresa marcou como reserva. Despesas fixas: média dos três meses fechados
  // anteriores (com o mês aberto a média cairia no começo de todo mês). Sem histórico, usa o
  // próprio período — melhor um número aproximado que "sem dado" pra quem acabou de começar.
  const caixa = ativos.filter((a) => a.objective === "RESERVA_EMERGENCIA").reduce((s, a) => s + Number(a.currentValue), 0);
  const mesesComGasto = new Set<string>();
  let fixasHistorico = 0;
  for (const e of historico) {
    if (e.category !== "EXPENSE") continue;
    if (naturezaDaCategoria(e.parentCategory) !== "fixa") continue;
    fixasHistorico += Number(e.amount);
    mesesComGasto.add(`${e.year}-${e.month}`);
  }
  const despesasFixasMes = mesesComGasto.size > 0 ? fixasHistorico / mesesComGasto.size : dre.despesasFixas;

  return {
    dre,
    caixa: saudeDoCaixa(caixa, despesasFixasMes),
    cargaTributaria: dre.receitaBruta > 0 ? dre.impostos / dre.receitaBruta : null,
  };
}
