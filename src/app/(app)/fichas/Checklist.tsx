"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { CHECKLIST_ANSWERS, type ChecklistAnswer } from "@/lib/analysis/checklist";
import { answerChecklistAction } from "./laudo-actions";

export type ChecklistQuestion = {
  criterionId: string;
  question: string;
  where: string | null;
  answer: ChecklistAnswer | null;
};

const VISIBLE = 3;

const CHIP: Record<(typeof CHECKLIST_ANSWERS)[number]["tone"], { on: string; off: string }> = {
  success: { on: "border-success bg-success-soft font-semibold text-success", off: "border-border-strong text-ink-muted" },
  neutral: { on: "border-ink-faint bg-surface-2 font-semibold text-ink", off: "border-border-strong text-ink-muted" },
  danger: { on: "border-danger bg-danger-soft font-semibold text-danger", off: "border-border-strong text-ink-muted" },
};

/**
 * "O que só você consegue responder": uma pergunta por vez, três toques, salva na hora.
 * Mostra três e esconde o resto atrás de "Mais N perguntas" — a lista inteira de uma vez era
 * o paredão que fazia a pessoa desistir.
 */
export function Checklist({ sheetId, questions }: { sheetId: string; questions: ChecklistQuestion[] }) {
  const [answers, setAnswers] = useState<Record<string, ChecklistAnswer | null>>(() =>
    Object.fromEntries(questions.map((q) => [q.criterionId, q.answer])),
  );
  const [showAll, setShowAll] = useState(false);
  const [, startTransition] = useTransition();

  if (questions.length === 0) return null;

  function answer(criterionId: string, value: ChecklistAnswer) {
    const next = answers[criterionId] === value ? null : value;
    setAnswers((prev) => ({ ...prev, [criterionId]: next }));
    startTransition(async () => {
      await answerChecklistAction(sheetId, criterionId, next);
    });
  }

  const visible = showAll ? questions : questions.slice(0, VISIBLE);
  const answered = Object.values(answers).filter((a) => a !== null).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-h3 font-semibold text-ink">O que só você consegue responder</h2>
        <span className="shrink-0 text-caption tabular-nums text-ink-faint">
          {answered} de {questions.length}
        </span>
      </div>
      <p className="-mt-1 text-caption text-ink-muted">Três toques por pergunta. Cada uma diz onde olhar.</p>

      {visible.map((q) => (
        <Card key={q.criterionId} className="flex flex-col gap-3 p-4">
          <div>
            <p className="text-sm font-medium text-ink">{q.question}</p>
            {q.where && <p className="mt-0.5 text-caption text-ink-faint">Onde olhar: {q.where}</p>}
          </div>
          <div className="flex gap-2">
            {CHECKLIST_ANSWERS.map((a) => {
              const on = answers[q.criterionId] === a.value;
              return (
                <button
                  key={a.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => answer(q.criterionId, a.value)}
                  className={`min-h-10 flex-1 rounded-full border text-sm transition-colors ${on ? CHIP[a.tone].on : CHIP[a.tone].off}`}
                >
                  {a.label}
                </button>
              );
            })}
          </div>
        </Card>
      ))}

      {questions.length > VISIBLE && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="w-fit text-sm font-medium text-accent-strong hover:underline"
        >
          {showAll ? "Mostrar menos" : `Mais ${questions.length - VISIBLE} perguntas`}
        </button>
      )}
    </div>
  );
}
