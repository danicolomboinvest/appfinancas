"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Check, HelpCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { CHECKLIST_ANSWERS, type ChecklistAnswer } from "@/lib/analysis/checklist";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { answerChecklistAction } from "./laudo-actions";

export type ChecklistQuestion = {
  criterionId: string;
  question: string;
  where: string | null;
  answer: ChecklistAnswer | null;
};

const VISIBLE = 3;

const ICON: Record<ChecklistAnswer, typeof Check> = { tranquilo: Check, nao_sei: HelpCircle, vi_algo: AlertTriangle };
const ON: Record<ChecklistAnswer, string> = {
  tranquilo: "border-success bg-success-soft text-success",
  nao_sei: "border-ink-faint bg-surface-2 text-ink",
  vi_algo: "border-danger bg-danger-soft text-danger",
};

/**
 * "Só você responde": uma pergunta por linha e três círculos — ✓ ? ! — no lugar de três
 * botões escritos. Salva a cada toque. O "onde olhar" aparece ao tocar na pergunta, não
 * de cara: é ajuda, não conteúdo.
 */
export function Checklist({ sheetId, questions }: { sheetId: string; questions: ChecklistQuestion[] }) {
  const [answers, setAnswers] = useState<Record<string, ChecklistAnswer | null>>(() =>
    Object.fromEntries(questions.map((q) => [q.criterionId, q.answer])),
  );
  const [showAll, setShowAll] = useState(false);
  const [hintFor, setHintFor] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const t = useProfileTheme().voz.titulos;

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
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-ink">{t.fichasSoVoce}</h2>
        <span className="shrink-0 text-caption tabular-nums text-ink-faint">{t.fichasRespondidas(answered, questions.length)}</span>
      </div>

      {visible.map((q) => (
        <div key={q.criterionId} className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setHintFor(hintFor === q.criterionId ? null : q.criterionId)}
              className="min-w-0 flex-1 text-left text-sm text-ink"
              aria-expanded={hintFor === q.criterionId}
            >
              {q.question}
            </button>
            <span className="flex shrink-0 gap-1.5">
              {CHECKLIST_ANSWERS.map((a) => {
                const Icon = ICON[a.value];
                const on = answers[q.criterionId] === a.value;
                return (
                  <button
                    key={a.value}
                    type="button"
                    aria-pressed={on}
                    aria-label={a.label}
                    title={a.label}
                    onClick={() => answer(q.criterionId, a.value)}
                    className={`flex size-9 items-center justify-center rounded-full border transition-colors ${
                      on ? ON[a.value] : "border-border-strong text-ink-faint hover:text-ink"
                    }`}
                  >
                    <Icon size={16} strokeWidth={2.25} />
                  </button>
                );
              })}
            </span>
          </div>
          {hintFor === q.criterionId && q.where && <p className="text-caption text-ink-faint">{t.fichasOndeOlhar(q.where)}</p>}
        </div>
      ))}

      {questions.length > VISIBLE && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="w-fit text-sm font-medium text-accent-strong hover:underline">
          {showAll ? t.fichasMenos : t.fichasMais(questions.length - VISIBLE)}
        </button>
      )}
    </Card>
  );
}
