import Link from "next/link";
import { Target, Plane, Home, Car, PiggyBank } from "lucide-react";
import type { GoalIcon } from "@prisma/client";
import { Card } from "@/components/ui/Card";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { DeleteGoalButton } from "./DeleteGoalButton";
import { EditGoalButton } from "./EditGoalButton";
import { GoalAporteChip } from "./GoalAporteChip";
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

const VARIANT_STATUS_TEXT: Record<GoalVariant, string> = {
  ahead: "text-success",
  onTrack: "text-accent-strong",
  behind: "text-danger",
  achieved: "text-success",
};

const VARIANT_CHART_TONE: Record<GoalVariant, "success" | "accent" | "danger"> = {
  ahead: "success",
  onTrack: "accent",
  behind: "danger",
  achieved: "success",
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
  checkin: { monthKey: string; monthLabel: string; suggestedAmount: number; done: boolean } | null;
}) {
  const money = await serverMoney();
  const progressPercent = targetAmount > 0 ? Math.min(currentAmount / targetAmount, 1) : 0;
  const achieved = variant === "achieved";
  const styles = VARIANT_STYLES[variant];
  const Icon = GOAL_ICONS[icon];

  return (
    <Card className={`relative flex flex-col gap-4 border-t-4 p-5 ${styles.border} ${achieved ? "opacity-60" : ""}`}>
      {achieved && (
        <span className="absolute right-4 top-4 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success">
          Concluída
        </span>
      )}

      {/* Ordem do desenho aprovado: anel | nome, números, quanto guardar, marcar aporte.
          Saíram a frase de motivação e o "nesse ritmo você conclui em..." — o anel e o status
          já dizem se a meta vai bem, e três linhas de texto por meta transformavam uma lista
          de metas num texto corrido. */}
      <div className={`flex items-start gap-3 ${achieved ? "pr-16" : ""}`}>
        <ProgressRing percent={progressPercent} tone={VARIANT_CHART_TONE[variant]} size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong">
              <Icon size={15} strokeWidth={1.9} />
            </span>
            <Link href={`/planejamento/metas/${id}`} className="min-w-0">
              <h3 className="line-clamp-2 text-base font-semibold text-ink hover:text-accent-strong">{name}</h3>
            </Link>
          </div>

          <p className="mt-1.5 text-caption tabular-nums text-ink-muted">
            <span className="font-semibold text-ink">{money(currentAmount, { round: true })}</span> de{" "}
            {money(targetAmount, { round: true })}
            {!achieved && (
              <>
                {" · "}
                {plan.monthsRemaining} {plan.monthsRemaining === 1 ? "mês" : "meses"}
                {" · "}
                <span className={VARIANT_STATUS_TEXT[variant]}>{VARIANT_STATUS_LABEL[variant]}</span>
              </>
            )}
          </p>

          {!achieved && (
            <p className="mt-1.5 text-sm font-bold tracking-tight text-accent-strong">
              Guardar {money(plan.requiredMonthlyContribution, { round: true })} este mês
            </p>
          )}

          {checkin && (
            <GoalAporteChip
              goalId={id}
              monthKey={checkin.monthKey}
              monthLabel={checkin.monthLabel}
              suggestedAmount={checkin.suggestedAmount}
              done={checkin.done}
            />
          )}
        </div>
      </div>

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
