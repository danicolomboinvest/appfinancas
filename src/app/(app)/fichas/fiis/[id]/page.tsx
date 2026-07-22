import { notFound } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { getOwnSheetWithResponses, listCriteria } from "@/lib/repositories/analysis.repo";
import { FiiSheetWorkspace } from "./FiiSheetWorkspace";
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

  // Quais blocos de critério aparecem por tipo de fundo (item 8): fundo puro de Tijolo ou de
  // Papel vê só o seu bloco; Híbrido, Fundo de Fundos (e tipo não definido) veem os DOIS blocos,
  // pra não esconder dados relevantes como nº de imóveis, alavancagem, vacância, P/VP e LTV.
  const EXTRA_BLOCKS_BY_TYPE: Record<string, string[]> = {
    TIJOLO: ["TIJOLO"],
    PAPEL: ["PAPEL"],
    HIBRIDO: ["TIJOLO", "PAPEL"],
    FUNDO_DE_FUNDOS: ["TIJOLO", "PAPEL"],
  };
  const categories = ["COMUM", ...(EXTRA_BLOCKS_BY_TYPE[sheet.fiiType ?? ""] ?? ["TIJOLO", "PAPEL"])];
  const criteria = await listCriteria("FII", categories);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: "Análises", href: "/fichas" }, { label: "FIIs", href: "/fichas/fiis" }, { label: sheet.ticker }]} />

      <PageHeader
        title={`${sheet.ticker}${sheet.companyName ? `, ${sheet.companyName}` : ""}`}
        action={<DeleteSheetButton id={sheet.id} basePath="/fichas/fiis" />}
      />

      <FiiSheetWorkspace
        sheetId={sheet.id}
        basePath="/fichas/fiis"
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
