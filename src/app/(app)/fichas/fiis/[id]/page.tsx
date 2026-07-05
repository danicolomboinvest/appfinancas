import { notFound } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { getOwnSheetWithResponses, listCriteria } from "@/lib/repositories/analysis.repo";
import { CriteriaForm } from "@/components/forms/CriteriaForm";
import { DeleteSheetButton } from "@/components/forms/DeleteSheetButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { Breadcrumb } from "@/components/ui/Breadcrumb";

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
      <Breadcrumb items={[{ label: "Análises", href: "/fichas" }, { label: "FIIs", href: "/fichas/fiis" }, { label: sheet.ticker }]} />

      <PageHeader
        title={`${sheet.ticker}${sheet.companyName ? ` — ${sheet.companyName}` : ""}`}
        action={<DeleteSheetButton id={sheet.id} basePath="/fichas/fiis" />}
      />

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
