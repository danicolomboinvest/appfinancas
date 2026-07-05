import Link from "next/link";
import { Target, Plane, Home, Car, PiggyBank } from "lucide-react";
import type { GoalIcon } from "@prisma/client";
import { Card } from "@/components/ui/Card";
import { DeleteGoalButton } from "./DeleteGoalButton";
import type { GoalCalcResult } from "@/lib/planning/goal";

export type GoalVariant = "ahead" | "onTrack" | "behind" | "achieved";

const VARIANT_STYLES: Record<GoalVariant, { border: string; bar: string }> = {
  ahead: { border: "border-t-success", bar: "bg-success" },
  onTrack: { border: "border-t-gold", bar: "bg-gold" },
  behind: { border: "border-t-danger", bar: "bg-danger" },
  achieved: { border: "border-t-success", bar: "bg-success" },
};

const VARIANT_STATUS_LABEL: Record<GoalVariant, string> = {
  ahead: "Adiantada",
  onTrack: "No ritmo",
  behind: "Atrasada",
  achieved: "Concluída",
};

const VARIANT_STATUS_CLASSES: Record<GoalVariant, string> = {
  ahead: "bg-success-soft text-success",
  onTrack: "bg-gold-soft text-gold-strong",
  behind: "bg-danger-soft text-danger",
  achieved: "bg-success-soft text-success",
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

export function GoalCard({
  id,
  name,
  icon,
  targetAmount,
  currentAmount,
  plan,
  variant,
}: {
  id: string;
  name: string;
  icon: GoalIcon;
  targetAmount: number;
  currentAmount: number;
  plan: GoalCalcResult;
  variant: GoalVariant;
}) {
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

      <div className="flex items-center gap-3 pr-16">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-soft text-gold-strong">
          <Icon size={20} strokeWidth={1.75} />
        </span>
        <Link href={`/planejamento/metas/${id}`} className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-ink hover:text-gold-strong">{name}</h3>
        </Link>
      </div>

      {!achieved && (
        <span className={`w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${VARIANT_STATUS_CLASSES[variant]}`}>
          {VARIANT_STATUS_LABEL[variant]}
        </span>
      )}

      <div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
          <div className={`h-full rounded-full ${styles.bar}`} style={{ width: `${Math.round(progressPercent * 100)}%` }} />
        </div>
        <p className="mt-1.5 text-xs text-ink-muted">{Math.round(progressPercent * 100)}% concluído</p>
      </div>

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
          <p className="mt-1 text-xl font-bold tracking-tight text-gold-strong">{formatBRL(plan.requiredMonthlyContribution)}</p>
        </div>
      )}

      <div className="flex items-center justify-end">
        <DeleteGoalButton id={id} />
      </div>
    </Card>
  );
}
