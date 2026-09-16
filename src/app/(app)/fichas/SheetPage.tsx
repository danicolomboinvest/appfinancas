import { notFound } from "next/navigation";
import type { SheetType } from "@prisma/client";
import { getRequiredSession } from "@/lib/auth/session";
import { getOwnSheetWithResponses, listCriteria } from "@/lib/repositories/analysis.repo";
import { listAssets } from "@/lib/repositories/asset.repo";
import { isLaudo } from "@/lib/analysis/laudo";
import { getParaVoce } from "@/lib/analysis/para-voce";
import { HUMAN_CATEGORIES, isChecklistAnswer, questionFor } from "@/lib/analysis/checklist";
import { serverMoney } from "@/lib/money-server";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { DeleteSheetButton } from "@/components/forms/DeleteSheetButton";
import { CriteriaForm } from "@/components/forms/CriteriaForm";
import { LaudoView } from "./Laudo";
import { Checklist } from "./Checklist";
import { ParaVoceCard } from "./ParaVoce";

export const SHEET_TYPE_META: Record<SheetType, { basePath: string; label: string }> = {
  STOCK: { basePath: "/fichas/acoes", label: "Ações" },
  FII: { basePath: "/fichas/fiis", label: "FIIs" },
  STOCK_INTL: { basePath: "/fichas/stocks", label: "Stocks" },
  ETF: { basePath: "/fichas/etfs", label: "ETFs" },
};

/** Fundo puro de Tijolo ou de Papel vê só o seu bloco; Híbrido, FoF e tipo indefinido veem os dois. */
const FII_BLOCKS_BY_TYPE: Record<string, string[]> = {
  TIJOLO: ["TIJOLO"],
  PAPEL: ["PAPEL"],
  HIBRIDO: ["TIJOLO", "PAPEL"],
  FUNDO_DE_FUNDOS: ["TIJOLO", "PAPEL"],
};

/**
 * A ficha, igual pros quatro tipos: laudo automático na frente, o checklist do que só a
 * pessoa responde, "E para você?" no fim. A ficha antiga (66 caixas, nota 0–10 por critério)
 * continua acessível recolhida em "Minha nota detalhada", pra quem já usava e pra não perder
 * nada do que foi salvo.
 */
export async function SheetPage({ id, sheetType }: { id: string; sheetType: SheetType }) {
  const ctx = await getRequiredSession();
  const money = await serverMoney();
  const meta = SHEET_TYPE_META[sheetType];

  const sheet = await getOwnSheetWithResponses(ctx, id);
  if (!sheet || sheet.sheetType !== sheetType) notFound();

  const humanCategories =
    sheetType === "FII"
      ? ["COMUM", ...(FII_BLOCKS_BY_TYPE[sheet.fiiType ?? ""] ?? ["TIJOLO", "PAPEL"])]
      : HUMAN_CATEGORIES[sheetType];
  const allCategories = sheetType === "FII" ? humanCategories : undefined;

  const laudo = isLaudo(sheet.laudo) ? sheet.laudo : null;
  const [humanCriteria, allCriteria, paraVoce, assets] = await Promise.all([
    listCriteria(sheetType, humanCategories),
    listCriteria(sheetType, allCategories),
    getParaVoce(ctx, sheetType, sheet.ticker, laudo),
    listAssets(ctx),
  ]);
  const inPortfolio = assets.some((a) => (a.ticker ?? a.name).trim().toUpperCase() === sheet.ticker.trim().toUpperCase());

  const responseByCriterion = new Map(sheet.responses.map((r) => [r.criterionId, r]));
  const questions = humanCriteria.map((c) => {
    const q = questionFor(c.key, c.label, c.helpText);
    return {
      criterionId: c.id,
      question: q.question,
      where: q.where,
      answer: (() => {
        const v = responseByCriterion.get(c.id)?.value;
        return isChecklistAnswer(v) ? v : null;
      })(),
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: "Análises", href: "/fichas" }, { label: meta.label, href: meta.basePath }, { label: sheet.ticker }]} />

      <LaudoView
        sheetId={sheet.id}
        ticker={sheet.ticker}
        companyName={sheet.companyName}
        inPortfolio={inPortfolio}
        initialLaudo={laudo}
      />

      <Checklist sheetId={sheet.id} questions={questions} />

      <ParaVoceCard data={paraVoce} ticker={sheet.ticker} money={money} />

      <div className="flex justify-end">
        <DeleteSheetButton id={sheet.id} basePath={meta.basePath} />
      </div>

      <CollapsibleSection label="Minha nota detalhada (avançado)">
        <p className="mb-3 text-caption text-ink-muted">
          A ficha completa, com nota de 0 a 10 por critério, pra quem quer registrar a própria análise por escrito.
        </p>
        <CriteriaForm
          sheetId={sheet.id}
          basePath={meta.basePath}
          criteria={allCriteria}
          initialResponses={sheet.responses.map((r) => ({
            criterionId: r.criterionId,
            value: r.value,
            score: r.score ? Number(r.score) : null,
            note: r.note,
          }))}
          initialConclusion={sheet.conclusion}
          initialTotalScore={sheet.totalScore ? Number(sheet.totalScore) : null}
        />
      </CollapsibleSection>
    </div>
  );
}
