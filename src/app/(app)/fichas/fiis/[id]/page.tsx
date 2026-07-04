import { notFound } from "next/navigation";
import Link from "next/link";
import { getRequiredSession } from "@/lib/auth/session";
import { getOwnSheetWithResponses, listCriteria } from "@/lib/repositories/analysis.repo";
import { CriteriaForm } from "@/components/forms/CriteriaForm";
import { DeleteSheetButton } from "@/components/forms/DeleteSheetButton";

export default async function FiiSheetDetailPage(props: PageProps<"/fichas/fiis/[id]">) {
  const { id } = await props.params;
  const ctx = await getRequiredSession();
  const sheet = await getOwnSheetWithResponses(ctx, id);

  if (!sheet) {
    notFound();
  }

  const categories = sheet.fiiType === "TIJOLO" || sheet.fiiType === "PAPEL" ? ["COMUM", sheet.fiiType] : ["COMUM"];
  const criteria = await listCriteria("FII", categories);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {sheet.ticker}
            {sheet.companyName ? ` — ${sheet.companyName}` : ""}
          </h1>
          <Link href="/fichas/fiis" className="text-sm underline">
            ← todas as fichas de FIIs
          </Link>
        </div>
        <DeleteSheetButton id={sheet.id} basePath="/fichas/fiis" />
      </div>

      <CriteriaForm
        sheetId={sheet.id}
        basePath="/fichas/fiis"
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
