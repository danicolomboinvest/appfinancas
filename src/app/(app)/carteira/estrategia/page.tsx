import { redirect } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ehEmpresa } from "@/lib/profiles/empresa";
import { getPortfolioStrategyComparison } from "@/lib/portfolio/strategy";
import { listGoalsWithProgress } from "@/lib/repositories/goal.repo";
import { getEmergencyFund } from "@/lib/repositories/emergency-fund.repo";
import { getPlanningParams } from "@/lib/repositories/planning-params.repo";
import { listAssets } from "@/lib/repositories/asset.repo";
import { computeAccumulation } from "@/lib/planning/accumulation";
import { liberdadeEmValorDeHoje, type Sonho } from "@/lib/portfolio/estrategia-pelos-sonhos";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { getMonthlyPlan } from "@/lib/repositories/monthly-plan.repo";
import { mesesDeReserva } from "@/lib/planning/savings-split";
import { acharMetaDaReserva, reservaDaPessoa } from "@/lib/portfolio/reserva-da-pessoa";
import { getTypicalMonthlyExpense } from "@/lib/planning/typical-expense";
import { EstrategiaResumo } from "./EstrategiaResumo";
import { MontarEstrategia } from "./MontarEstrategia";

const MES_MS = 30.4375 * 24 * 60 * 60 * 1000;

/**
 * Carteira › Estratégia (rodadas 16, 22 e 32). Informativa, não manda fazer: o perfil, cada
 * classe com "hoje" e "meta" lado a lado, uma frase curta, Personalizar e Refazer. Sem estratégia
 * (ou no Refazer), o "Montar minha estratégia" em 7 passos, com as regras novas (3.13): exterior
 * pelo plano em outra moeda, proventos, a Liberdade no valor de hoje, teto pela queda e a regra
 * dos aportes da reserva (3.11).
 */
