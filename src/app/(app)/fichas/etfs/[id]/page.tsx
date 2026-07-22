import { notFound } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { getOwnSheetWithResponses, listCriteria } from "@/lib/repositories/analysis.repo";
import { EtfSheetWorkspace } from "./EtfSheetWorkspace";
import { DeleteSheetButton } from "@/components/forms/DeleteSheetButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { Breadcrumb } from "@/components/ui/Breadcrumb";

export default async function EtfSheetDetailPage(props: PageProps<"/fichas/etfs/[id]">) {
  const { id } = await props.params;
  const ctx = await getRequiredSession();
  const [sheet, criteria] = await Promise.all([getOwnSheetWithResponses(ctx, id), listCriteria("ETF")]);

  if (!sheet) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: "Análises", href: "/fichas" }, { label: "ETFs", href: "/fichas/etfs" }, { label: sheet.ticker }]} />

      <PageHeader
        title={`${sheet.ticker}${sheet.companyName ? `, ${sheet.companyName}` : ""}`}
        action={<DeleteSheetButton id={sheet.id} basePath="/fichas/etfs" />}
      />

      <EtfSheetWorkspace
        sheetId={sheet.id}
        basePath="/fichas/etfs"
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
