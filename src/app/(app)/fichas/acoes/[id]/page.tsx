import { notFound } from "next/navigation";
import Link from "next/link";
import { getRequiredSession } from "@/lib/auth/session";
import { getOwnSheetWithResponses, listCriteria } from "@/lib/repositories/analysis.repo";
import { CriteriaForm } from "@/components/forms/CriteriaForm";
import { DeleteSheetButton } from "@/components/forms/DeleteSheetButton";

export default async function StockSheetDetailPage(props: PageProps<"/fichas/acoes/[id]">) {
  const { id } = await props.params;
  const ctx = await getRequiredSession();
  const [sheet, criteria] = await Promise.all([getOwnSheetWithResponses(ctx, id), listCriteria("STOCK")]);

  if (!sheet) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {sheet.ticker}
            {sheet.companyName ? ` — ${sheet.companyName}` : ""}
          </h1>
          <Link href="/fichas/acoes" className="text-sm underline">
            ← todas as fichas de ações
          </Link>
        </div>
        <DeleteSheetButton id={sheet.id} basePath="/fichas/acoes" />
      </div>

      <CriteriaForm
        sheetId={sheet.id}
        basePath="/fichas/acoes"
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
