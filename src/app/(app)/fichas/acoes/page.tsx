import Link from "next/link";
import { LineChart } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { listSheets } from "@/lib/repositories/analysis.repo";
import { computeScoreTrend, groupLatestSheetPerTicker } from "@/lib/analysis/sheet-history";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { CreateStockSheetForm } from "./CreateStockSheetForm";

export default async function FichasAcoesPage() {
  const ctx = await getRequiredSession();
  const sheets = await listSheets(ctx, "STOCK");
  const groups = groupLatestSheetPerTicker(sheets);
  const trendByTicker = new Map(
    groups.map((g) => {
      const sameTickerAscending = [...sheets]
        .filter((s) => s.ticker === g.latest.ticker)
        .reverse()
        .map((s) => ({ id: s.id, analysisDate: s.analysisDate, totalScore: s.totalScore ? Number(s.totalScore) : null }));
      return [g.latest.ticker, computeScoreTrend(sameTickerAscending)] as const;
    }),
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Análises — Ações" subtitle="Checklist qualitativo e quantitativo de análise fundamentalista." />

      <CreateStockSheetForm />

      <Card className="overflow-x-auto">
        {sheets.length > 0 && (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2/50 text-ink-muted">
              <th className="px-4 py-3 font-medium">Ticker</th>
              <th className="px-4 py-3 font-medium">Empresa</th>
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Nota geral</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(({ latest: sheet, previousCount }) => {
              const trend = trendByTicker.get(sheet.ticker);
              return (
                <tr key={sheet.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/40">
                  <td className="px-4 py-3">
                    <Link href={`/fichas/acoes/${sheet.id}`} className="font-medium text-accent-strong hover:underline">
                      {sheet.ticker}
                    </Link>
                    {previousCount > 0 && (
                      <span className="ml-2 text-xs text-ink-faint">
                        +{previousCount} análise{previousCount > 1 ? "s" : ""} anterior{previousCount > 1 ? "es" : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{sheet.companyName ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-muted">{sheet.analysisDate.toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-3 text-ink">
                    <span className="inline-flex items-center gap-1.5">
                      {sheet.totalScore ? `${Number(sheet.totalScore).toFixed(1)} / 10` : "—"}
                      {trend && trend.deltaAbsolute !== null && (
                        <span className={`text-xs font-medium ${trend.deltaAbsolute >= 0 ? "text-success" : "text-danger"}`}>
                          {trend.deltaAbsolute >= 0 ? "▲" : "▼"} {Math.abs(trend.deltaAbsolute).toFixed(1)}
                        </span>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        )}
        {sheets.length === 0 && (
          <EmptyState icon={LineChart} message="Nenhuma ficha criada ainda. Digite um ticker acima para começar sua primeira análise." />
        )}
      </Card>
    </div>
  );
}
