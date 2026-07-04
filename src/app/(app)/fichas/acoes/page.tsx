import Link from "next/link";
import { getRequiredSession } from "@/lib/auth/session";
import { listSheets } from "@/lib/repositories/analysis.repo";
import { CreateStockSheetForm } from "./CreateStockSheetForm";

export default async function FichasAcoesPage() {
  const ctx = await getRequiredSession();
  const sheets = await listSheets(ctx, "STOCK");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Fichas de Análise — Ações</h1>
        <p className="mt-1 text-sm text-black/60">Checklist qualitativo e quantitativo de análise fundamentalista.</p>
      </div>

      <CreateStockSheetForm />

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-black/10 text-black/60">
            <th className="py-2">Ticker</th>
            <th className="py-2">Empresa</th>
            <th className="py-2">Data</th>
            <th className="py-2">Nota geral</th>
          </tr>
        </thead>
        <tbody>
          {sheets.map((sheet) => (
            <tr key={sheet.id} className="border-b border-black/5">
              <td className="py-2">
                <Link href={`/fichas/acoes/${sheet.id}`} className="underline">
                  {sheet.ticker}
                </Link>
              </td>
              <td className="py-2">{sheet.companyName ?? "—"}</td>
              <td className="py-2">{sheet.analysisDate.toLocaleDateString("pt-BR")}</td>
              <td className="py-2">{sheet.totalScore ? `${Number(sheet.totalScore).toFixed(1)} / 10` : "—"}</td>
            </tr>
          ))}
          {sheets.length === 0 && (
            <tr>
              <td colSpan={4} className="py-4 text-center text-black/40">
                Nenhuma ficha criada ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
