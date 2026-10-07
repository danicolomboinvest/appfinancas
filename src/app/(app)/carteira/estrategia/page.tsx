import { ehEmpresa } from "@/lib/profiles/empresa";
import { redirect } from "next/navigation";
import type { StrategyAssetClass } from "@prisma/client";
import { getRequiredSession } from "@/lib/auth/session";
import { vozDoTema } from "@/lib/profiles/voice";
import { listPortfolioStrategy } from "@/lib/repositories/portfolio-strategy.repo";
import { STRATEGY_ASSET_CLASSES } from "@/lib/portfolio/strategy";
import { PageHeader } from "@/components/ui/PageHeader";
import { StrategyForm } from "./StrategyForm";
import { listGoalsWithProgress } from "@/lib/repositories/goal.repo";
import { getEmergencyFund } from "@/lib/repositories/emergency-fund.repo";
import { getPlanningParams } from "@/lib/repositories/planning-params.repo";
import { computeAccumulation } from "@/lib/planning/accumulation";
import type { Sonho } from "@/lib/portfolio/estrategia-pelos-sonhos";
import { nowInBrazil } from "@/lib/date/brazil-now";

const MES_MS = 30.4375 * 24 * 60 * 60 * 1000;

export default async function EstrategiaCarteiraPage() {
  const ctx = await getRequiredSession();
  // Empresa não monta estratégia de carteira: só o caixa e os ativos.
  if (ehEmpresa(ctx.profileKind)) redirect("/carteira");
  const voz = vozDoTema(ctx.profileTheme, ctx.profileKind);
  const [rows, goals, fund, params] = await Promise.all([
    listPortfolioStrategy(ctx),
    listGoalsWithProgress(ctx),
    getEmergencyFund(ctx),
    getPlanningParams(ctx),
  ]);

  const defaults = Object.fromEntries(
    STRATEGY_ASSET_CLASSES.map((assetClass) => [
      assetClass,
      Number(rows.find((r) => r.assetClass === assetClass)?.targetPercent ?? 0) * 100,
    ]),
  ) as Record<StrategyAssetClass, number>;

  // Os sonhos dela, com quanto falta e em quantos meses (06/10/2026): a estratégia nasce deles, e
  // não de uma pergunta de prazo único. A reserva é o dinheiro do imprevisto; a liberdade
  // financeira vem do plano de aposentadoria (o que o plano projeta juntar até lá).
  const agora = nowInBrazil();
  const sonhos: Sonho[] = [];
  if (fund) {
    sonhos.push({ id: "reserva", nome: voz.titulos.objReserva, falta: Math.max(0, Number(fund.targetAmount) - Number(fund.currentAmount)), meses: 0, tipo: "reserva" });
  }
  for (const g of goals) {
    sonhos.push({
      id: g.id,
      nome: g.name,
      falta: Math.max(0, Number(g.targetAmount) - g.computedCurrentAmount),
      meses: g.targetDate ? Math.max(0, Math.round((g.targetDate.getTime() - agora.getTime()) / MES_MS)) : null,
      tipo: "meta",
    });
  }
  if (params && params.retirementAge > params.currentAge) {
    const acumulo = computeAccumulation({
      currentAge: params.currentAge,
      retirementAge: params.retirementAge,
      currentPatrimony: Number(params.currentPatrimony),
      monthlyContributionAccumulation: Number(params.monthlyContributionAccumulation),
      accumulationAnnualRate: Number(params.accumulationAnnualRate),
      inflationAnnualRate: Number(params.inflationAnnualRate),
    });
    sonhos.push({
      id: "liberdade",
      nome: voz.titulos.objLiberdade,
      falta: Math.max(0, Math.round(acumulo.finalValueReal - Number(params.currentPatrimony))),
      meses: (params.retirementAge - params.currentAge) * 12,
      tipo: "liberdade",
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Sem a frase fixa embaixo do título (06/10/2026): o convite do jogo já diz o que é. */}
      <PageHeader title={voz.titulos.estrategia} />

      <StrategyForm defaults={defaults} sonhos={sonhos.filter((s) => s.falta > 0)} />
    </div>
  );
}
