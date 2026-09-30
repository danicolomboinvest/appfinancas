import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { ehEmpresa } from "@/lib/profiles/empresa";
import { redirect } from "next/navigation";
import { vozDoTema } from "@/lib/profiles/voice";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { getMonthlySummary } from "@/lib/consolidation/monthly";
import { listBudgets, sumExpensesByParentCategory, sumExpensesByCustomCategory } from "@/lib/repositories/budget.repo";
import { getMonthlyPlan } from "@/lib/repositories/monthly-plan.repo";
import { listGoalsWithProgress } from "@/lib/repositories/goal.repo";
import { getEmergencyFund } from "@/lib/repositories/emergency-fund.repo";
import { contarGastosReaisDoMes } from "@/lib/repositories/monthly-entry.repo";
import { getRendaTipica, getTypicalMonthlyExpense } from "@/lib/planning/typical-expense";
import { computeGoalPlan } from "@/lib/planning/goal";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  compraDecididaEmAberto,
  comprasAindaNaoLancadas,
  FOLGA_LANCAMENTO_MS,
  MAX_PARCELAS,
  toleranciaDoLancamento,
  valorDoLancamentoEsperado,
  type CompraBase,
  type CompraMeta,
} from "@/lib/decisoes/posso-comprar";
import { prisma } from "@/lib/db/prisma";
import { lerRitmo } from "@/app/(app)/mensal/foco/ritmo";
import { getOwnUser } from "@/lib/repositories/user.repo";
import { PossoComprar } from "./PossoComprar";
import { PerguntaRendaDoCasal } from "./PerguntaRendaDoCasal";
import { responderRendaDoCasalAction } from "@/app/(app)/mensal/foco/actions";
import { ehCasal } from "@/lib/profiles/casal";
import { lerDecisao, listarComprasDecididasDesde } from "@/lib/repositories/decisao.repo";

/** Rendimento de referência quando a pessoa não informou nenhum (≈ CDI líquido, ao mês). */
const TAXA_PADRAO = 0.009;
const mensal = (anual: number) => (anual > 0 ? Math.pow(1 + anual, 1 / 12) - 1 : 0);

