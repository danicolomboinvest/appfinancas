import { notFound } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { getOwnSheetWithResponses, listCriteria } from "@/lib/repositories/analysis.repo";
import { StockIntlSheetWorkspace } from "./StockIntlSheetWorkspace";
import { DeleteSheetButton } from "@/components/forms/DeleteSheetButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { Breadcrumb } from "@/components/ui/Breadcrumb";

export default async function StockIntlSheetDetailPage(props: PageProps<"/fichas/stocks/[id]">) {
  const { id } = await props.params;
  const ctx = await getRequiredSession();
  const [sheet, criteria] = await Promise.all([getOwnSheetWithResponses(ctx, id), listCriteria("STOCK_INTL")]);

  if (!sheet) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: "Análises", href: "/fichas" }, { label: "Stocks", href: "/fichas/stocks" }, { label: sheet.ticker }]} />

      <PageHeader
        title={`${sheet.ticker}${sheet.companyName ? `, ${sheet.companyName}` : ""}`}
        action={<DeleteSheetButton id={sheet.id} basePath="/fichas/stocks" />}
      />

      <StockIntlSheetWorkspace
        sheetId={sheet.id}
        basePath="/fichas/stocks"
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
