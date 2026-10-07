import { notFound } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { vozDoTema } from "@/lib/profiles/voice";
import { getGoalWithProgress } from "@/lib/repositories/goal.repo";
import { computeGoalPlan, computeGoalTrajectory } from "@/lib/planning/goal";
import { PageHeader } from "@/components/ui/PageHeader";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import { EditarNoCanto } from "@/components/ui/EditarNoCanto";
import { Section } from "@/components/ui/Section";
import { GoalForm } from "../GoalForm";
import { DeleteGoalButton } from "../DeleteGoalButton";
import { GoalTrajectoryChart } from "../GoalTrajectoryChart";
import { serverMoney } from "@/lib/money-server";
import { prisma } from "@/lib/db/prisma";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { GuardadosDoSonho } from "./GuardadosDoSonho";

const STATUS_CHART_TONE: Record<string, "success" | "accent" | "danger"> = {
  NOT_STARTED: "danger",
  ON_TRACK: "accent",
  BEHIND: "danger",
  ACHIEVED: "success",
};

export default async function GoalDetailPage(props: PageProps<"/planejamento/metas/[id]">) {
  const money = await serverMoney();
  const { id } = await props.params;
  const ctx = await getRequiredSession();
  const voz = vozDoTema(ctx.profileTheme, ctx.profileKind);
  const t = voz.titulos;
  const goal = await getGoalWithProgress(ctx, id);

  if (!goal) {
    notFound();
  }

  const targetDate = goal.targetDate ?? new Date();
  const goalInput = {
    targetAmount: Number(goal.targetAmount),
    currentAmount: goal.computedCurrentAmount,
    targetDate,
    annualRate: Number(goal.annualRate ?? 0),
      startedAt: goal.createdAt,
  };
  const plan = computeGoalPlan(goalInput);
  // Cada "Guardei" deste sonho (e resgate tirado dele), do mais novo pro mais antigo: é o que o
  // bloco "O que você guardou" deixa corrigir no próprio registro.
  const hoje = nowInBrazil();
  const guardados = (
    await prisma.monthlyEntry.findMany({
      where: { userId: ctx.userId, profileId: ctx.profileId, goalId: goal.id, category: "INVESTMENT_CONTRIBUTION" },
      select: { id: true, amount: true, year: true, month: true, description: true },
      orderBy: [{ year: "desc" }, { month: "desc" }, { createdAt: "desc" }],
      take: 60,
    })
  ).map((e) => ({
    id: e.id,
    amount: Number(e.amount),
    year: e.year,
    month: e.month,
    description: e.description,
    futuro: e.year > hoje.getFullYear() || (e.year === hoje.getFullYear() && e.month > hoje.getMonth() + 1),
  }));
  const trajectory = computeGoalTrajectory(goalInput, plan);

  const alvo = Number(goal.targetAmount);
  const guardado = goal.computedCurrentAmount;
  const pct = alvo > 0 ? Math.min(100, Math.round((guardado / alvo) * 100)) : 0;
  const selo = plan.status === "BEHIND" ? "bg-danger text-white" : plan.status === "ACHIEVED" || plan.status === "ON_TRACK" ? "bg-success text-white" : "heroi-veu-forte";

  // A página da meta (07/10/2026, "mesma cara, menos texto"): o bloco do número com o estado num
  // selo e o lápis no canto, dois quadradinhos, a trajetória e o que ela guardou. Saíram o caminho
  // "Início > Planejamento > Metas" (as abas de cima já levam), a lista de quatro linhas e o
  // formulário aberto no fim da página (agora abre pelo lápis).
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={goal.name} action={<DeleteGoalButton id={goal.id} />} />

      <HeroiDoTema>
        <div className="-my-1 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-heroi-suave">{t.formMetaJaGuardado}</p>
          <span className="flex shrink-0 items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${selo}`}>{t.metaRitmo[plan.status]}</span>
            <EditarNoCanto titulo={goal.name}>
              <GoalForm
                goalId={goal.id}
                submitLabel={t.metaSalvarAlteracoes}
                defaults={{
                  name: goal.name,
                  targetAmount: alvo,
                  // Só o saldo de partida: o total (com aportes e ativos) é calculado, e salvá-lo aqui
                  // contaria os aportes duas vezes.
                  currentAmount: Number(goal.currentAmount),
                  annualRate: Number(goal.annualRate ?? 0),
                  targetDate: targetDate.toISOString().slice(0, 10),
                  icon: goal.icon,
                }}
              />
            </EditarNoCanto>
          </span>
        </div>
        <div>
          <p className="text-[2.5rem] font-bold leading-none tracking-tight tabular-nums">{money(guardado, { round: true })}</p>
          <p className="mt-1.5 text-sm tabular-nums text-heroi-suave">de {money(alvo, { round: true })}, {pct}%</p>
        </div>
        <div className="heroi-veu h-2 overflow-hidden rounded-full" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className={`h-full rounded-full ${plan.status === "ACHIEVED" ? "bg-success" : "bg-[var(--color-heroi-destaque)]"}`} style={{ width: `${pct}%` }} />
        </div>
        {plan.status !== "ACHIEVED" && (
          <div className="heroi-fio grid grid-cols-2 border-t pt-3">
            <div className="min-w-0">
              <p className="text-caption text-heroi-suave">{t.metaGuardarPorMes}</p>
              <p className="text-lg font-bold tabular-nums">{money(plan.requiredMonthlyContribution, { round: true })}</p>
            </div>
            <div className="heroi-fio min-w-0 border-l pl-4">
              <p className="text-caption text-heroi-suave">{t.metaMesesRestantes}</p>
              <p className="text-lg font-bold tabular-nums">{plan.monthsRemaining}</p>
            </div>
          </div>
        )}
      </HeroiDoTema>

      <Section title={t.metaTrajetoria}>
        <GoalTrajectoryChart data={trajectory} targetAmount={alvo} tone={STATUS_CHART_TONE[plan.status]} />
      </Section>

      <GuardadosDoSonho itens={guardados} />
    </div>
  );
}
