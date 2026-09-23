import { Sparkles } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { vozDoTema } from "@/lib/profiles/voice";
import { computeInsights } from "@/lib/insights";
import { serverMoney } from "@/lib/money-server";
import { computeFinancialHealthScore } from "@/lib/health-score";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { HealthScoreCard } from "@/components/ui/HealthScoreCard";
import { InsightList } from "./InsightList";
import { Section } from "@/components/ui/Section";

export default async function AnalisesInsightsPage() {
  const ctx = await getRequiredSession();
  const voz = vozDoTema(ctx.profileTheme, ctx.profileKind);
  const money = await serverMoney();
  const [insights, healthScore] = await Promise.all([computeInsights(ctx, money), computeFinancialHealthScore(ctx)]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={voz.titulos.fichasTitulo} subtitle={voz.titulos.fichasSub} />

      <HealthScoreCard score={healthScore} />

      {insights.length === 0 ? (
        <EmptyState icon={Sparkles} message={voz.titulos.fichasInsightsVazio} />
      ) : (
        <Section title={voz.titulos.fichasAtencaoTitulo}>
          <InsightList insights={insights} />
        </Section>
      )}
    </div>
  );
}
