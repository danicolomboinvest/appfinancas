import Link from "next/link";
import { Target, Plane, Home, Car, PiggyBank, Sparkles, CheckCircle2, AlertTriangle, PartyPopper } from "lucide-react";
import type { GoalIcon } from "@prisma/client";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CountUp } from "@/components/ui/CountUp";
import { DeleteGoalButton } from "./DeleteGoalButton";
import { EditGoalButton } from "./EditGoalButton";
import { GoalTrajectoryChart } from "./GoalTrajectoryChart";
import type { GoalCalcResult, GoalTrajectoryPoint } from "@/lib/planning/goal";

export type GoalVariant = "ahead" | "onTrack" | "behind" | "achieved";

const VARIANT_STYLES: Record<GoalVariant, { border: string }> = {
  ahead: { border: "border-t-success" },
  onTrack: { border: "border-t-accent" },
  behind: { border: "border-t-danger" },
  achieved: { border: "border-t-success" },
};

const VARIANT_STATUS_LABEL: Record<GoalVariant, string> = {
  ahead: "Adiantada",
  onTrack: "No ritmo",
  behind: "Atrasada",
  achieved: "Concluída",
};

const VARIANT_STATUS_CLASSES: Record<GoalVariant, string> = {
  ahead: "bg-success-soft text-success",
  onTrack: "bg-accent-soft text-accent-strong",
  behind: "bg-danger-soft text-danger",
  achieved: "bg-success-soft text-success",
};

const VARIANT_CHART_TONE: Record<GoalVariant, "success" | "accent" | "danger"> = {
  ahead: "success",
  onTrack: "accent",
  behind: "danger",
  achieved: "success",
};

const VARIANT_MOTIVATION: Record<GoalVariant, { Icon: typeof Sparkles; message: string; colorClass: string }> = {
  ahead: { Icon: Sparkles, message: "Você está indo além do esperado.", colorClass: "text-success" },
  onTrack: { Icon: CheckCircle2, message: "Continue assim, você está no caminho certo.", colorClass: "text-accent-strong" },
  behind: {
    Icon: AlertTriangle,
    message: "Vale revisar o aporte mensal para não perder o ritmo.",
    colorClass: "text-danger",
  },
  achieved: { Icon: PartyPopper, message: "Meta conquistada, comemore essa vitória.", colorClass: "text-success" },
};

const GOAL_ICONS: Record<GoalIcon, typeof Target> = {
  VIAGEM: Plane,
  CASA: Home,
  CARRO: Car,
  APOSENTADORIA: PiggyBank,
  GENERICO: Target,
};

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatMonthYear(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date);
}

function projectedCompletionText(variant: GoalVariant, targetDate: Date): string | null {
  if (variant === "achieved") return null;
  const dateLabel = formatMonthYear(targetDate);
  if (variant === "ahead") return `Nesse ritmo, você deve concluir antes do previsto (${dateLabel}).`;
  if (variant === "behind") return `Nesse ritmo, essa meta corre risco de não ficar pronta até ${dateLabel}.`;
  return `Prevista para ${dateLabel}, continuando nesse ritmo.`;
}

export function GoalCard({
  id,
  name,
  icon,
  targetAmount,
  currentAmount,
  targetDate,
  annualRate,
  plan,
  trajectory,
  variant,
}: {
  id: string;
  name: string;
  icon: GoalIcon;
  targetAmount: number;
  currentAmount: number;
  targetDate: Date;
  annualRate: number;
  plan: GoalCalcResult;
  trajectory: GoalTrajectoryPoint[];
  variant: GoalVariant;
}) {
  const progressPercent = targetAmount > 0 ? Math.min(currentAmount / targetAmount, 1) : 0;
  const achieved = variant === "achieved";
  const styles = VARIANT_STYLES[variant];
  const Icon = GOAL_ICONS[icon];
  const motivation = VARIANT_MOTIVATION[variant];
  const completionText = projectedCompletionText(variant, targetDate);

  return (
    <Card className={`relative flex flex-col gap-4 border-t-4 p-5 ${styles.border} ${achieved ? "opacity-60" : ""}`}>
      {achieved && (
        <span className="absolute right-4 top-4 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success">
          Concluída
        </span>
      )}

      <div className="flex items-center gap-3 pr-16">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
          <Icon size={20} strokeWidth={1.75} />
        </span>
        <Link href={`/planejamento/metas/${id}`} className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-base font-semibold text-ink hover:text-accent-strong">{name}</h3>
        </Link>
      </div>

      {!achieved && (
        <span className={`w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${VARIANT_STATUS_CLASSES[variant]}`}>
          {VARIANT_STATUS_LABEL[variant]}
        </span>
      )}

      <div>
        <ProgressBar percent={progressPercent} tone={VARIANT_CHART_TONE[variant]} />
        <p className="mt-1.5 text-xs text-ink-muted">{Math.round(progressPercent * 100)}% concluído</p>
      </div>

      <div className="flex items-start gap-1.5">
        <motivation.Icon size={14} strokeWidth={1.75} className={`mt-0.5 shrink-0 ${motivation.colorClass}`} />
        <div>
          <p className="text-xs text-ink-muted">{motivation.message}</p>
          {completionText && <p className="mt-0.5 text-xs text-ink-faint">{completionText}</p>}
        </div>
      </div>

      <GoalTrajectoryChart data={trajectory} targetAmount={targetAmount} tone={VARIANT_CHART_TONE[variant]} />

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xs text-ink-muted">Guardado</p>
          <p className="mt-0.5 text-sm font-medium text-ink">{formatBRL(currentAmount)}</p>
        </div>
        <div>
          <p className="text-xs text-ink-muted">Falta</p>
          <p className="mt-0.5 text-sm font-medium text-ink">{formatBRL(Math.max(plan.amountMissing, 0))}</p>
        </div>
        <div>
          <p className="text-xs text-ink-muted">Meses restantes</p>
          <p className="mt-0.5 text-sm font-medium text-ink">{plan.monthsRemaining}</p>
        </div>
      </div>

      {!achieved && (
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="text-xs text-ink-muted">Aporte mensal sugerido</p>
          <p className="mt-1 text-xl font-bold tracking-tight text-accent-strong">
            {/* `brl` (não `format={formatBRL}`): GoalCard é Server Component, função não serializa. */}
            <CountUp value={plan.requiredMonthlyContribution} brl />
          </p>
        </div>
      )}

      <div className="flex items-center justify-end gap-4">
        <EditGoalButton
          goalId={id}
          defaults={{
            name,
            icon,
            targetAmount,
            currentAmount,
            // Componentes locais, não toISOString(): o valor cru é UTC, e por volta de meia-noite
            // no Brasil (UTC-3) vira o mês ANTERIOR — foi assim que "novembro" virou "dezembro"
            // no formulário de edição, o mês mudava sozinho.
            targetDate: `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}`,
            annualRate,
          }}
        />
        <DeleteGoalButton id={id} />
      </div>
    </Card>
  );
}
