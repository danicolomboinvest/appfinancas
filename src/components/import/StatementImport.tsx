"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, Check, ArrowRight } from "lucide-react";
import type { ParentCategory } from "@prisma/client";
import { PARENT_CATEGORIES, PARENT_CATEGORY_LABEL } from "@/lib/categories";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/toast-context";
import {
  parseStatementAction,
  importTransactionsAction,
  type ReviewItem,
  type ConfirmedItem,
} from "@/app/(app)/mensal/import-actions";

type Phase = "upload" | "review" | "confirm" | "done";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}` : iso;
}

/** O arquivo vai CRU num FormData (string grande de base64 estoura o limite de serialização
 * das actions). O encoding diz ao servidor como interpretar os bytes. */
function buildUploadForm(file: File): FormData {
  const name = file.name.toLowerCase();
  const encoding = name.endsWith(".xlsx") || name.endsWith(".xls") ? "xlsx" : name.endsWith(".pdf") ? "pdf" : "text";
  const formData = new FormData();
  formData.set("file", file);
  formData.set("encoding", encoding);
  return formData;
}

/**
 * Importação de extrato bancário (item 3). Upload CSV/OFX → classificação automática → fila de
 * revisão (uma transação por vez, chips de categoria em 1 toque) → confirmação. As categorias
 * definidas na revisão viram regra aprendida no servidor pra próxima importação.
 */
export function StatementImport({ onDone }: { onDone: () => void }) {
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("upload");
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [createdCount, setCreatedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Índices das transações que precisam de revisão manual (gasto sem categoria).
  const reviewQueue = items
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => it.category === "EXPENSE" && !it.parentCategory);

  async function handleFile(file: File) {
    setError(null);
    // Limite do corpo da Server Action é 8 MB — barra antes com mensagem clara.
    if (file.size > 7.5 * 1024 * 1024) {
      setError("Arquivo muito grande (máx. ~7 MB). Exporte um período menor do extrato e tente de novo.");
      return;
    }
    const formData = buildUploadForm(file);
    startTransition(async () => {
      const result = await parseStatementAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setItems(result.items);
      setReviewIdx(0);
      // Se nada precisa de revisão, pula direto pra confirmação.
      const needsReview = result.items.some((it) => it.category === "EXPENSE" && !it.parentCategory);
      setPhase(needsReview ? "review" : "confirm");
    });
  }

  function assignCategory(itemKey: number, parentCategory: ParentCategory | null) {
    setItems((prev) =>
      prev.map((it) => (it.key === itemKey ? { ...it, parentCategory, subcategory: null, autoClassified: false } : it)),
    );
  }

  function advanceReview() {
    if (reviewIdx + 1 < reviewQueue.length) {
      setReviewIdx((i) => i + 1);
    } else {
      setPhase("confirm");
    }
  }

  function handleImport() {
    const confirmed: ConfirmedItem[] = items
      .filter((it) => it.category === "INCOME" || it.parentCategory) // pula gastos ainda sem categoria
      .map((it) => ({
        date: it.date,
        description: it.description,
        amount: it.amount,
        category: it.category,
        parentCategory: it.parentCategory,
        subcategory: it.subcategory,
        // Aprende quando foi o usuário quem classificou (não veio 100% automático).
        learn: !it.autoClassified,
      }));
    startTransition(async () => {
      const result = await importTransactionsAction(confirmed);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCreatedCount(result.created);
      setPhase("done");
      showToast(
        result.skipped > 0
          ? `${result.created} importados · ${result.skipped} já existiam (ignorados).`
          : `${result.created} lançamentos importados.`,
      );
    });
  }

  // --- UPLOAD ---
  if (phase === "upload") {
    return (
      <div className="flex flex-col gap-4">
        {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={isPending}
          className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong bg-surface-2 px-4 py-10 text-center transition-colors hover:border-accent hover:bg-surface-hover disabled:opacity-60"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-canvas">
            <Upload size={22} strokeWidth={1.75} />
          </span>
          <span className="text-sm font-medium text-ink">{isPending ? "Lendo arquivo..." : "Escolher extrato"}</span>
          <span className="text-caption text-ink-faint">CSV, OFX, Excel ou PDF do seu banco</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.ofx,.txt,.xlsx,.xls,.pdf,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>
    );
  }

  // --- REVIEW (uma por vez, chips) ---
  if (phase === "review") {
    const entry = reviewQueue[reviewIdx];
    if (!entry) {
      // Fila esvaziou (todas classificadas) — segue pra confirmação.
      setPhase("confirm");
      return null;
    }
    const it = entry.it;
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between text-caption text-ink-muted">
          <span>
            Revisar {reviewIdx + 1} de {reviewQueue.length}
          </span>
          <button type="button" onClick={advanceReview} className="text-ink-faint hover:text-ink">
            Pular
          </button>
        </div>

        <div className="rounded-xl border border-border bg-surface-2 p-4">
          <p className="text-sm font-medium text-ink">{it.description}</p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-caption text-ink-faint">{formatDate(it.date)}</span>
            <span className="text-indicator font-semibold tabular-nums text-danger">− {formatBRL(it.amount)}</span>
          </div>
        </div>

        <p className="text-xs font-medium text-ink-muted">Qual a categoria?</p>
        <div className="flex flex-wrap gap-2">
          {PARENT_CATEGORIES.map((pc) => (
            <button
              key={pc}
              type="button"
              onClick={() => {
                assignCategory(it.key, pc);
                advanceReview();
              }}
              className="rounded-full border border-border-strong bg-surface px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-accent hover:bg-accent-soft active:scale-95"
            >
              {PARENT_CATEGORY_LABEL[pc]}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // --- CONFIRM ---
  if (phase === "confirm") {
    const importable = items.filter((it) => it.category === "INCOME" || it.parentCategory);
    return (
      <div className="flex flex-col gap-4">
        {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <p className="text-sm text-ink-muted">
          {importable.length} lançamento{importable.length === 1 ? "" : "s"} pronto{importable.length === 1 ? "" : "s"} para importar.
        </p>
        <ul className="flex max-h-64 flex-col divide-y divide-border overflow-y-auto rounded-xl border border-border">
          {importable.map((it) => (
            <li key={it.key} className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm text-ink">{it.description}</p>
                <p className="text-caption text-ink-faint">
                  {formatDate(it.date)} ·{" "}
                  {it.category === "INCOME" ? "Renda" : it.parentCategory ? PARENT_CATEGORY_LABEL[it.parentCategory] : "—"}
                </p>
              </div>
              <span className={`shrink-0 text-sm font-medium tabular-nums ${it.category === "INCOME" ? "text-success" : "text-danger"}`}>
                {it.category === "INCOME" ? "+" : "−"} {formatBRL(it.amount)}
              </span>
            </li>
          ))}
        </ul>
        <Button type="button" onClick={handleImport} disabled={isPending || importable.length === 0}>
          {isPending ? "Importando..." : `Importar ${importable.length} lançamento${importable.length === 1 ? "" : "s"}`}
          <ArrowRight size={16} className="ml-1.5" />
        </Button>
      </div>
    );
  }

  // --- DONE ---
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success">
        <Check size={28} strokeWidth={2} />
      </span>
      <p className="text-sm font-medium text-ink">{createdCount} lançamentos importados com sucesso.</p>
      <Button type="button" onClick={onDone}>
        Concluir
      </Button>
    </div>
  );
}
