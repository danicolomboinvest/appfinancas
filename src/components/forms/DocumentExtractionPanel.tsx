"use client";

import { useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  getCriteriaForSlot,
  type DocumentSlot,
  type SheetCriterion,
} from "@/lib/analysis/document-extraction";
import { extractDocumentAction } from "@/app/(app)/fichas/acoes/[id]/actions";

const SLOT_LABELS: Record<DocumentSlot, { title: string; hint: string }> = {
  ESTATUTO_SOCIAL: {
    title: "Estatuto Social",
    hint: "Edital de registro na B3 ou estatuto social da empresa.",
  },
  RELATORIO_GERENCIAL: {
    title: "Relatório Gerencial / Release de Resultados",
    hint: "O documento principal — cobre a maior parte dos critérios quantitativos.",
  },
  OUTRO: {
    title: "Outro documento",
    hint: "Qualquer outro material — notícia, print do Glassdoor/Reclame Aqui etc.",
  },
};

type SlotResult = { key: string; value: string | null };

function UploadSlot({
  slot,
  criteria,
  onApply,
}: {
  slot: DocumentSlot;
  criteria: SheetCriterion[];
  onApply: (suggestions: { criterionId: string; value: string }[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SlotResult[] | null>(null);
  const [applied, setApplied] = useState(false);

  const { title, hint } = SLOT_LABELS[slot];
  const found = results?.filter((r) => r.value !== null) ?? [];
  const notFound = results?.filter((r) => r.value === null) ?? [];

  async function handleExtract() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Selecione um arquivo PDF primeiro.");
      return;
    }
    setIsPending(true);
    setError(null);
    setResults(null);
    setApplied(false);

    const formData = new FormData();
    formData.set("file", file);
    const extractionCriteria = criteria.map((c) => ({ key: c.key, label: c.label, helpText: c.helpText }));
    const response = await extractDocumentAction(slot, extractionCriteria, formData);
    setIsPending(false);

    if (response.error) {
      setError(response.error);
      return;
    }
    setResults(response.results ?? []);
  }

  function handleApply() {
    if (!results) return;
    const criterionByKey = new Map(criteria.map((c) => [c.key, c.id]));
    const suggestions = found
      .map((r) => ({ criterionId: criterionByKey.get(r.key), value: r.value }))
      .filter((s): s is { criterionId: string; value: string } => !!s.criterionId && s.value !== null);
    onApply(suggestions);
    setApplied(true);
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div>
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="text-xs text-ink-faint">{hint}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="max-w-full text-xs text-ink-muted file:mr-3 file:rounded-lg file:border file:border-border-strong file:bg-surface-2 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink"
        />
        <Button type="button" size="sm" variant="secondary" onClick={handleExtract} disabled={isPending}>
          {isPending ? "Extraindo..." : "Extrair dados"}
        </Button>
      </div>

      {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>}

      {results && (
        <div className="flex flex-col gap-2 rounded-lg border border-border-strong bg-surface-2 p-3">
          <p className="text-xs font-medium text-ink">
            {found.length} de {results.length} critérios encontrados
          </p>
          <div className="flex flex-col gap-1">
            {found.map((r) => {
              const criterion = criteria.find((c) => c.key === r.key);
              return (
                <div key={r.key} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-ink-muted">{criterion?.label ?? r.key}</span>
                  <Badge tone="success">{r.value}</Badge>
                </div>
              );
            })}
            {notFound.map((r) => {
              const criterion = criteria.find((c) => c.key === r.key);
              return (
                <div key={r.key} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-ink-faint">{criterion?.label ?? r.key}</span>
                  <span className="text-ink-faint">Não encontrado aqui — busque em outra fonte</span>
                </div>
              );
            })}
          </div>
          {found.length > 0 && (
            <Button type="button" size="sm" onClick={handleApply} disabled={applied} className="w-fit">
              {applied ? "Aplicado ao formulário" : "Aplicar sugestões"}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

/**
 * 3 slots de upload de documento pra pré-preencher a Ficha de Ações — não salva nada sozinho,
 * só aplica sugestões nos campos ainda vazios do formulário abaixo (CriteriaForm, via onApply).
 */
export function DocumentExtractionPanel({
  criteria,
  onApply,
}: {
  criteria: SheetCriterion[];
  onApply: (suggestions: { criterionId: string; value: string }[]) => void;
}) {
  const slots: DocumentSlot[] = ["ESTATUTO_SOCIAL", "RELATORIO_GERENCIAL", "OUTRO"];

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold text-ink">Preencher automaticamente</h2>
        <p className="text-xs text-ink-faint">
          Suba um documento pra cada slot abaixo — a IA procura os critérios correspondentes e sugere os valores.
          Você sempre revisa antes de salvar.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {slots.map((slot) => (
          <UploadSlot key={slot} slot={slot} criteria={getCriteriaForSlot(slot, criteria)} onApply={onApply} />
        ))}
      </div>
    </div>
  );
}