export default async function EstrategiaCarteiraPage({ searchParams }: { searchParams: Promise<{ montar?: string }> }) {
  const ctx = await getRequiredSession();
  if (ehEmpresa(ctx.profileKind)) redirect("/carteira");
  const { montar } = await searchParams;
  const [comparacao, goals, fund, params, assets, perfil, gastoTipico] = await Promise.all([
    getPortfolioStrategyComparison(ctx),
    listGoalsWithProgress(ctx),
    getEmergencyFund(ctx),
    getPlanningParams(ctx),
    listAssets(ctx),
    prisma.financialProfile.findFirst({ where: { id: ctx.profileId, userId: ctx.userId }, select: { perfilInvestidor: true } }),
    getTypicalMonthlyExpense(ctx),
  ]);
  // A reserva é a meta "Reserva de emergência" (decisão da dona, 12/10/2026); quem tinha a do
  // simulador antigo fica com o maior dos dois valores (lib/portfolio/reserva-da-pessoa.ts).
  const metaDaReserva = acharMetaDaReserva(goals);
  const naReserva = assets.filter((a) => a.objective === "RESERVA_EMERGENCIA").reduce((s, a) => s + Number(a.currentValue), 0);
  const reserva = reservaDaPessoa({
    meta: metaDaReserva ? { id: metaDaReserva.id, icon: metaDaReserva.icon, name: metaDaReserva.name, targetAmount: Number(metaDaReserva.targetAmount), atual: metaDaReserva.computedCurrentAmount } : null,
    antiga: fund ? { atual: Number(fund.currentAmount), alvo: Number(fund.targetAmount), custoDeVida: Number(fund.monthlyExpenseBase) } : null,
    naCarteira: naReserva,
    gastoTipico: gastoTipico?.monthlyAverage ?? null,
  });
  const temEstrategia = comparacao.positions.some((p) => p.targetPercent > 0);

  if (temEstrategia && montar !== "1") {
    // "Seus próximos aportes": o guardar do plano do mês; sem plano, a média dos aportes dos 3
    // últimos meses; sem nenhum dos dois, a tela pergunta o valor.
    const hoje = nowInBrazil();
    const plano = await getMonthlyPlan(ctx, hoje.getFullYear(), hoje.getMonth() + 1);
    let valor: number | null = plano && plano.plannedInvestment > 0 ? plano.plannedInvestment : null;
    if (valor === null) {
      const meses = [1, 2, 3].map((k) => new Date(hoje.getFullYear(), hoje.getMonth() - k, 1));
      const r = await prisma.monthlyEntry.aggregate({
        where: { userId: ctx.userId, profileId: ctx.profileId, category: "INVESTMENT_CONTRIBUTION", amount: { gt: 0 }, OR: meses.map((d) => ({ year: d.getFullYear(), month: d.getMonth() + 1 })) },
        _sum: { amount: true },
      });
      const media = Number(r._sum.amount ?? 0) / 3;
      valor = media > 0 ? Math.round(media * 100) / 100 : null;
    }
    return (
      <EstrategiaResumo
        perfil={perfil?.perfilInvestidor ?? null}
        linhas={comparacao.positions.map((p) => ({ classe: p.assetClass, hoje: p.currentPercent, meta: p.targetPercent }))}
        proximos={{
          valor,
          origem: plano && plano.plannedInvestment > 0 ? "plano" : valor !== null ? "media" : null,
          posicoes: comparacao.positions.map((p) => ({ assetClass: p.assetClass, currentValue: p.currentValue, targetPercent: p.targetPercent })),
          mesesDeReserva: reserva && reserva.custoDeVida > 0 ? mesesDeReserva(reserva.atual, reserva.custoDeVida) : null,
          reservaCompleta: reserva ? reserva.atual >= reserva.meta && reserva.meta > 0 : false,
          semReserva: !reserva,
        }}
      />
    );
  }

  // Os sonhos dela, com quanto falta e em quantos meses: a estratégia nasce deles.
  const agora = nowInBrazil();
  const sonhos: Sonho[] = [];
  if (reserva) sonhos.push({ id: "reserva", nome: "Reserva", falta: Math.max(0, reserva.meta - reserva.atual), meses: 0, tipo: "reserva" });
  for (const g of goals) {
    // A meta "Reserva de emergência" é a própria reserva: não conta duas vezes.
    if (reserva && (g.id === reserva.idDaMeta || /reserva/i.test(g.name))) continue;
    sonhos.push({
      id: g.id,
      nome: g.name,
      falta: Math.max(0, Number(g.targetAmount) - g.computedCurrentAmount),
      meses: g.targetDate ? Math.max(0, Math.round((g.targetDate.getTime() - agora.getTime()) / MES_MS)) : null,
      tipo: "meta",
    });
  }
  if (params && params.retirementAge > params.currentAge) {
    const anos = params.retirementAge - params.currentAge;
    const acumulo = computeAccumulation({
      currentAge: params.currentAge,
      retirementAge: params.retirementAge,
      currentPatrimony: Number(params.currentPatrimony),
      monthlyContributionAccumulation: Number(params.monthlyContributionAccumulation),
      accumulationAnnualRate: Number(params.accumulationAnnualRate),
      inflationAnnualRate: Number(params.inflationAnnualRate),
    });
    // O que falta, trazido para o valor de hoje antes de pesar (decisão da rodada 22).
    const faltaNoFuturo = Math.max(0, acumulo.finalValueNominal - Number(params.currentPatrimony));
    sonhos.push({ id: "liberdade", nome: "Liberdade", falta: liberdadeEmValorDeHoje(faltaNoFuturo, anos, Number(params.inflationAnnualRate)), meses: anos * 12, tipo: "liberdade" });
  }

  return (
    <MontarEstrategia
      sonhos={sonhos}
      totalDaCarteira={comparacao.totalPortfolio}
      reserva={reserva ? { atual: reserva.atual, meta: reserva.meta, custoDeVida: reserva.custoDeVida } : null}
      podeCancelar={temEstrategia}
    />
  );
}
