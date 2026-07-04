import Link from "next/link";
import { getRequiredSession } from "@/lib/auth/session";
import { listSheets } from "@/lib/repositories/analysis.repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { CreateStockSheetForm } from "./CreateStockSheetForm";

export default async function FichasAcoesPage() {
  const ctx = await getRequiredSession();
  const sheets = await listSheets(ctx, "STOCK");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Análises — Ações" subtitle="Checklist qualitativo e quantitativo de análise fundamentalista." />

      <CreateStockSheetForm />

      <Card className="overflow-hidden">
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
            {sheets.map((sheet) => (
              <tr key={sheet.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/40">
                <td className="px-4 py-3">
                  <Link href={`/fichas/acoes/${sheet.id}`} className="font-medium text-gold-strong hover:underline">
                    {sheet.ticker}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink-muted">{sheet.companyName ?? "—"}</td>
                <td className="px-4 py-3 text-ink-muted">{sheet.analysisDate.toLocaleDateString("pt-BR")}</td>
                <td className="px-4 py-3 text-ink">{sheet.totalScore ? `${Number(sheet.totalScore).toFixed(1)} / 10` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {sheets.length === 0 && <EmptyState message="Nenhuma ficha criada ainda." />}
      </Card>
    </div>
  );
}
