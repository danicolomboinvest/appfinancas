import { Sparkles } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
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
  const money = await serverMoney();
  const [insights, healthScore] = await Promise.all([computeInsights(ctx, money), computeFinancialHealthScore(ctx)]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Análises" subtitle="Sua saúde financeira e o que precisa de atenção agora." />

      <HealthScoreCard score={healthScore} />

      {insights.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          message="Cadastre orçamento, metas, reserva de emergência e uma estratégia de carteira para começar a receber insights automáticos aqui."
        />
      ) : (
        <Section title="O que precisa de atenção">
          <InsightList insights={insights} />
        </Section>
      )}
    </div>
  );
}
