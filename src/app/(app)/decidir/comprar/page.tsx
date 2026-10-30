import Link from "next/link";
import { situacaoDoCartao } from "@/lib/repositories/limite-cartao.repo";
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
import { carregarFoco } from "@/app/(app)/mensal/foco/dados";
import { getTypicalMonthlyExpense } from "@/lib/planning/typical-expense";
import { getRendaMedia } from "@/lib/repositories/renda-media.repo";
import { rendaDeReferencia } from "@/lib/simulators/worth-it";
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
import { PossoComprar } from "./PossoComprar";
import { PerguntaRendaDoCasal } from "./PerguntaRendaDoCasal";
import { responderRendaDoCasalAction } from "@/app/(app)/mensal/foco/actions";
import { ehCasal } from "@/lib/profiles/casal";
import { lerDecisao, listarComprasDecididasDesde } from "@/lib/repositories/decisao.repo";
import { categoryLabel } from "@/lib/categories";
import { carregarParcelasDoMes } from "@/lib/repositories/parcelas.repo";
import { diaDaSemana } from "@/lib/decisoes/foco-semana";
import { getDiaInicioMes } from "@/lib/repositories/user.repo";
import { diasRestantesNoMes, mesDeAgoraDaPessoa, periodoDoMes } from "@/lib/mes/periodo";

/** Rendimento de referência quando a pessoa não informou nenhum (≈ CDI líquido, ao mês). */
const TAXA_PADRAO = 0.009;
const mensal = (anual: number) => (anual > 0 ? Math.pow(1 + anual, 1 / 12) - 1 : 0);

