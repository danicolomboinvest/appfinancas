import type { DailyFlow } from "@/lib/consolidation/month-analysis";
import { Section } from "@/components/ui/Section";
import { MonthFlowChart } from "@/components/charts/MonthFlowChart";
import { serverMoney } from "@/lib/money-server";
import type { Voz } from "@/lib/profiles/voice";


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
  voz,
}: {
  flow: DailyFlow;
  monthLabel: string;
  /** Mês fechado fala no passado: "Como foi Julho", não "Como Julho está indo". */
  isCurrentMonth: boolean;
  /** Mês que ainda não começou só tem o que foi agendado (recorrências): não "foi" nada. */
  isFutureMonth?: boolean;
  /** A voz do tema do perfil, que a página já resolveu: o card não vai ao banco de novo por ela. */
  voz: Voz;
}) {
  const money = await serverMoney();
  const hasDatedEntries = flow.points.some((p) => p.income > 0 || p.expense > 0);
  if (!hasDatedEntries) return null;

  const t = voz.titulos;
  return (
    <Section
      title={isFutureMonth ? t.uiFluxoTituloFuturo(monthLabel) : isCurrentMonth ? t.uiFluxoTituloCorrente(monthLabel) : t.uiFluxoTituloFechado(monthLabel)}
      hint={isFutureMonth ? t.uiFluxoDicaFuturo : isCurrentMonth ? t.uiFluxoDicaCorrente : t.uiFluxoDicaFechado}
    >
      <MonthFlowChart points={flow.points} isCurrentMonth={isCurrentMonth} />

      {flow.undatedCount > 0 && (
        <p className="text-caption text-ink-faint">
          {t.uiFluxoSemData(flow.undatedCount, money(flow.undatedAmount, { round: true }))}
        </p>
      )}
    </Section>
  );
}
