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
  const [comparacao, goals, fund, params, assets, perfil] = await Promise.all([
    getPortfolioStrategyComparison(ctx),
    listGoalsWithProgress(ctx),
    getEmergencyFund(ctx),
    getPlanningParams(ctx),
    listAssets(ctx),
    prisma.financialProfile.findFirst({ where: { id: ctx.profileId, userId: ctx.userId }, select: { perfilInvestidor: true } }),
  ]);
  const temEstrategia = comparacao.positions.some((p) => p.targetPercent > 0);

  if (temEstrategia && montar !== "1") {
    return (
      <EstrategiaResumo
        perfil={perfil?.perfilInvestidor ?? null}
        linhas={comparacao.positions.map((p) => ({ classe: p.assetClass, hoje: p.currentPercent, meta: p.targetPercent }))}
      />
    );
  }

  // Os sonhos dela, com quanto falta e em quantos meses: a estratégia nasce deles.
  const agora = nowInBrazil();
  const naReserva = assets.filter((a) => a.objective === "RESERVA_EMERGENCIA").reduce((s, a) => s + Number(a.currentValue), 0);
  const reservaAtual = fund ? Math.max(Number(fund.currentAmount), naReserva) : naReserva;
  const reservaMeta = fund ? Number(fund.targetAmount) : 0;
  const custoDeVida = fund ? Number(fund.monthlyExpenseBase) : 0;
  const sonhos: Sonho[] = [];
  if (fund) sonhos.push({ id: "reserva", nome: "Reserva", falta: Math.max(0, reservaMeta - reservaAtual), meses: 0, tipo: "reserva" });
  for (const g of goals) {
    // A meta "Reserva de emergência" é a mesma reserva: não conta duas vezes.
    if (fund && /reserva/i.test(g.name)) continue;
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
      reserva={fund ? { atual: reservaAtual, meta: reservaMeta, custoDeVida } : null}
      podeCancelar={temEstrategia}
    />
  );
}
