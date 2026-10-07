import { getRequiredSession } from "@/lib/auth/session";
import { vozDoTema } from "@/lib/profiles/voice";
import { ehEmpresa } from "@/lib/profiles/empresa";
import { listAssets } from "@/lib/repositories/asset.repo";
import { listGoals } from "@/lib/repositories/goal.repo";
import { listUpcomingDividendsForUser } from "@/lib/repositories/dividend.repo";
import {
  getPortfolioStrategyComparison,
  STRATEGY_ASSET_CLASS_LABEL,
} from "@/lib/portfolio/strategy";
import { PageHeader } from "@/components/ui/PageHeader";
import { AssetsSection, type StrategySummary } from "./AssetsSection";
import { buildStrategyBullets, summarizeStrategy } from "@/lib/portfolio/strategy-bullets";
import { UpcomingDividendsSection } from "./UpcomingDividendsSection";
import { ContributionCard } from "./ContributionCard";
import { getContributionContext } from "@/lib/portfolio/contribution";
import { assetIdsWithAllocationsIn, getContributionLinkState, getWithdrawalLinkState } from "@/lib/portfolio/contribution-link";
import { AllocateContributionCard } from "./AllocateContributionCard";
import { PARENT_CATEGORY_COLOR } from "@/lib/categories";
import { serverMoney } from "@/lib/money-server";
import { nowInBrazil } from "@/lib/date/brazil-now";

