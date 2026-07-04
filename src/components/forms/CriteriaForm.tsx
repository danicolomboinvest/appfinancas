"use client";

import { useState, useTransition } from "react";
import { saveResponsesAction } from "@/app/(app)/fichas/actions";
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

  const categories = Array.from(new Set(criteria.map((c) => c.category)));

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
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {totalScore !== null && (
        <div className="w-fit rounded-lg border border-black/10 p-4">
          <p className="text-xs text-black/60">Nota geral</p>
          <p className="mt-1 text-2xl font-semibold">{totalScore.toFixed(1)} / 10</p>
        </div>
      )}

      {categories.map((category) => (
        <div key={category}>
          <h2 className="mb-2 text-sm font-semibold uppercase text-black/50">{category}</h2>
          <div className="flex flex-col gap-2">
            {criteria
              .filter((criterion) => criterion.category === category)
              .map((criterion) => (
                <div key={criterion.id} className="grid grid-cols-12 items-start gap-2 rounded border border-black/10 p-3">
                  <div className="col-span-3 flex items-center text-sm font-medium">
                    {criterion.label}
                    {criterion.helpText && <HelpTooltip text={criterion.helpText} />}
                  </div>
                  <input
                    className="col-span-5 rounded border border-black/20 px-2 py-1 text-sm"
                    placeholder="Observação"
                    value={responses[criterion.id]?.value ?? ""}
                    onChange={(e) => updateResponse(criterion.id, "value", e.target.value)}
                  />
                  <input
                    className="col-span-2 rounded border border-black/20 px-2 py-1 text-sm"
                    type="number"
                    min={0}
                    max={10}
                    step="0.5"
                    placeholder="Nota (0-10)"
                    value={responses[criterion.id]?.score ?? ""}
                    onChange={(e) => updateResponse(criterion.id, "score", e.target.value)}
                  />
                  <input
                    className="col-span-2 rounded border border-black/20 px-2 py-1 text-sm"
                    placeholder="Comentário"
                    value={responses[criterion.id]?.note ?? ""}
                    onChange={(e) => updateResponse(criterion.id, "note", e.target.value)}
                  />
                </div>
              ))}
          </div>
        </div>
      ))}

      <div className="flex flex-col gap-1">
        <label htmlFor="conclusion" className="text-xs">
          Conclusão geral
        </label>
        <textarea
          id="conclusion"
          value={conclusion}
          onChange={(e) => setConclusion(e.target.value)}
          rows={3}
          className="rounded border border-black/20 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="w-fit rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {isPending ? "Salvando..." : "Salvar ficha"}
        </button>
        {savedAt && <span className="text-xs text-black/50">Salvo às {savedAt.toLocaleTimeString("pt-BR")}</span>}
      </div>
    </div>
  );
}
