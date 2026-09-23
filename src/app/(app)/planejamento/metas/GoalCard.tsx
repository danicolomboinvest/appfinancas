import Link from "next/link";
import type { Voz } from "@/lib/profiles/voice";
import { Target, Plane, Home, Car, PiggyBank } from "lucide-react";
import type { GoalIcon } from "@prisma/client";
import { Card } from "@/components/ui/Card";
import { FitText } from "@/components/ui/FitText";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { DeleteGoalButton } from "./DeleteGoalButton";
import { EditGoalButton } from "./EditGoalButton";
import { GoalAporteChip } from "./GoalAporteChip";
import type { GoalCalcResult } from "@/lib/planning/goal";
import { serverMoney } from "@/lib/money-server";
import { resolveGoalKind } from "@/lib/planning/goal-kind";

export type GoalVariant = "ahead" | "onTrack" | "behind" | "achieved";

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

/**
 * A ferramenta que responde a dúvida daquela meta, oferecida dentro do próprio card.
 *
 * Os simuladores existiam só atrás do menu "Mais": das 71 pessoas que já usaram o app, 24
 * chegaram na lista e 17 abriram algum — e NENHUMA chegou lá por outro caminho, porque não
 * havia outro. Nenhuma tela linkava pra eles.
 *
 * Quem cadastrou uma meta "Casa" já declarou a dúvida que o simulador de financiar × alugar
 * responde. Oferecer ali é a diferença entre uma calculadora que a pessoa precisa procurar e
 * uma resposta que aparece na hora em que a pergunta existe.
 */
const GOAL_TOOL: Partial<Record<GoalIcon, { href: string; label: string }>> = {
  CASA: { href: "/simuladores/financiar-vs-alugar", label: "Financiar ou alugar?" },
  CARRO: { href: "/simuladores/carro", label: "Assinar ou comprar?" },
  VIAGEM: { href: "/viagem", label: "Planejar esta viagem" },
  APOSENTADORIA: { href: "/planejamento/acumulo", label: "Simular a aposentadoria" },
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
  voz,
  empresa = false,
}: {
  /** A voz do tema: status, "guardar X este mês" e o chip do aporte. */
  voz: Voz;
  /** Perfil Empresa: a ferramenta de aposentadoria não é oferecida (empresa não se aposenta). */
  empresa?: boolean;
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
  // O nome decide quando a pessoa deixou o ícone em "Genérico" — a maioria deixa. Assim
  // "Entrada do apê" e "Trocar de carro" ganham cor, ícone e ferramenta sem ela precisar
  // lembrar de apertar um botãozinho a mais.
  const kind = resolveGoalKind(icon, name);
  const Icon = GOAL_ICONS[kind];
  // Viagem, simuladores e aposentadoria são coisa de pessoa física; as rotas nem aparecem no
  // perfil Empresa, então o card não pode apontar pra elas.
  const tool = empresa ? undefined : GOAL_TOOL[kind];

  // O anel FICA — ele é um gráfico, e é isso que dá vida ao card; a barra chapada que eu tinha
  // posto no lugar dizia a mesma coisa e lia como enfeite, não como informação.
  //
  // O que motivou tirá-lo era real (o dinheiro ficava num cinza de 13px), mas a solução não
  // era remover o anel: era mudá-lo de lugar. Encostado à esquerda ele empurrava o valor para
  // uma coluna estreita; à direita, o número fica com a largura toda e o anel continua ali.
  return (
    <Card className={`relative flex flex-col gap-3 p-5 ${achieved ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Link href={`/planejamento/metas/${id}`} className="flex min-w-0 items-center gap-2">
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-md"
              style={{ backgroundColor: `color-mix(in srgb, ${GOAL_COLORS[kind]} 16%, transparent)`, color: GOAL_COLORS[kind] }}
            >
              <Icon size={14} strokeWidth={2} />
            </span>
            <p className="line-clamp-1 text-caption text-ink-muted hover:text-ink">{name}</p>
          </Link>

          <div className="mt-1.5">
            <FitText className="text-h1 font-bold leading-none tracking-tight tabular-nums text-ink">{money(currentAmount, { round: true })}</FitText>
          </div>
          <p className="mt-1.5 text-caption tabular-nums text-ink-muted">
            de {money(targetAmount, { round: true })}
            {!achieved && (
              <>
                {" · "}
                <span className={VARIANT_STATUS_TEXT[variant]}>{voz.titulos.metaStatus[variant]}</span>
              </>
            )}
          </p>
        </div>

        <ProgressRing percent={progressPercent} size={64} color={GOAL_COLORS[kind]} />
      </div>

      {!achieved && (
        <div className="border-t border-border pt-3">
          <p className="text-[15px] font-bold tracking-tight text-accent-strong">
            {voz.titulos.metaGuardar(money(plan.requiredMonthlyContribution, { round: true }))}
          </p>
          <p className="mt-0.5 text-caption text-ink-muted">
            {voz.titulos.metaMeses(plan.monthsRemaining)}
          </p>
        </div>
      )}

      {tool && !achieved && (
        <Link
          href={tool.href}
          className="inline-flex w-fit items-center gap-1 text-caption font-medium text-accent-strong hover:underline"
        >
          {tool.label} →
        </Link>
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