export default async function CarteiraPage() {
  const ctx = await getRequiredSession();
  const voz = vozDoTema(ctx.profileTheme, ctx.profileKind);
  const empresa = ehEmpresa(ctx.profileKind);
  // Relógio de Brasília, igual ao /mensal e às actions: às 22h do dia 30 o mês ainda é este.
  const now = nowInBrazil();
  const mesPassado = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const [assets, goals, comparison, dividends, contribution, aporteDoMes, money, aporteDoMesPassado, comAporteRecente, resgateDoMes, resgateDoMesPassado] = await Promise.all([
    listAssets(ctx),
    listGoals(ctx),
    getPortfolioStrategyComparison(ctx),
    listUpcomingDividendsForUser(ctx),
    getContributionContext(ctx, now.getFullYear(), now.getMonth() + 1),
    getContributionLinkState(ctx, now.getFullYear(), now.getMonth() + 1),
    serverMoney(),
    getContributionLinkState(ctx, mesPassado.getFullYear(), mesPassado.getMonth() + 1),
    assetIdsWithAllocationsIn(ctx, [
      { year: now.getFullYear(), month: now.getMonth() + 1 },
      { year: mesPassado.getFullYear(), month: mesPassado.getMonth() + 1 },
    ]),
    getWithdrawalLinkState(ctx, now.getFullYear(), now.getMonth() + 1),
    getWithdrawalLinkState(ctx, mesPassado.getFullYear(), mesPassado.getMonth() + 1),
  ]);
  const goalNameById = new Map(goals.map((goal) => [goal.id, goal.name]));
  // Ordem da pergunta: primeiro os ativos ligados a uma meta (o dinheiro costuma ir pra lá),
  // depois os maiores. Assim os seis primeiros já respondem quase sempre.
  const ativosPraDistribuir = [...assets]
    .sort((a, b) => Number(Boolean(b.goalId)) - Number(Boolean(a.goalId)) || Number(b.currentValue) - Number(a.currentValue))
    .map((a) => ({
      id: a.id,
      name: a.name,
      ticker: a.ticker,
      goalName: a.goalId ? (goalNameById.get(a.goalId) ?? null) : null,
      color: PARENT_CATEGORY_COLOR.OUTROS,
    }));

  // A Estratégia da Carteira é a alocação ideal, vira o gráfico-alvo e a dica de
  // rebalanceamento na tela principal (o detalhe completo continua em Por Objetivo).
  const hasStrategy = comparison.positions.some((p) => p.targetPercent > 0);
  const strategy: StrategySummary = {
    hasStrategy,
    bullets: buildStrategyBullets(comparison.positions),
    balance: summarizeStrategy(comparison.positions),
    suggestions: comparison.positions
      .filter((p) => p.status !== "DENTRO")
      .sort((a, b) => Math.abs(b.rebalanceAmount) - Math.abs(a.rebalanceAmount))
      .slice(0, 3)
      .map((p) => ({
        label: STRATEGY_ASSET_CLASS_LABEL[p.assetClass],
        amount: p.rebalanceAmount,
      })),
  };

  // O que ela guardou (ou resgatou) e ainda não disse em qual ativo: era um cartão no topo daqui e
  // um aviso no Mensal. Desde 06/10/2026 mora no botão "Atualizar aportes" (pedido da Dani), que
  // mostra o valor esperando e abre estes mesmos cartões. Mês passado primeiro: fecha o que já foi.
  // Um elemento só (e não um fragmento): fragmento passado a componente de cliente chega como
  // lista e o React pedia chave.
  const aportes = (
    <div className="flex flex-col gap-3">
      {aporteDoMesPassado.pending > 0 && (
        <AllocateContributionCard
          key="aporte-passado"
          month={mesPassado.getMonth() + 1}
          mesPassado
          abertoDeInicio
          pending={aporteDoMesPassado.pending}
          goalOfMonth={aporteDoMesPassado.contributions.find((c) => c.goalName)?.goalName ?? null}
          assets={ativosPraDistribuir}
        />
      )}
      {aporteDoMes.pending > 0 && (
        <AllocateContributionCard
          key="aporte-mes"
          month={now.getMonth() + 1}
          abertoDeInicio={aporteDoMesPassado.pending === 0}
          pending={aporteDoMes.pending}
          goalOfMonth={aporteDoMes.contributions.find((c) => c.goalName)?.goalName ?? null}
          assets={ativosPraDistribuir}
        />
      )}
      {resgateDoMesPassado.pending > 0 && (
        <AllocateContributionCard key="resgate-passado" resgate mesPassado month={mesPassado.getMonth() + 1} pending={resgateDoMesPassado.pending} goalOfMonth={resgateDoMesPassado.goalName} assets={ativosPraDistribuir} />
      )}
      {resgateDoMes.pending > 0 && (
        <AllocateContributionCard key="resgate-mes" resgate month={now.getMonth() + 1} pending={resgateDoMes.pending} goalOfMonth={resgateDoMes.goalName} assets={ativosPraDistribuir} />
      )}
    </div>
  );
  const temAporteEsperando = aporteDoMes.pending + aporteDoMesPassado.pending + resgateDoMes.pending + resgateDoMesPassado.pending > 0;

  return (
    <div className="flex flex-col gap-8 lg:gap-5">
      {/* Embaixo do título, só dado (06/10/2026). A frase "Acompanhe seus ativos..." e o link "Ver
          consolidação" saíram: as abas logo acima já levam ao Por Objetivo. */}
      <PageHeader
        title={voz.titulos.carteira}
        subtitle={assets.length > 0 ? voz.titulos.cartResumo(assets.length, new Set(assets.map((a) => a.assetClass)).size) : undefined}
      />

      <AssetsSection
        assets={assets.map((asset) => ({
          id: asset.id,
          name: asset.name,
          ticker: asset.ticker,
          assetClass: asset.assetClass,
          objective: asset.objective,
          goalId: asset.goalId,
          quantity: asset.quantity !== null ? Number(asset.quantity) : null,
          investedValue: asset.investedValue !== null ? Number(asset.investedValue) : null,
          fixedIncomeIndex: asset.fixedIncomeIndex,
          currentValue: Number(asset.currentValue),
          currency: asset.currency,
          nativeCurrentValue: asset.nativeCurrentValue !== null ? Number(asset.nativeCurrentValue) : null,
          nativeInvestedValue: asset.nativeInvestedValue !== null ? Number(asset.nativeInvestedValue) : null,
          exchangeRate: asset.exchangeRate !== null ? Number(asset.exchangeRate) : null,
        }))}
        goals={goals.map((goal) => ({ id: goal.id, name: goal.name }))}
        goalNameById={goalNameById}
        strategy={strategy}
        empresa={empresa}
        comAporteRecente={comAporteRecente}
        aportePendente={aporteDoMes.pending + aporteDoMesPassado.pending}
        aportes={temAporteEsperando ? aportes : null}
        // Logo abaixo dos botões: os proventos numa linha fechada e o próximo aporte. Dois props
        // em vez de um bloco: componente de servidor dentro de lista passada a um de cliente
        // chegava sem chave no navegador.
        proventos={<UpcomingDividendsSection dividends={dividends} voz={voz} money={money} />}
        proximoAporte={!empresa ? <ContributionCard context={contribution} month={now.getMonth() + 1} /> : null}
      />
    </div>
  );
}
