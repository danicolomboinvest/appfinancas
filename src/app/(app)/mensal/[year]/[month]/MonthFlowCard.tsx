import type { DailyFlow } from "@/lib/consolidation/month-analysis";
import { Section } from "@/components/ui/Section";
import { MonthFlowChart } from "@/components/charts/MonthFlowChart";
import { serverMoney } from "@/lib/money-server";


/**
 * Card do gráfico diário. Só aparece quando existe pelo menos um lançamento COM data no mês:
 * `entryDate` é opcional no app, e quem lança sem data teria aqui um gráfico vazio sugerindo
 * que não gastou nada — pior que não mostrar gráfico nenhum.
 */
export async function MonthFlowCard({
  flow,
  monthLabel,
  isCurrentMonth,
  isFutureMonth = false,
}: {
  flow: DailyFlow;
  monthLabel: string;
  /** Mês fechado fala no passado: "Como foi Julho", não "Como Julho está indo". */
  isCurrentMonth: boolean;
  /** Mês que ainda não começou só tem o que foi agendado (recorrências): não "foi" nada. */
  isFutureMonth?: boolean;
}) {
  const money = await serverMoney();
  const hasDatedEntries = flow.points.some((p) => p.income > 0 || p.expense > 0);
  if (!hasDatedEntries) return null;

  return (
    <Section
      title={isFutureMonth ? `O que já está marcado para ${monthLabel}` : isCurrentMonth ? `Como ${monthLabel} está indo` : `Como foi ${monthLabel}`}
      hint={isFutureMonth ? "Lançamentos repetidos e agendados. O mês ainda não começou." : `A faixa entre as duas linhas é o que sobrou${isCurrentMonth ? " até aqui" : ""}`}
    >
      <MonthFlowChart points={flow.points} isCurrentMonth={isCurrentMonth} />

      {flow.undatedCount > 0 && (
        <p className="text-caption text-ink-faint">
          {flow.undatedCount} lançamento{flow.undatedCount === 1 ? "" : "s"} sem data ({money(flow.undatedAmount, { round: true })})
          {flow.undatedCount === 1 ? " não entra" : " não entram"} nesta curva, mas {flow.undatedCount === 1 ? "conta" : "contam"} nos totais do mês.
        </p>
      )}
    </Section>
  );
}
