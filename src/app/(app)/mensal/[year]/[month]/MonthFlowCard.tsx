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

  const last = flow.points[flow.points.length - 1];
  const leftover = last.income - last.expense;

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-medium text-ink">Como {monthLabel} está indo</h2>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-caption text-ink-muted">
            <span className="h-2 w-2 rounded-full bg-success" /> Entrou
          </span>
          <span className="flex items-center gap-1.5 text-caption text-ink-muted">
            <span className="h-2 w-2 rounded-full bg-danger" /> Saiu
          </span>
        </div>
      </div>

      <p className="text-caption text-ink-faint">
        {/* A frase explica a leitura do gráfico: a distância entre as linhas É o dinheiro que
            sobrou até agora — sem isso, "duas linhas subindo" não diz nada sozinho. */}
        A distância entre as duas linhas é o que sobrou até aqui:{" "}
        <span className={`font-medium tabular-nums ${leftover >= 0 ? "text-success" : "text-danger"}`}>
          {formatBRL(leftover)}
        </span>
      </p>

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
