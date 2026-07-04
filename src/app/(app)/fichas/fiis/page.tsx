import Link from "next/link";
import { getRequiredSession } from "@/lib/auth/session";
import { listSheets } from "@/lib/repositories/analysis.repo";
import { CreateFiiSheetForm } from "./CreateFiiSheetForm";

const FII_TYPE_LABEL: Record<string, string> = {
  TIJOLO: "Tijolo",
  PAPEL: "Papel",
  HIBRIDO: "Híbrido",
  FUNDO_DE_FUNDOS: "Fundo de Fundos",
};

export default async function FichasFiisPage() {
  const ctx = await getRequiredSession();
  const sheets = await listSheets(ctx, "FII");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Fichas de Análise — FIIs</h1>
        <p className="mt-1 text-sm text-black/60">Checklist de FIIs de tijolo e de papel, com dica de onde encontrar cada dado.</p>
      </div>

      <CreateFiiSheetForm />

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-black/10 text-black/60">
            <th className="py-2">Ticker</th>
            <th className="py-2">Fundo</th>
            <th className="py-2">Tipo</th>
            <th className="py-2">Data</th>
            <th className="py-2">Nota geral</th>
          </tr>
        </thead>
        <tbody>
          {sheets.map((sheet) => (
            <tr key={sheet.id} className="border-b border-black/5">
              <td className="py-2">
                <Link href={`/fichas/fiis/${sheet.id}`} className="underline">
                  {sheet.ticker}
                </Link>
              </td>
              <td className="py-2">{sheet.companyName ?? "—"}</td>
              <td className="py-2">{sheet.fiiType ? FII_TYPE_LABEL[sheet.fiiType] : "—"}</td>
              <td className="py-2">{sheet.analysisDate.toLocaleDateString("pt-BR")}</td>
              <td className="py-2">{sheet.totalScore ? `${Number(sheet.totalScore).toFixed(1)} / 10` : "—"}</td>
            </tr>
          ))}
          {sheets.length === 0 && (
            <tr>
              <td colSpan={5} className="py-4 text-center text-black/40">
                Nenhuma ficha criada ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
