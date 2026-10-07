import Link from "next/link";
import type { Voz } from "@/lib/profiles/voice";
import { Target, Plane, Home, Car, PiggyBank, PartyPopper } from "lucide-react";
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

/** O estado num selo colorido (07/10/2026), não numa palavra colorida no meio da frase. */
const VARIANT_SELO: Record<GoalVariant, string> = {
  ahead: "bg-success-soft text-success",
  onTrack: "bg-success-soft text-success",
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
  openingBalance,
  targetDate,
  annualRate,
  plan,
  variant,
  checkin,
  monthDone = false,
  nextContribution = null,
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
  /** O "Já guardado" digitado (saldo de partida). O card mostra o total, mas a edição mexe só
   *  neste: pré-preencher com o total fazia salvar o calculado por cima do digitado. */
  openingBalance: number;
  targetDate: Date;
  annualRate: number;
  plan: GoalCalcResult;
  variant: GoalVariant;
  /** Presente = está na janela de perguntar "você fez o aporte sugerido?" este mês. */
  checkin: { monthKey: string; monthLabel: string; suggestedAmount: number; done: boolean } | null;
  /** O aporte deste mês já foi feito (marcado aqui ou lançado no Fluxo). */
  monthDone?: boolean;
  /** Com o mês feito: quanto guardar no mês que vem. null = nada a pedir antes do prazo. */
  nextContribution?: { monthLabel: string; amount: number } | null;
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
    // Meta batida é comemorada, não apagada: o card inteiro em opacity-60 lia como "desativada",
    // e o "Chegou lá!! 🥳" que todo tema escreveu nunca aparecia. O aro verde marca a conquista
    // sem pintar o card com cor de tema; a ordem da página continua jogando as batidas pro fim.
    <Card className={`relative flex flex-col gap-3 p-5 ${achieved ? "ring-1 ring-success/40" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        {/* O bloco inteiro (nome + valor + "de R$ X") abre a meta. Antes só o nome cinza de 13px
            era link, e quase ninguém descobria que o card tinha uma página. */}
        <Link href={`/planejamento/metas/${id}`} className="group min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-md"
              style={{ backgroundColor: `color-mix(in srgb, ${GOAL_COLORS[kind]} 16%, transparent)`, color: GOAL_COLORS[kind] }}
            >
              <Icon size={14} strokeWidth={2} />
            </span>
            <span className="line-clamp-1 text-caption text-ink-muted group-hover:text-ink">{name}</span>
          </div>

          <div className="mt-1.5">
            <FitText className="text-h1 font-bold leading-none tracking-tight tabular-nums text-ink">{money(currentAmount, { round: true })}</FitText>
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-caption tabular-nums text-ink-muted">
            de {money(targetAmount, { round: true })}
            {!achieved && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${VARIANT_SELO[variant]}`}>{voz.titulos.metaStatus[variant]}</span>}
          </p>
        </Link>

        <ProgressRing percent={progressPercent} size={64} color={GOAL_COLORS[kind]} />
      </div>

      {achieved ? (
        <div className="flex flex-col gap-1.5 border-t border-border pt-3">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-success-soft px-3 py-1 text-sm font-semibold text-success">
            <PartyPopper size={15} strokeWidth={2} aria-hidden />
            {voz.titulos.metaStatus.achieved}
          </span>
          <p className="text-sm text-ink">{voz.metaBatida(name)}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 border-t border-border pt-3">
          {/* Dois quadradinhos (07/10/2026, "mesma cara, menos texto"): quanto guardar e quantos
              meses faltam. Eram duas frases, "Guardar X este mês" e "14 meses restantes". Com o
              aporte do mês feito, o primeiro fala do mês que vem. */}
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0 rounded-xl bg-surface-2 px-3 py-2">
              <p className="text-caption leading-tight text-ink-muted">
                {monthDone && nextContribution ? voz.titulos.metaGuardarEm(nextContribution.monthLabel) : voz.titulos.metaGuardarPorMes}
              </p>
              <p className="truncate text-[17px] font-bold tabular-nums text-ink">
                {money(monthDone && nextContribution ? nextContribution.amount : plan.requiredMonthlyContribution, { round: true })}
              </p>
            </div>
            <div className="min-w-0 rounded-xl bg-surface-2 px-3 py-2">
              <p className="text-caption leading-tight text-ink-muted">{voz.titulos.metaMesesRestantes}</p>
              <p className="text-[17px] font-bold tabular-nums text-ink">{plan.monthsRemaining}</p>
            </div>
          </div>

          {/* "Guardei este mês" logo abaixo dos números: o pedido e a resposta juntos. */}
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
      )}

      {tool && !achieved && (
        <Link
          href={tool.href}
          // -my-1.5: o toque continua com 44px, mas sem abrir um buraco entre os blocos do card.
          className="-my-1.5 inline-flex min-h-11 w-fit items-center gap-1 text-sm font-medium text-accent-strong hover:underline"
        >
          {tool.label} →
        </Link>
      )}

      {/* Editar num canto e apagar no outro: colados, um toque errado apagava a meta. */}
      <div className="flex items-center justify-between gap-2">
        <EditGoalButton
          goalId={id}
          defaults={{
            name,
            icon,
            targetAmount,
            currentAmount: openingBalance,
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
