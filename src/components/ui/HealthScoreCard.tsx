import type { FinancialHealthScore, HealthStatus } from "@/lib/health-score";
import { Card } from "./Card";
import { ProgressBar } from "./ProgressBar";

const STATUS_TEXT_CLASS: Record<HealthStatus, string> = {
  boa: "text-success",
  atencao: "text-accent-strong",
  critica: "text-danger",
  "sem-dados": "text-ink-muted",
};

const STATUS_BAR_TONE: Record<HealthStatus, "success" | "accent" | "danger" | "neutral"> = {
  boa: "success",
  atencao: "accent",
  critica: "danger",
  "sem-dados": "neutral",
};

/** Card-âncora de "Análises": nota 0-100 de saúde financeira + semáforo por dimensão. */
export function HealthScoreCard({ score }: { score: FinancialHealthScore }) {
  return (
    <Card className="p-6">
      <p className="text-label text-ink-muted">Sua saúde financeira</p>
      <div className="mt-1 flex items-baseline gap-2">
        <p className={`text-display font-semibold tracking-tight ${STATUS_TEXT_CLASS[score.status]}`}>
          {score.overallScore ?? "—"}
        </p>
        <p className="text-body text-ink-faint">/ 100</p>
      </div>
      <p className="mt-2 text-body text-ink-muted">{score.message}</p>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {score.dimensions.map((dimension) => (
          <div key={dimension.key} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-ink-muted">{dimension.label}</p>
              <p className={`text-xs font-semibold ${STATUS_TEXT_CLASS[dimension.status]}`}>
                {dimension.score ?? "—"}
              </p>
            </div>
            <ProgressBar percent={(dimension.score ?? 0) / 100} tone={STATUS_BAR_TONE[dimension.status]} />
            <p className="text-xs text-ink-faint">{dimension.detail}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
