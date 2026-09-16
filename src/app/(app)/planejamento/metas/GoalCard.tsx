import Link from "next/link";
import { Target, Plane, Home, Car, PiggyBank } from "lucide-react";
import type { GoalIcon } from "@prisma/client";
import { Card } from "@/components/ui/Card";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { DeleteGoalButton } from "./DeleteGoalButton";
import { EditGoalButton } from "./EditGoalButton";
import { GoalAporteChip } from "./GoalAporteChip";
import type { GoalCalcResult } from "@/lib/planning/goal";
import { serverMoney } from "@/lib/money-server";

export type GoalVariant = "ahead" | "onTrack" | "behind" | "achieved";

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

const GOAL_ICONS: Record<GoalIcon, typeof Target> = {
  VIAGEM: Plane,
  CASA: Home,
  CARRO: Car,
  APOSENTADORIA: PiggyBank,
  GENERICO: Target,
};

/** Uma cor por tipo de meta — duas metas diferentes não podem parecer o mesmo card. */
const GOAL_COLORS: Record<GoalIcon, string> = {
  VIAGEM: "var(--color-cat-lazer)",
  CASA: "var(--color-cat-moradia)",
  CARRO: "var(--color-cat-transporte)",
  APOSENTADORIA: "var(--color-success)",
  GENERICO: "var(--color-accent)",
};


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
  const Icon = GOAL_ICONS[icon];

  // O DINHEIRO é o herói do card, não o anel. Antes o valor guardado era um cinza de 13px e o
  // lugar de destaque era do anel de progresso — e a pergunta que a pessoa faz ao abrir Metas
  // é "quanto eu já tenho", não "quantos por cento". O anel saiu e virou barra abaixo do
  // número: diz a mesma coisa, ocupa uma faixa em vez de um bloco, e libera a largura toda
  // para o valor.
  return (
    <Card className={`relative flex flex-col gap-3 p-5 ${achieved ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link href={`/planejamento/metas/${id}`} className="min-w-0">
            <p className="line-clamp-2 text-caption text-ink-muted hover:text-ink">{name}</p>
          </Link>
          <p className="mt-1 text-h1 font-bold leading-none tracking-tight tabular-nums text-ink">
            {money(currentAmount, { round: true })}
          </p>
          <p className="mt-1.5 text-caption tabular-nums text-ink-muted">
            {Math.round(progressPercent * 100)}% de {money(targetAmount, { round: true })}
            {!achieved && (
              <>
                {" · "}
                <span className={VARIANT_STATUS_TEXT[variant]}>{VARIANT_STATUS_LABEL[variant]}</span>
              </>
            )}
          </p>
        </div>
        <CategoryIcon icon={Icon} color={GOAL_COLORS[icon]} size={48} />
      </div>

      {/* A barra faz o papel que a foto faz no card do Nubank: fecha o card com uma faixa que
          se lê de relance, sem precisar de leitura. */}
      <span className="block h-2 overflow-hidden rounded-full bg-surface-2">
        <span
          className="block h-full rounded-full"
          style={{ width: `${Math.max(progressPercent * 100, 2)}%`, backgroundColor: GOAL_COLORS[icon] }}
        />
      </span>

      {!achieved && (
        <div>
          <p className="text-[15px] font-bold tracking-tight text-accent-strong">
            Guardar {money(plan.requiredMonthlyContribution, { round: true })} este mês
          </p>
          <p className="mt-0.5 text-caption text-ink-muted">
            {plan.monthsRemaining} {plan.monthsRemaining === 1 ? "mês restante" : "meses restantes"}
          </p>
        </div>
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
