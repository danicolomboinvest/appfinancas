"use client";

import { useState, useTransition } from "react";
import { saveResponsesAction } from "@/app/(app)/fichas/actions";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useToast } from "@/components/ui/toast-context";
import { AnalysisRadarChart, type CategoryScore } from "@/components/charts/AnalysisRadarChart";
import { HelpTooltip } from "./HelpTooltip";

export type FormCriterion = {
  id: string;
  label: string;
  category: string;
  helpText: string | null;
};

export type FormResponse = {
  criterionId: string;
  value: string | null;
  score: number | null;
  note: string | null;
};

type ResponseState = { value: string; score: string; note: string };

const INPUT_CLASSES =
  "rounded-lg border border-border-strong bg-surface-2 px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold";

export function CriteriaForm({
  sheetId,
  basePath,
  criteria,
  initialResponses,
  initialConclusion,
  initialTotalScore,
}: {
  sheetId: string;
  basePath: string;
  criteria: FormCriterion[];
  initialResponses: FormResponse[];
  initialConclusion: string | null;
  initialTotalScore: number | null;
}) {
  const responseByCriterion = new Map(initialResponses.map((r) => [r.criterionId, r]));
  const [responses, setResponses] = useState<Record<string, ResponseState>>(() => {
    const initial: Record<string, ResponseState> = {};
    for (const criterion of criteria) {
      const existing = responseByCriterion.get(criterion.id);
      initial[criterion.id] = {
        value: existing?.value ?? "",
        score: existing?.score !== null && existing?.score !== undefined ? String(existing.score) : "",
        note: existing?.note ?? "",
      };
    }
    return initial;
  });
  const [conclusion, setConclusion] = useState(initialConclusion ?? "");
  const [totalScore, setTotalScore] = useState(initialTotalScore);
  const [isPending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const { showToast } = useToast();

  const categories = Array.from(new Set(criteria.map((c) => c.category)));

  const answeredCount = criteria.filter((c) => {
    const r = responses[c.id];
    return r && (r.value !== "" || r.score !== "" || r.note !== "");
  }).length;
  const fillProgress = criteria.length > 0 ? answeredCount / criteria.length : 0;

  const categoryScores: CategoryScore[] = categories
    .map((category) => {
      const scores = criteria
        .filter((c) => c.category === category)
        .map((c) => responses[c.id]?.score)
        .filter((score): score is string => score !== undefined && score !== "")
        .map(Number);
      return { category, score: scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : null };
    })
    .filter((entry): entry is CategoryScore => entry.score !== null);

  function updateResponse(criterionId: string, field: keyof ResponseState, value: string) {
    setResponses((prev) => ({ ...prev, [criterionId]: { ...prev[criterionId], [field]: value } }));
  }

  function handleSave() {
    const responsePayload = criteria.map((criterion) => {
      const response = responses[criterion.id];
      return {
        criterionId: criterion.id,
        value: response.value || undefined,
        score: response.score !== "" ? Number(response.score) : undefined,
        note: response.note || undefined,
      };
    });

    const scores = responsePayload.map((r) => r.score).filter((score): score is number => score !== undefined);
    const nextTotalScore = scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;

    startTransition(async () => {
      await saveResponsesAction({ sheetId, conclusion: conclusion || undefined, responses: responsePayload }, basePath);
      setTotalScore(nextTotalScore);
      setSavedAt(new Date());
      showToast("Ficha salva com sucesso.");
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-4">
        <div className="flex items-center justify-between text-xs text-ink-muted">
          <span>Preenchimento da ficha</span>
          <span>
            {answeredCount} de {criteria.length} critérios
          </span>
        </div>
        <ProgressBar percent={fillProgress} tone="gold" className="mt-2" />
      </Card>

      {totalScore !== null && (
        <Card className="w-fit p-4">
          <p className="text-xs text-ink-muted">Nota geral</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-gold-strong">{totalScore.toFixed(1)} / 10</p>
        </Card>
      )}

      {categoryScores.length >= 2 && (
        <Card className="p-5">
          <p className="mb-2 text-xs font-medium text-ink-muted">Nota por categoria</p>
          <AnalysisRadarChart data={categoryScores} />
        </Card>
      )}

      {categories.map((category) => (
        <div key={category}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">{category}</h2>
          <div className="flex flex-col gap-2">
            {criteria
              .filter((criterion) => criterion.category === category)
              .map((criterion) => (
                <Card key={criterion.id} className="grid grid-cols-12 items-start gap-2 p-3">
                  <div className="col-span-3 flex items-center text-sm font-medium text-ink">
                    {criterion.label}
                    {criterion.helpText && <HelpTooltip text={criterion.helpText} />}
                  </div>
                  <input
                    className={`col-span-5 ${INPUT_CLASSES}`}
                    placeholder="Observação"
                    value={responses[criterion.id]?.value ?? ""}
                    onChange={(e) => updateResponse(criterion.id, "value", e.target.value)}
                  />
                  <input
                    className={`col-span-2 ${INPUT_CLASSES}`}
                    type="number"
                    min={0}
                    max={10}
                    step="0.5"
                    placeholder="Nota (0-10)"
                    value={responses[criterion.id]?.score ?? ""}
                    onChange={(e) => updateResponse(criterion.id, "score", e.target.value)}
                  />
                  <input
                    className={`col-span-2 ${INPUT_CLASSES}`}
                    placeholder="Comentário"
                    value={responses[criterion.id]?.note ?? ""}
                    onChange={(e) => updateResponse(criterion.id, "note", e.target.value)}
                  />
                </Card>
              ))}
          </div>
        </div>
      ))}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="conclusion" className="text-xs font-medium text-ink-muted">
          Conclusão geral
        </label>
        <textarea
          id="conclusion"
          value={conclusion}
          onChange={(e) => setConclusion(e.target.value)}
          rows={3}
          className={INPUT_CLASSES}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={handleSave} disabled={isPending} className="w-fit">
          {isPending ? "Salvando..." : "Salvar ficha"}
        </Button>
        {savedAt && <span className="text-xs text-ink-faint">Salvo às {savedAt.toLocaleTimeString("pt-BR")}</span>}
      </div>
    </div>
  );
}
