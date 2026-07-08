"use client";

import { useState } from "react";
import { DocumentExtractionPanel } from "@/components/forms/DocumentExtractionPanel";
import { CriteriaForm, type FormCriterion, type FormResponse } from "@/components/forms/CriteriaForm";
import type { SheetCriterion } from "@/lib/analysis/document-extraction";

/**
 * Une o painel de upload/extração com o formulário de critérios — o painel só produz
 * "sugestões" (criterionId + value), o formulário decide se aplica (só em campos vazios) e
 * continua sendo o único lugar que efetivamente salva no banco.
 */
export function StockSheetWorkspace({
  sheetId,
  basePath,
  criteria,
  initialResponses,
  initialConclusion,
  initialTotalScore,
}: {
  sheetId: string;
  basePath: string;
  criteria: (FormCriterion & SheetCriterion)[];
  initialResponses: FormResponse[];
  initialConclusion: string | null;
  initialTotalScore: number | null;
}) {
  const [appliedSuggestions, setAppliedSuggestions] = useState<{ criterionId: string; value: string }[]>([]);
  const [applyToken, setApplyToken] = useState(0);

  function handleApply(suggestions: { criterionId: string; value: string }[]) {
    setAppliedSuggestions(suggestions);
    setApplyToken((t) => t + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <DocumentExtractionPanel criteria={criteria} onApply={handleApply} />
      <CriteriaForm
        sheetId={sheetId}
        basePath={basePath}
        criteria={criteria}
        initialResponses={initialResponses}
        initialConclusion={initialConclusion}
        initialTotalScore={initialTotalScore}
        appliedSuggestions={appliedSuggestions}
        applyToken={applyToken}
      />
    </div>
  );
}
