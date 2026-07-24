"use client";

import { useEffect, useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CriteriaForm, type FormCriterion, type FormResponse, type CriterionAnalysis } from "@/components/forms/CriteriaForm";
import { fetchStockIntlIndicatorsAction, fetchStockIntlOverviewAction } from "./actions";

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

  // Análise automática por indicador (mesmo mecanismo de Ações), carrega sozinha ao abrir a
  // ficha e é exibida DENTRO de cada linha do CriteriaForm.
  const [analysisByCriterionId, setAnalysisByCriterionId] = useState<Record<string, CriterionAnalysis> | undefined>(undefined);
  const [analysisDisclaimer, setAnalysisDisclaimer] = useState<string | undefined>(undefined);
  const [analysisPending, startAnalysis] = useTransition();

  useEffect(() => {
    let cancelled = false;
    startAnalysis(async () => {
      const r = await fetchStockIntlOverviewAction(ticker);
      if (cancelled) return;
      if (!r.ok) {
        setAnalysisByCriterionId(undefined);
        setAnalysisDisclaimer(undefined);
        return;
      }
      const keyToCriterionId = new Map(criteria.map((c) => [c.key, c.id]));
      const map: Record<string, CriterionAnalysis> = {};
      for (const item of r.items) {
        const criterionId = keyToCriterionId.get(item.key);
        if (criterionId) map[criterionId] = { signal: item.signal, reference: item.reference };
      }
      setAnalysisByCriterionId(map);
      setAnalysisDisclaimer(r.disclaimer);
    });
    // Evita aplicar por cima um resultado antigo se o ticker mudar antes da resposta voltar.
    return () => {
      cancelled = true;
    };
    // criteria é estável dentro da ficha; recarrega só quando muda o ticker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker]);

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
            Preenche sozinho indicadores como ROE, Dividend Yield, Payout, Margem Líquida e outros, é só revisar.
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
        analysisByCriterionId={analysisByCriterionId}
        analysisDisclaimer={analysisDisclaimer}
        analysisPending={analysisPending}
      />
    </div>
  );
}