export default async function PossoComprarPage() {
  const ctx = await getRequiredSession();
  // Decidir é da pessoa (regra dos 90% da renda, pequenos gastos): a empresa não vê no menu.
  if (ehEmpresa(ctx.profileKind)) redirect("/mensal/foco");
  const t = vozDoTema(ctx.profileTheme, ctx.profileKind).titulos;
  const now = nowInBrazil();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const diasNoMes = new Date(year, month, 0).getDate();
  const diasRestantes = Math.max(1, diasNoMes - now.getDate() + 1);
  const ritmo = lerRitmo((await getOwnUser(ctx)).ritmoAcompanhamento) ?? "semanal";
  // Casal: antes de qualquer conta, saber o que é a "renda" deste perfil. A resposta muda a regra.
  const casal = ehCasal(ctx.profileKind);
  const rendaDoCasal = casal ? await lerDecisao(ctx, "casal_renda", "renda") : null;
  if (casal && rendaDoCasal === null) {
    return (
      <div className="flex flex-col gap-5">
        <Link href="/decidir" className="flex w-fit items-center gap-1 text-sm text-ink-muted hover:text-ink">
          <ChevronLeft size={16} /> {t.decTitulo}
        </Link>
        <PageHeader title={t.compraTitulo} subtitle="Uma pergunta antes da primeira conta." />
        <PerguntaRendaDoCasal />
      </div>
    );
  }

  // As compras decididas que ainda podem pesar: à vista deste mês e parceladas ainda no prazo
  // (até 48 parcelas). Antes só vinham as deste mês, e a geladeira em 12x decidida no dia 28
  // sumia da conta no dia 1.
  const agora = new Date();
  const desdeParcelas = new Date(Date.UTC(year, month - 1 - MAX_PARCELAS, 1, 3));
  const [budgets, spentByParent, spentByCustom, summary, plan, goals, fund, gastosReais, gastoTipico, rendaTipica, todasDecididas] = await Promise.all([
    listBudgets(ctx, year, month),
    sumExpensesByParentCategory(ctx, year, month),
    sumExpensesByCustomCategory(ctx, year, month),
    getMonthlySummary(ctx, year, month),
    getMonthlyPlan(ctx, year, month),
    listGoalsWithProgress(ctx),
    getEmergencyFund(ctx),
    contarGastosReaisDoMes(ctx, year, month),
    getTypicalMonthlyExpense(ctx),
    getRendaTipica(ctx),
    listarComprasDecididasDesde(ctx, desdeParcelas),
  ]);
  const decididas = todasDecididas.filter((d) => compraDecididaEmAberto(d, agora));
  // Os gastos lançados depois de cada decisão com o valor dela (ou da parcela): só esses dizem
  // se a compra já está nos números. Busca por faixa de valor pra não varrer anos de lançamentos.
  const faixas = decididas
    .filter((d) => d.valor > 0)
    .map((d) => {
      const esperado = valorDoLancamentoEsperado(d);
      const tolerancia = toleranciaDoLancamento(esperado);
      return { amount: { gte: esperado - tolerancia, lte: esperado + tolerancia }, createdAt: { gte: new Date(d.criadaEm.getTime() - FOLGA_LANCAMENTO_MS) } };
    });
  const lancados =
    faixas.length > 0
      ? await prisma.monthlyEntry.findMany({
          where: { userId: ctx.userId, profileId: ctx.profileId, category: "EXPENSE", amount: { gt: 0 }, OR: faixas },
          select: { amount: true, createdAt: true },
          take: 2000,
        })
      : [];
  // O "Vou comprar" só registra a decisão; até o extrato ou a fatura chegar, a compra não está
  // nos números. Sem contar essas, o mesmo dinheiro livre aprovava a segunda e a terceira compra.
  const jaDecidido = comprasAindaNaoLancadas(
    decididas,
    lancados.map((g) => ({ valor: Number(g.amount), criadoEm: g.createdAt })),
    agora,
  );

  const gastoPorMae = new Map(spentByParent.map((s) => [s.parentCategory as string, s.spent]));
  const gastoPorPersonalizada = new Map(spentByCustom.map((s) => [s.customCategoryId, s.spent]));
  const categorias = budgets
    .filter((b) => Number(b.plannedAmount) > 0)
    .map((b) => ({
      planejado: Number(b.plannedAmount),
      gasto: b.parentCategory ? (gastoPorMae.get(b.parentCategory) ?? 0) : (gastoPorPersonalizada.get(b.customCategoryId ?? "") ?? 0),
    }));
  const gastoPlanejado = categorias.reduce((s, c) => s + c.planejado, 0);
  // Mesma regra da aba Foco: quem fecha por mês e ainda não lançou nada tem a sobra estimada.
  const semDado = ritmo === "mensal" && gastosReais === 0;
  const sobraDoMes = semDado
    ? (gastoPlanejado * diasRestantes) / diasNoMes
    : // Igual ao "livre" do Foco: estouro numa categoria e gasto fora do orçamento saem do mesmo bolso.
      Math.min(
        categorias.reduce((s, c) => s + Math.max(0, c.planejado - c.gasto), 0),
        Math.max(0, gastoPlanejado - Math.max(summary.totalExpense, categorias.reduce((s, c) => s + c.gasto, 0))),
      );

  // Renda: o plano do mês; sem plano, a renda TÍPICA (mediana dos últimos meses, que não se
  // deixa levar pelo 13º); sem histórico, o que entrou até agora. A tela diz qual foi usada.
  const [renda, fonteRenda]: [number, "plano" | "media" | "mes"] =
    plan && plan.plannedIncome > 0 ? [plan.plannedIncome, "plano"] : rendaTipica ? [rendaTipica.valor, "media"] : [summary.totalIncome, "mes"];

  const metas: CompraMeta[] = goals.flatMap((g) => {
    // Meta sem data também recebe dinheiro todo mês: entra como a mais distante de todas.
    if (!g.targetDate) {
      const aporte = Number(g.monthlyContribution ?? 0);
      if (!(aporte > 0) || g.computedCurrentAmount >= Number(g.targetAmount)) return [];
      return [{ id: g.id, nome: g.name, atual: g.computedCurrentAmount, alvo: Number(g.targetAmount), aporte, taxa: mensal(Number(g.annualRate ?? 0)), prazoMeses: 0 }];
    }
    const p = computeGoalPlan({
      targetAmount: Number(g.targetAmount),
      currentAmount: g.computedCurrentAmount,
      targetDate: g.targetDate,
      annualRate: Number(g.annualRate ?? 0),
      startedAt: g.createdAt,
    });
    if (p.status === "ACHIEVED") return [];
    // O quanto a meta pede por mês vem do plano ATUAL dela (o mesmo número do Foco e de Metas),
    // não do valor salvo quando a meta foi criada, que envelhece. Vencida ou com prazo neste mês:
    // o "necessário" é o total que falta, não um aporte mensal; ela sai do guardado e dos cortes.
    const aporte = p.monthsRemaining > 0 ? p.requiredMonthlyContribution : 0;
    if (!(aporte > 0)) return [];
    const mesesAtePrazo = (g.targetDate.getUTCFullYear() - year) * 12 + (g.targetDate.getUTCMonth() + 1 - month);
    // Prazo 0 é o sinal de "sem data" (a mais distante). Vencida ou deste mês é a MAIS urgente: 1.
    return [
      {
        id: g.id,
        nome: g.name,
        atual: g.computedCurrentAmount,
        alvo: Number(g.targetAmount),
        aporte,
        taxa: p.monthlyRate,
        prazoMeses: Math.max(1, p.monthsRemaining),
        status: p.status,
        mesesAtePrazo: mesesAtePrazo > 0 ? mesesAtePrazo : undefined,
      },
    ];
  });
  if (fund && Number(fund.currentAmount) < Number(fund.targetAmount) && Number(fund.monthlyContribution) > 0) {
    metas.push({
      id: "reserva",
      nome: "Reserva de emergência",
      atual: Number(fund.currentAmount),
      alvo: Number(fund.targetAmount),
      aporte: Number(fund.monthlyContribution),
      taxa: mensal(Number(fund.annualRate)),
      prazoMeses: 0,
      reserva: true,
    });
  }

  const base: CompraBase = {
    renda,
    gastoPlanejado,
    sobraDoMes,
    diasRestantes,
    metas,
    taxaReferencia: fund && Number(fund.annualRate) > 0 ? mensal(Number(fund.annualRate)) : TAXA_PADRAO,
    reservaComSaldo: Boolean(fund && Number(fund.currentAmount) > 0),
    // Média do que ela gastou de fato nos últimos meses fechados (inclui parcelas antigas).
    gastoReal: gastoTipico?.monthlyAverage ?? null,
    gastoDoMesAtual: summary.totalExpense,
    guardarPlanejado: plan?.plannedInvestment ?? null,
    fonteRenda,
    regra90: rendaDoCasal !== "conjunta",
    jaDecidido,
  };

  return (
    <div className="flex flex-col gap-5">
      <Link href="/decidir" className="flex w-fit items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ChevronLeft size={16} /> {t.decTitulo}
      </Link>
      <PageHeader title={t.compraTitulo} subtitle={t.compraSub} />
      {casal && (
        <form action={responderRendaDoCasalAction.bind(null, rendaDoCasal === "conjunta" ? "casal" : "conjunta")} className="-mt-2 flex flex-wrap items-center gap-x-2 text-caption text-ink-muted">
          Renda considerada: {rendaDoCasal === "conjunta" ? "só o que cada um põe na conta conjunta" : "a do casal inteira"}.
          <button type="submit" className="font-semibold text-accent-strong hover:underline">
            Trocar
          </button>
        </form>
      )}
      <PossoComprar base={base} hoje={{ ano: year, mes: month }} />
    </div>
  );
}
