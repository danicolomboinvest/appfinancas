import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { computeInsights, computeExecutiveSummary, type Insight, type InsightCategory } from "@/lib/insights";
import { computeFinancialHealthScore } from "@/lib/health-score";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { HealthScoreCard } from "@/components/ui/HealthScoreCard";

const TONE_CLASSES: Record<Insight["tone"], string> = {
  success: "border-l-4 border-l-success bg-success-soft/40",
  warning: "border-l-4 border-l-accent bg-accent-soft/40",
  danger: "border-l-4 border-l-danger bg-danger-soft/40",
  info: "border-l-4 border-l-border-strong bg-surface-2",
};

const SUMMARY_TONE_CLASSES: Record<Insight["tone"], string> = {
  success: "border-success/40 bg-success-soft/30 text-success",
  warning: "border-accent/40 bg-accent-soft/30 text-accent-strong",
  danger: "border-danger/40 bg-danger-soft/30 text-danger",
  info: "border-border-strong bg-surface-2 text-ink-muted",
};

const CATEGORY_ORDER: InsightCategory[] = ["fluxo", "metas", "carteira", "reserva"];
const CATEGORY_LABEL: Record<InsightCategory, string> = {
  fluxo: "Fluxo Financeiro",
  metas: "Metas",
  carteira: "Carteira",
  reserva: "Reserva de Emergência",
};

/** Quantos insights de maior prioridade destacar no topo, antes da lista completa por área. */
const TOP_PRIORITY_COUNT = 3;

function InsightActionLink({ insight }: { insight: Insight }) {
  if (!insight.href) return null;
  return (
    <Link
      href={insight.href}
      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent-strong hover:underline"
    >
      {insight.actionLabel ?? "Ver mais"} <ArrowRight size={12} />
    </Link>
  );
}

export default async function AnalisesInsightsPage() {
  const ctx = await getRequiredSession();
  const [insights, healthScore] = await Promise.all([computeInsights(ctx), computeFinancialHealthScore(ctx)]);
  const summary = computeExecutiveSummary(insights);
  const topInsights = insights.slice(0, TOP_PRIORITY_COUNT);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Análises"
        subtitle="Insights automáticos a partir do seu Fluxo Financeiro, Metas, Carteira e Reserva de Emergência. As fichas fundamentalistas de Ações e FIIs estão nas abas ao lado, na barra de navegação."
      />

      <HealthScoreCard score={healthScore} />

      {insights.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          message="Cadastre orçamento, metas, reserva de emergência e uma estratégia de carteira para começar a receber insights automáticos aqui."
        />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <h2 className="text-h2 font-semibold tracking-tight text-ink">O que mais importa agora</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {topInsights.map((insight) => (
                <Card key={insight.id} className={`p-4 text-sm text-ink ${TONE_CLASSES[insight.tone]}`}>
                  <p>{insight.message}</p>
                  <InsightActionLink insight={insight} />
                </Card>
              ))}
            </div>
          </div>

          {CATEGORY_ORDER.map((category) => {
            const categoryInsights = insights.filter((i) => i.category === category);
            if (categoryInsights.length === 0) return null;
            return (
              <div key={category} className="flex flex-col gap-3">
                <h2 className="text-h2 font-semibold tracking-tight text-ink">{CATEGORY_LABEL[category]}</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {categoryInsights.map((insight) => (
                    <Card key={insight.id} className={`p-4 text-sm text-ink ${TONE_CLASSES[insight.tone]}`}>
                      <p>{insight.message}</p>
                      <InsightActionLink insight={insight} />
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}

          <div>
            <h2 className="mb-3 text-h2 font-semibold tracking-tight text-ink">Resumo executivo</h2>
            <Card className={`border p-5 text-sm ${SUMMARY_TONE_CLASSES[summary.tone]}`}>{summary.message}</Card>
          </div>
        </>
      )}
    </div>
  );
}