export default async function PossoComprarPage() {
  const ctx = await getRequiredSession();
  // Decidir é da pessoa (regra dos 90% da renda, pequenos gastos): a empresa não vê no menu.
  if (ehEmpresa(ctx.profileKind)) redirect("/mensal/foco");
  const t = vozDoTema(ctx.profileTheme, ctx.profileKind).titulos;
  const now = nowInBrazil();
  // O mês da pessoa (30/10/2026): com o mês começando dia 15, em 05/11 o "mês atual" da compra é
  // outubro (15/10 a 14/11), com os dias restantes dele. Sem dia escolhido, o mês do calendário.
  const diaInicio = await getDiaInicioMes(ctx);
  const { year, month } = mesDeAgoraDaPessoa(now, diaInicio);
  const periodo = periodoDoMes(year, month, diaInicio);
  const diasRestantes = diasRestantesNoMes(now, diaInicio);
  // Casal: antes de qualquer conta, saber o que é a "renda" deste perfil. A resposta muda a regra.
  const casal = ehCasal(ctx.profileKind);
  const rendaDoCasal = casal ? await lerDecisao(ctx, "casal_renda", "renda") : null;
  if (casal && rendaDoCasal === null) {
    return (
      <div className="flex flex-col gap-5">
        <Link href="/decidir" className="flex w-fit items-center gap-1 text-sm text-ink-muted hover:text-ink">
          <ChevronLeft size={16} /> {t.decTitulo}
        </Link>
        <PageHeader title={t.compraTitulo} />
        <PerguntaRendaDoCasal />
      </div>
    );
  }

  // As compras decididas que ainda podem pesar: à vista deste mês e parceladas ainda no prazo
  // (até 420 parcelas: financiamento também). Antes só vinham as deste mês, e a geladeira em 12x decidida no dia 28
  // sumia da conta no dia 1.
  const agora = new Date();
  const desdeParcelas = new Date(Date.UTC(year, month - 1 - MAX_PARCELAS, 1, 3));
  const [budgets, spentByParent, spentByCustom, summary, plan, goals, fund, foco, gastoTipico, rendaMedia, todasDecididas] = await Promise.all([
    listBudgets(ctx, year, month),
    sumExpensesByParentCategory(ctx, year, month),
    sumExpensesByCustomCategory(ctx, year, month),
    getMonthlySummary(ctx, year, month),
    getMonthlyPlan(ctx, year, month),
    listGoalsWithProgress(ctx, diaInicio),
    getEmergencyFund(ctx),
    // O mesmo livre do Resumo (regra A, 13/10/2026): a sobra do dia a dia e o que cabe na semana.
    carregarFoco(ctx),
    getTypicalMonthlyExpense(ctx),
    getRendaMedia(ctx),
    listarComprasDecididasDesde(ctx, desdeParcelas),
  ]);
  const decididas = todasDecididas.filter((d) => compraDecididaEmAberto(d, agora));
  // As parcelas que ela já paga: a regra de não sugerir parcelinha olha a soma de todas, não só a
  // nova. O mesmo número de Recorrentes, do Foco e da Previsão (lib/contas/parcelas-do-mes, 15/10/2026):
  // as do mês, as que continuam e ainda não chegaram na fatura e as contas parceladas, sem as que
  // ela disse "Não é parcela" e, no Casal, com as do outro. Antes era o maior entre os gastos com
  // "/" deste mês e os do mês passado que continuam, só dela e sem as recusas.
  const parcelasNaFatura = (await carregarParcelasDoMes(ctx, { year, month })).total;
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
  // As decididas que ainda não chegaram na fatura somam com as que já aparecem nela.
  const parcelasNoMes = parcelasNaFatura + jaDecidido.parcelaMensal;

  const gastoPorMae = new Map(spentByParent.map((s) => [s.parentCategory as string, s.spent]));
  const gastoPorPersonalizada = new Map(spentByCustom.map((s) => [s.customCategoryId, s.spent]));
  const categorias = budgets
    .filter((b) => Number(b.plannedAmount) > 0)
    .map((b) => ({
      chave: b.parentCategory ?? "",
      nome: b.parentCategory ? categoryLabel(ctx.categorias ?? ctx.profileKind, b.parentCategory) : "",
      planejado: Number(b.plannedAmount),
      gasto: b.parentCategory ? (gastoPorMae.get(b.parentCategory) ?? 0) : (gastoPorPersonalizada.get(b.customCategoryId ?? "") ?? 0),
    }));
  // O livre do mês da fonte única (lib/planning/livre-do-mes, 15/10/2026): o plano do mês menos o
  // que já saiu, o mesmo número do Orçamento. Antes era a sobra do dia a dia cortada pela renda, e
  // no dia 2 de novembro, com o plano montado, a tela dizia "Seu livre de novembro é R$ 0".
  const livreDoMes = foco.livreDoMes;
  const gastoPlanejado = livreDoMes.tipo === "plano" ? livreDoMes.planejado : 0;
  const sobraDoMes = livreDoMes.tipo === "plano" ? livreDoMes.valor : 0;
  // A semana continua a do Resumo (regra A): é o "Livre nesta semana", outro número.
  const livre = foco.foco.livre;
  const semanaRestante = livre.tipo === "semOrcamento" ? undefined : livre.semana.restante;

  // Renda: o plano do mês; sem plano, a MÉDIA dos últimos 12 meses fechados (pedido da Dani,
  // 13/10/2026: nunca o último mês sozinho); sem histórico, o que entrou até agora. A tela diz qual.
  const { valor: renda, fonte: fonteRenda } = rendaDeReferencia(plan?.plannedIncome, rendaMedia?.valor, summary.totalIncome);
  const mesesDaRenda = fonteRenda === "media" ? (rendaMedia?.meses ?? null) : null;

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

  // Limite do cartão do mês (06/10/2026): o resultado diz quanto falta nele.
  const limiteDoCartao = await situacaoDoCartao(ctx, year, month);
  const base: CompraBase = {
    renda,
    gastoPlanejado,
    sobraDoMes,
    ...(semanaRestante !== undefined ? { semanaRestante } : {}),
    diasRestantes,
    diasAteDomingo: diaDaSemana(now).diasAteDomingo,
    metas,
    taxaReferencia: fund && Number(fund.annualRate) > 0 ? mensal(Number(fund.annualRate)) : TAXA_PADRAO,
    reservaComSaldo: Boolean(fund && Number(fund.currentAmount) > 0),
    // Média do que ela gastou de fato nos últimos meses fechados (inclui parcelas antigas).
    gastoReal: gastoTipico?.monthlyAverage ?? null,
    // O "Já saiu" do passo 5: o mesmo gasto do livre (planejado − já saiu = livre).
    gastoDoMesAtual: livreDoMes.tipo === "plano" ? livreDoMes.gasto : summary.totalExpense,
    guardarPlanejado: plan?.plannedInvestment ?? null,
    fonteRenda,
    mesesDaRenda,
    regra90: rendaDoCasal !== "conjunta",
    jaDecidido,
    // Só as categorias padrão: é delas que saem os cortes sugeridos ("Como fazer caber").
    categorias: categorias.filter((c) => c.chave),
    ...(limiteDoCartao ? { cartao: { limite: limiteDoCartao.limite, gasto: limiteDoCartao.gasto } } : {}),
  };

  return (
    <div className="flex flex-col gap-3">
      {casal && (
        <form action={responderRendaDoCasalAction.bind(null, rendaDoCasal === "conjunta" ? "casal" : "conjunta")} className="-mt-2 flex flex-wrap items-center gap-x-2 text-caption text-ink-muted">
          Renda considerada: {rendaDoCasal === "conjunta" ? "só o que cada um põe na conta conjunta" : "a do casal inteira"}.
          <button type="submit" className="font-semibold text-accent-strong hover:underline">
            Trocar
          </button>
        </form>
      )}
      <PossoComprar base={base} hoje={{ ano: year, mes: month }} parcelasNoMes={parcelasNoMes} ultimoDiaDoMes={periodo.fim.getDate()} />
    </div>
  );
}
