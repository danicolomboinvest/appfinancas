import { notFound } from "next/navigation";
import Link from "next/link";
import { getRequiredSession } from "@/lib/auth/session";
import { getOwnSheetWithResponses, listCriteria } from "@/lib/repositories/analysis.repo";
import { CriteriaForm } from "@/components/forms/CriteriaForm";
import { DeleteSheetButton } from "@/components/forms/DeleteSheetButton";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function StockSheetDetailPage(props: PageProps<"/fichas/acoes/[id]">) {
  const { id } = await props.params;
  const ctx = await getRequiredSession();
  const [sheet, criteria] = await Promise.all([getOwnSheetWithResponses(ctx, id), listCriteria("STOCK")]);

  if (!sheet) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`${sheet.ticker}${sheet.companyName ? ` — ${sheet.companyName}` : ""}`}
        subtitle={
          <Link href="/fichas/acoes" className="text-gold-strong hover:underline">
            ← todas as fichas de ações
          </Link>
        }
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
