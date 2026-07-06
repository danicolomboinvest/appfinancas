import { getRequiredSession } from "@/lib/auth/session";
import { computeInsights, type Insight } from "@/lib/insights";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

const TONE_CLASSES: Record<Insight["tone"], string> = {
  success: "border-l-4 border-l-success bg-success-soft/40",
  warning: "border-l-4 border-l-accent bg-accent-soft/40",
  danger: "border-l-4 border-l-danger bg-danger-soft/40",
};

export default async function AnalisesInsightsPage() {
  const ctx = await getRequiredSession();
  const insights = await computeInsights(ctx);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Análises"
        subtitle="Insights automáticos a partir do seu Fluxo Financeiro, Metas, Carteira e Reserva de Emergência. As fichas fundamentalistas de Ações e FIIs estão nas abas ao lado, na barra de navegação."
      />

      {insights.length === 0 ? (
        <EmptyState message="Cadastre orçamento, metas, reserva de emergência e uma estratégia de carteira para começar a receber insights automáticos aqui." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {insights.map((insight) => (
            <Card key={insight.id} className={`p-4 text-sm text-ink ${TONE_CLASSES[insight.tone]}`}>
              {insight.message}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
