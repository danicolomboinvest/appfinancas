import Link from "next/link";
import { Target, Plane, Home, Car, PiggyBank, Sparkles, CheckCircle2, AlertTriangle, PartyPopper } from "lucide-react";
import type { GoalIcon } from "@prisma/client";
import { Card } from "@/components/ui/Card";
import { FitText } from "@/components/ui/FitText";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { CountUp } from "@/components/ui/CountUp";
import { DeleteGoalButton } from "./DeleteGoalButton";
import { EditGoalButton } from "./EditGoalButton";
import { GoalCheckIn } from "./GoalCheckIn";
import type { GoalCalcResult } from "@/lib/planning/goal";
import { serverMoney } from "@/lib/money-server";

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

export async function GoalCard({
  id,
  name,
  icon,
  targetAmount,
  currentAmount,
  targetDate,
  annualRate,
  plan,
  variant,
  checkin,
}: {
  id: string;
  name: string;
  icon: GoalIcon;
  targetAmount: number;
  currentAmount: number;
  targetDate: Date;
  annualRate: number;
  plan: GoalCalcResult;
  variant: GoalVariant;
  /** Presente = está na janela de perguntar "você fez o aporte sugerido?" este mês. */
  checkin: { monthKey: string; monthLabel: string; suggestedAmount: number } | null;
}) {
  const money = await serverMoney();
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

      {/* Anel + identidade da meta lado a lado: o progresso é a primeira coisa que a pessoa
          procura no card, então ele entra junto do nome, não escondido lá embaixo. */}
      <div className="flex items-center gap-3 pr-16">
        <ProgressRing percent={progressPercent} tone={VARIANT_CHART_TONE[variant]} size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong">
              <Icon size={15} strokeWidth={1.9} />
            </span>
            <Link href={`/planejamento/metas/${id}`} className="min-w-0">
              <h3 className="line-clamp-2 text-base font-semibold text-ink hover:text-accent-strong">{name}</h3>
            </Link>
          </div>
          {!achieved && (
            <span
              className={`mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${VARIANT_STATUS_CLASSES[variant]}`}
            >
              {VARIANT_STATUS_LABEL[variant]}
            </span>
          )}
        </div>
      </div>

      {/* Check-in mensal: sem isso, "no ritmo" é só matemática projetada — ninguém nunca
          confirma que o aporte do mês realmente saiu do bolso. */}
      {checkin && (
        <GoalCheckIn
          goalId={id}
          monthKey={checkin.monthKey}
          monthLabel={checkin.monthLabel}
          suggestedAmount={checkin.suggestedAmount}
        />
      )}

      <div className="flex items-start gap-1.5">
        <motivation.Icon size={14} strokeWidth={1.75} className={`mt-0.5 shrink-0 ${motivation.colorClass}`} />
        <div>
          <p className="text-xs text-ink-muted">{motivation.message}</p>
          {completionText && <p className="mt-0.5 text-xs text-ink-faint">{completionText}</p>}
        </div>
      </div>

      <p className="text-sm tabular-nums text-ink-muted">
        <span className="font-semibold text-ink">{money(currentAmount)}</span> de {money(targetAmount)}
        {!achieved && <> · {plan.monthsRemaining} {plan.monthsRemaining === 1 ? "mês" : "meses"}</>}
      </p>

      {!achieved && (
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="text-xs text-ink-muted">Guardar este mês</p>
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
