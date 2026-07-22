import { notFound } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { getOwnSheetWithResponses, listCriteria, listSheetsByTicker } from "@/lib/repositories/analysis.repo";
import { computeScoreTrend } from "@/lib/analysis/sheet-history";
import { StockSheetWorkspace } from "./StockSheetWorkspace";
import { DeleteSheetButton } from "@/components/forms/DeleteSheetButton";
import { ReanalyzeButton } from "@/components/forms/ReanalyzeButton";
import { ScoreHistoryChart, type ScoreHistoryPoint } from "@/components/charts/ScoreHistoryChart";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Breadcrumb } from "@/components/ui/Breadcrumb";

export default async function StockSheetDetailPage(props: PageProps<"/fichas/acoes/[id]">) {
  const { id } = await props.params;
  const ctx = await getRequiredSession();
  const [sheet, criteria] = await Promise.all([getOwnSheetWithResponses(ctx, id), listCriteria("STOCK")]);

  if (!sheet) {
    notFound();
  }

  const history = await listSheetsByTicker(ctx, "STOCK", sheet.ticker);
  const trend = computeScoreTrend(
    history.map((h) => ({ id: h.id, analysisDate: h.analysisDate, totalScore: h.totalScore ? Number(h.totalScore) : null })),
  );
  const historyPoints: ScoreHistoryPoint[] = history.map((h) => ({
    date: h.analysisDate.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
    score: h.totalScore ? Number(h.totalScore) : null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: "Análises", href: "/fichas" }, { label: "Ações", href: "/fichas/acoes" }, { label: sheet.ticker }]} />

      <PageHeader
        title={`${sheet.ticker}${sheet.companyName ? `, ${sheet.companyName}` : ""}`}
        action={
          <div className="flex items-center gap-2">
            <ReanalyzeButton id={sheet.id} basePath="/fichas/acoes" />
            <DeleteSheetButton id={sheet.id} basePath="/fichas/acoes" />
          </div>
        }
      />

      {history.length > 1 && (
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-ink-muted">Evolução da nota</h2>
            {trend.deltaAbsolute !== null && (
              <span
                className={`text-xs font-medium ${trend.deltaAbsolute >= 0 ? "text-success" : "text-danger"}`}
              >
                {trend.deltaAbsolute >= 0 ? "▲" : "▼"} {Math.abs(trend.deltaAbsolute).toFixed(1)} desde a análise
                anterior
              </span>
            )}
          </div>
          <ScoreHistoryChart data={historyPoints} />
        </Card>
      )}

      <StockSheetWorkspace
        sheetId={sheet.id}
        basePath="/fichas/acoes"
        ticker={sheet.ticker}
        criteria={criteria}
        initialResponses={sheet.responses.map((response) => ({
          criterionId: response.criterionId,
          value: response.value,
          score: response.score ? Number(response.score) : null,
          note: response.note,
        }))}
        initialConclusion={sheet.conclusion}
        initialTotalScore={sheet.totalScore ? Number(sheet.totalScore) : null}
      />
    </div>
  );
}
