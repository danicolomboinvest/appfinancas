import "server-only";
import { prisma } from "@/lib/db/prisma";
import { doDono, type AuthContext } from "@/lib/auth/session";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { getMonthlySummary } from "@/lib/consolidation/monthly";
import { sobrouDoResumo } from "@/lib/consolidation/sobrou";
import { getMonthlyPlan } from "@/lib/repositories/monthly-plan.repo";
import { getRendaTipica } from "@/lib/planning/typical-expense";
import { rendaDeReferencia } from "@/lib/simulators/worth-it";
import { listAssets } from "@/lib/repositories/asset.repo";
import { listGoalsWithProgress } from "@/lib/repositories/goal.repo";
import { listarContasAPagar } from "@/lib/repositories/conta-a-pagar.repo";
import { getSimulation } from "@/lib/repositories/simulation.repo";
import { acharAluguel, acharMetaDeCarro, titulosDaCarteira, type TituloDaCarteira, type ValorComOrigem } from "./fontes";

export type MetaParaCalculadora = { id: string; nome: string; alvo: number; guardado: number };

export type DadosDasCalculadoras = {
  /** A renda que vale para o valor-hora: plano do mês, renda típica ou o que entrou (ver rendaDeReferencia). */
  renda: number;
  /** Sobrou do mês (entrou − gastou − guardou), só quando é positivo. */
  sobra: number | null;
  /** O total da carteira hoje, quando há ativos. */
  carteira: number | null;
  aluguel: ValorComOrigem | null;
  metaCarro: MetaParaCalculadora | null;
  titulos: TituloDaCarteira[];
  anoAtual: number;
};

/** Lê, para as calculadoras, só o que elas mostram como "do seu app". */
export async function carregarDadosDasCalculadoras(ctx: AuthContext): Promise<DadosDasCalculadoras> {
  const agora = nowInBrazil();
  const ano = agora.getFullYear();
  const mes = agora.getMonth() + 1;
  const anterior = new Date(ano, mes - 2, 1);
  const [resumo, plano, rendaTipica, ativos, metas, contas, lancamentosDeAluguel] = await Promise.all([
    getMonthlySummary(ctx, ano, mes),
    getMonthlyPlan(ctx, ano, mes),
    getRendaTipica(ctx),
    listAssets(ctx),
    listGoalsWithProgress(ctx),
    listarContasAPagar(ctx),
    prisma.monthlyEntry.findMany({
      where: {
        ...doDono(ctx),
        category: "EXPENSE",
        OR: [
          { year: ano, month: mes },
          { year: anterior.getFullYear(), month: anterior.getMonth() + 1 },
        ],
        AND: [{ OR: [{ description: { contains: "aluguel", mode: "insensitive" } }, { subcategory: { contains: "aluguel", mode: "insensitive" } }] }],
      },
      select: { description: true, subcategory: true, amount: true, year: true, month: true },
    }),
  ]);

  const renda = rendaDeReferencia(plano?.plannedIncome, rendaTipica?.valor, resumo.totalIncome).valor;
  const sobrou = sobrouDoResumo(resumo);
  const carteira = ativos.reduce((s, a) => s + Number(a.currentValue), 0);
  const meta = acharMetaDeCarro(metas.map((m) => ({ ...m, icon: String(m.icon) })));

  return {
    renda,
    sobra: sobrou > 0 ? sobrou : null,
    carteira: carteira > 0 ? carteira : null,
    aluguel: acharAluguel(
      contas.map((c) => ({ nome: c.nome, valor: c.valor })),
      lancamentosDeAluguel.map((l) => ({ descricao: l.description, subcategoria: l.subcategory, valor: Number(l.amount), ano: l.year, mes: l.month })),
    ),
    metaCarro: meta ? { id: meta.id, nome: meta.name, alvo: Number(meta.targetAmount), guardado: meta.computedCurrentAmount } : null,
    titulos: titulosDaCarteira(
      ativos.map((a) => ({
        id: a.id,
        name: a.name,
        assetClass: a.assetClass,
        fixedIncomeIndex: a.fixedIncomeIndex,
        investedValue: a.investedValue == null ? null : Number(a.investedValue),
        currentValue: Number(a.currentValue),
        taxaCompra: a.taxaCompra == null ? null : Number(a.taxaCompra),
      })),
    ),
    anoAtual: ano,
  };
}

/**
 * Uma simulação salva, para reabrir na tela ao vivo. Só os números guardados: o resultado é
 * refeito com a conta de hoje (nunca lido de um número velho). Tipo diferente não abre.
 */
export async function lerSimulacaoSalva(ctx: AuthContext, id: string | undefined, tipo: string): Promise<{ id: string; valores: Record<string, number | string> } | null> {
  if (!id) return null;
  const s = await getSimulation(ctx, id);
  if (!s || s.type !== tipo || typeof s.inputJson !== "object" || s.inputJson === null || Array.isArray(s.inputJson)) return null;
  const valores: Record<string, number | string> = {};
  for (const [k, v] of Object.entries(s.inputJson)) if (typeof v === "number" || typeof v === "string") valores[k] = v;
  return { id: s.id, valores };
}
