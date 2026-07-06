import { notFound } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { getOwnSheetWithResponses, listCriteria } from "@/lib/repositories/analysis.repo";
import { CriteriaForm } from "@/components/forms/CriteriaForm";
import { DeleteSheetButton } from "@/components/forms/DeleteSheetButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { Breadcrumb } from "@/components/ui/Breadcrumb";

export default async function StockSheetDetailPage(props: PageProps<"/fichas/acoes/[id]">) {
  const { id } = await props.params;
  const ctx = await getRequiredSession();
  const [sheet, criteria] = await Promise.all([getOwnSheetWithResponses(ctx, id), listCriteria("STOCK")]);

  if (!sheet) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: "O que seus números dizem?", href: "/fichas" }, { label: "Ações", href: "/fichas/acoes" }, { label: sheet.ticker }]} />

      <PageHeader
        title={`${sheet.ticker}${sheet.companyName ? ` — ${sheet.companyName}` : ""}`}
        action={<DeleteSheetButton id={sheet.id} basePath="/fichas/acoes" />}
      />

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
