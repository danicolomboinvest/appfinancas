import type { DailyFlow } from "@/lib/consolidation/month-analysis";
import { Card } from "@/components/ui/Card";
import { MonthFlowChart } from "@/components/charts/MonthFlowChart";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

/**
 * Card do gráfico diário. Só aparece quando existe pelo menos um lançamento COM data no mês:
 * `entryDate` é opcional no app, e quem lança sem data teria aqui um gráfico vazio sugerindo
 * que não gastou nada — pior que não mostrar gráfico nenhum.
 */
export function MonthFlowCard({ flow, monthLabel }: { flow: DailyFlow; monthLabel: string }) {
  const hasDatedEntries = flow.points.some((p) => p.income > 0 || p.expense > 0);
  if (!hasDatedEntries) return null;

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div>
        <h2 className="text-sm font-medium text-ink">Como {monthLabel} está indo</h2>
        <p className="mt-0.5 text-caption text-ink-faint">A faixa entre as duas linhas é o que sobrou até aqui</p>
      </div>

      <MonthFlowChart points={flow.points} />

      {flow.undatedCount > 0 && (
        <p className="text-caption text-ink-faint">
          {flow.undatedCount} lançamento{flow.undatedCount === 1 ? "" : "s"} sem data ({formatBRL(flow.undatedAmount)})
          {flow.undatedCount === 1 ? " não entra" : " não entram"} nesta curva, mas {flow.undatedCount === 1 ? "conta" : "contam"} nos totais do mês.
        </p>
      )}
    </Card>
  );
}
