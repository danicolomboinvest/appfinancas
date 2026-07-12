"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CriteriaForm, type FormCriterion, type FormResponse } from "@/components/forms/CriteriaForm";
import { fetchStockIntlIndicatorsAction } from "./actions";

type CriterionWithKey = FormCriterion & { key: string };

export function StockIntlSheetWorkspace({
  sheetId,
  basePath,
  ticker,
  criteria,
  initialResponses,
  initialConclusion,
  initialTotalScore,
}: {
  sheetId: string;
  basePath: string;
  ticker: string;
  criteria: CriterionWithKey[];
  initialResponses: FormResponse[];
  initialConclusion: string | null;
  initialTotalScore: number | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [appliedSuggestions, setAppliedSuggestions] = useState<{ criterionId: string; value: string }[]>([]);
  const [applyToken, setApplyToken] = useState(0);

  function handleFetch() {
    startTransition(async () => {
      const result = await fetchStockIntlIndicatorsAction(ticker);
      if (!result.ok) {
        setMessage({ tone: "error", text: result.error });
        return;
      }
      const keyToCriterionId = new Map(criteria.map((c) => [c.key, c.id]));
      const suggestions = result.results
        .map(({ key, value }) => {
          const criterionId = keyToCriterionId.get(key);
          return criterionId ? { criterionId, value } : null;
        })
        .filter((s): s is { criterionId: string; value: string } => s !== null);

      setAppliedSuggestions(suggestions);
      setApplyToken((prev) => prev + 1);
      setMessage({
        tone: "success",
        text: `${suggestions.length} de ${criteria.length} critérios preenchidos automaticamente. Revise antes de salvar.`,
      });
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-medium text-ink">Preencher indicadores automaticamente</p>
          <p className="text-xs text-ink-muted">
            Preenche sozinho indicadores como ROE, Dividend Yield, Payout, Margem Líquida e outros — é só revisar.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={handleFetch} disabled={isPending} className="w-fit">
          <Sparkles size={15} strokeWidth={2} className="mr-1.5" />
          {isPending ? "Buscando..." : "Buscar automaticamente"}
        </Button>
      </Card>

      {message && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            message.tone === "success" ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
          }`}
        >
          {message.text}
        </p>
      )}

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
