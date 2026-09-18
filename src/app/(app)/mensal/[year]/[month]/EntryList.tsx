"use client";

import { useState, useTransition } from "react";
import { CheckSquare, ChevronRight, Pencil, PiggyBank, Receipt, Square, Trash2, TrendingUp, X, type LucideIcon } from "lucide-react";
import type { ParentCategory } from "@prisma/client";
import type { CurrencyCode } from "@/lib/money";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { useToast } from "@/components/ui/toast-context";
import { useMoney } from "@/components/money/MoneyProvider";
import {
  PARENT_CATEGORY_ICON,
  PARENT_CATEGORY_COLOR,
  PARENT_CATEGORY_LABEL,
  CUSTOM_CATEGORY_ICON_MAP,
  colorForCategorySlice,
  isParentCategoryKey,
} from "@/lib/categories";
import { EntryForm } from "./EntryForm";
import {
  deleteMonthlyEntriesAction,
  undoDeleteEntriesAction,
  type DeletedEntrySnapshot,
} from "./actions";

export type ListEntry = {
  id: string;
  category: "INCOME" | "EXPENSE" | "INVESTMENT_CONTRIBUTION";
  parentCategory: string | null;
  customCategoryId: string | null;
  subcategory: string | null;
  description: string | null;
  amount: number;
  /** "YYYY-MM-DD" ou null. */
  entryDate: string | null;
  /** "Hoje", "Ontem" ou "dd/mm" — já calculado no servidor, no fuso do Brasil. */
  dayLabel: string | null;
  goalId: string | null;
  /** Lançado em outra moeda: "€ 2.000,00" já formatado no servidor, e os dados pra editar. */
  originalLabel?: string | null;
  originalAmount?: number | null;
  originalCurrency?: CurrencyCode | null;
  exchangeRate?: number | null;
};

const CATEGORY_AMOUNT_CLASS: Record<ListEntry["category"], string> = {
  INCOME: "text-success",
  EXPENSE: "text-danger",
  INVESTMENT_CONTRIBUTION: "text-accent-strong",
};

const CATEGORY_KIND_LABEL: Record<ListEntry["category"], string> = {
  INCOME: "Renda",
  EXPENSE: "Gasto",
  INVESTMENT_CONTRIBUTION: "Aporte",
};

/** Meses movimentados podem ter dezenas de lançamentos: os mais recentes direto, o resto atrás de "Ver mais". */
const VISIBLE_COUNT = 8;

function categoryVisual(
  entry: ListEntry,
  customCategories: { id: string; icon: string }[],
): { icon: LucideIcon; color: string } {
  if (entry.category === "INCOME") return { icon: TrendingUp, color: "var(--color-success)" };
  if (entry.category === "INVESTMENT_CONTRIBUTION") return { icon: PiggyBank, color: "var(--color-accent)" };
  if (entry.parentCategory && isParentCategoryKey(entry.parentCategory)) {
    return { icon: PARENT_CATEGORY_ICON[entry.parentCategory], color: PARENT_CATEGORY_COLOR[entry.parentCategory] };
  }
  if (entry.customCategoryId) {
    const custom = customCategories.find((c) => c.id === entry.customCategoryId);
    return {
      icon: custom ? (CUSTOM_CATEGORY_ICON_MAP[custom.icon] ?? Receipt) : Receipt,
      color: colorForCategorySlice({ kind: "custom", value: entry.customCategoryId }),
    };
  }
  return { icon: Receipt, color: "var(--color-ink-faint)" };
}

function categoryName(entry: ListEntry, customCategories: { id: string; name: string }[]): string {
  if (entry.parentCategory && isParentCategoryKey(entry.parentCategory)) return PARENT_CATEGORY_LABEL[entry.parentCategory];
  if (entry.customCategoryId) return customCategories.find((c) => c.id === entry.customCategoryId)?.name ?? "Categoria";
  return CATEGORY_KIND_LABEL[entry.category];
}

function toSnapshot(entry: ListEntry, year: number, month: number): DeletedEntrySnapshot {
  return {
    year,
    month,
    category: entry.category,
    parentCategory: entry.parentCategory,
    customCategoryId: entry.customCategoryId,
    subcategory: entry.subcategory,
    description: entry.description,
    amount: entry.amount,
    entryDate: entry.entryDate,
    goalId: entry.goalId,
    originalAmount: entry.originalAmount ?? null,
    originalCurrency: entry.originalCurrency ?? null,
    exchangeRate: entry.exchangeRate ?? null,
  };
}

/**
 * A lista de lançamentos do mês.
 *
 * Antes cada linha carregava "✎ Editar" e "🗑 Remover" por extenso, e no celular os dois
 * botões engoliam a largura: sobrava "Sem s…" pro nome e a pessoa não conseguia LER o que
 * tinha lançado — a lista servia pra editar, não pra ver. Agora a linha é só leitura (nome,
 * data, descrição, valor) e abre ao toque numa folha com tudo por extenso e os dois botões
 * com espaço de sobra. No computador, onde cabe, os ícones ficam inline.
 *
 * E existe um modo "Selecionar": marca várias linhas e remove de uma vez, com Desfazer.
 * Editar em lote não existe de propósito — dois lançamentos raramente querem a MESMA
 * alteração, e um botão que promete isso entrega um formulário confuso.
 */
export function EntryList({
  entries,
  year,
  month,
  recentSubcategories,
  customCategories,
  goals,
}: {
  entries: ListEntry[];
  year: number;
  month: number;
  recentSubcategories: Partial<Record<ParentCategory, string[]>>;
  customCategories: { id: string; name: string; icon: string }[];
  goals: { id: string; name: string }[];
}) {
  const money = useMoney();
  const { showToast } = useToast();
  const [, startTransition] = useTransition();

  const [openId, setOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const open = entries.find((e) => e.id === openId) ?? null;
  const editing = entries.find((e) => e.id === editingId) ?? null;

  function removeEntries(targets: ListEntry[]) {
    if (targets.length === 0) return;
    const snapshots = targets.map((t) => toSnapshot(t, year, month));
    const quantos = targets.length;
    startTransition(async () => {
      const { jaNaCarteira } = await deleteMonthlyEntriesAction(
        targets.map((t) => t.id),
        year,
        month,
      );
      // Aporte que já tinha sido distribuído: o dinheiro fica no ativo de propósito (é a posição
      // real da pessoa). Dizer isso na hora é o que impede o mês e a carteira de divergirem
      // sem ninguém perceber.
      const base = quantos === 1 ? "Lançamento excluído." : `${quantos} lançamentos excluídos.`;
      showToast(jaNaCarteira > 0 ? `${base} O que já estava distribuído continua na carteira.` : base, {
        label: "Desfazer",
        onClick: () => {
          startTransition(async () => {
            const result = await undoDeleteEntriesAction(snapshots);
            showToast(
              result.ok
                ? quantos === 1
                  ? "Lançamento restaurado."
                  : `${quantos} lançamentos restaurados.`
                : "Não foi possível restaurar. Lance de novo manualmente.",
            );
          });
        },
      });
    });
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function leaveSelection() {
    setSelecting(false);
    setSelected(new Set());
  }

  function renderRow(entry: ListEntry) {
    const visual = categoryVisual(entry, customCategories);
    const marcado = selected.has(entry.id);
    return (
      <Card
        key={entry.id}
        as="div"
        className={`flex items-center gap-3 p-3 transition-colors ${marcado ? "border-accent/50 bg-accent-soft/40" : ""}`}
      >
        <button
          type="button"
          onClick={() => (selecting ? toggle(entry.id) : setOpenId(entry.id))}
          aria-pressed={selecting ? marcado : undefined}
          aria-label={selecting ? `${marcado ? "Desmarcar" : "Marcar"} ${entry.subcategory ?? categoryName(entry, customCategories)}` : `Abrir ${entry.subcategory ?? categoryName(entry, customCategories)}`}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          {selecting ? (
            <span className={`shrink-0 ${marcado ? "text-accent-strong" : "text-ink-faint"}`}>
              {marcado ? <CheckSquare size={22} strokeWidth={1.75} /> : <Square size={22} strokeWidth={1.75} />}
            </span>
          ) : (
            <CategoryIcon icon={visual.icon} color={visual.color} />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium text-ink">
              {entry.subcategory ?? categoryName(entry, customCategories)}
            </span>
            <span className="block truncate text-xs text-ink-faint">
              {entry.dayLabel && <span className="tabular-nums">{entry.dayLabel}</span>}
              {entry.dayLabel && entry.description && " · "}
              {entry.description}
            </span>
          </span>
          <span className="flex shrink-0 flex-col items-end">
            <span className={`text-[15px] font-semibold tabular-nums ${CATEGORY_AMOUNT_CLASS[entry.category]}`}>
              {money(entry.amount)}
            </span>
            {entry.originalLabel && <span className="text-[11px] tabular-nums text-ink-faint">{entry.originalLabel}</span>}
          </span>
          {!selecting && <ChevronRight size={16} className="shrink-0 text-ink-faint md:hidden" />}
        </button>

        {/* No computador cabe: ícones sem texto, com o rótulo no aria-label. */}
        {!selecting && (
          <span className="hidden shrink-0 items-center gap-1 md:flex">
            <button
              type="button"
              onClick={() => setEditingId(entry.id)}
              aria-label="Editar lançamento"
              title="Editar"
              className="rounded-full p-2 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <Pencil size={15} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => removeEntries([entry])}
              aria-label="Remover lançamento"
              title="Remover"
              className="rounded-full p-2 text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger"
            >
              <Trash2 size={15} strokeWidth={1.75} />
            </button>
          </span>
        )}
      </Card>
    );
  }

  const primeiros = entries.slice(0, VISIBLE_COUNT);
  const resto = entries.slice(VISIBLE_COUNT);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <p className="text-caption text-ink-faint">
          {entries.length} {entries.length === 1 ? "lançamento" : "lançamentos"}
        </p>
        {selecting ? (
          <button type="button" onClick={leaveSelection} className="text-caption font-medium text-accent-strong">
            Cancelar
          </button>
        ) : (
          <button type="button" onClick={() => setSelecting(true)} className="text-caption font-medium text-accent-strong">
            Selecionar
          </button>
        )}
      </div>

      {primeiros.map(renderRow)}
      {resto.length > 0 && (
        <CollapsibleSection label={`Ver mais ${resto.length} lançamentos`}>
          <div className="flex flex-col gap-2">{resto.map(renderRow)}</div>
        </CollapsibleSection>
      )}

      {/* Barra do modo seleção: acima da tab bar do celular, com o que dá pra fazer. */}
      {selecting && (
        <div className="fixed inset-x-4 bottom-[calc(6.5rem_+_env(safe-area-inset-bottom))] z-30 md:inset-x-auto md:bottom-6 md:right-10 md:w-96">
          <div className="glass flex items-center justify-between gap-3 rounded-2xl border border-border-strong p-3 shadow-premium">
            <span className="text-sm text-ink">
              <span className="font-semibold tabular-nums">{selected.size}</span>{" "}
              {selected.size === 1 ? "selecionado" : "selecionados"}
            </span>
            <span className="flex items-center gap-2">
              <button
                type="button"
                disabled={selected.size === 0}
                onClick={() => {
                  removeEntries(entries.filter((e) => selected.has(e.id)));
                  leaveSelection();
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-danger px-4 py-2 text-sm font-semibold text-canvas transition-opacity disabled:opacity-40"
              >
                <Trash2 size={15} strokeWidth={2} />
                Remover
              </button>
              <button
                type="button"
                onClick={leaveSelection}
                aria-label="Sair da seleção"
                className="rounded-full p-2 text-ink-muted hover:bg-surface-2 hover:text-ink"
              >
                <X size={18} />
              </button>
            </span>
          </div>
        </div>
      )}

      {/* Folha do lançamento: tudo por extenso e os dois botões com espaço de sobra. */}
      <Modal open={open !== null} onClose={() => setOpenId(null)} title="Lançamento">
        {open && (
          <div className="flex flex-col gap-5">
            <div className="flex items-start gap-3">
              <CategoryIcon icon={categoryVisual(open, customCategories).icon} color={categoryVisual(open, customCategories).color} size={44} />
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold leading-tight text-ink">
                  {open.subcategory ?? categoryName(open, customCategories)}
                </p>
                <p className="mt-0.5 text-sm text-ink-muted">
                  {CATEGORY_KIND_LABEL[open.category]}
                  {open.subcategory && ` · ${categoryName(open, customCategories)}`}
                  {open.dayLabel && ` · ${open.dayLabel}`}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className={`text-xl font-semibold tabular-nums ${CATEGORY_AMOUNT_CLASS[open.category]}`}>
                  {money(open.amount)}
                </p>
                {open.originalLabel && open.exchangeRate && (
                  <p className="text-xs tabular-nums text-ink-faint">
                    {open.originalLabel} · cotação {open.exchangeRate.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}
                  </p>
                )}
              </div>
            </div>
            {open.description && <p className="text-sm leading-relaxed text-ink">{open.description}</p>}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setOpenId(null);
                  setEditingId(open.id);
                }}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-border-strong bg-surface-2 text-sm font-semibold text-ink transition-colors hover:bg-surface-hover"
              >
                <Pencil size={16} strokeWidth={1.75} />
                Editar
              </button>
              <button
                type="button"
                onClick={() => {
                  const alvo = open;
                  setOpenId(null);
                  removeEntries([alvo]);
                }}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-danger-soft text-sm font-semibold text-danger transition-colors hover:bg-danger hover:text-canvas"
              >
                <Trash2 size={16} strokeWidth={1.75} />
                Remover
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditingId(null)} title="Editar lançamento">
        {editing && (
          <EntryForm
            year={year}
            month={month}
            entryId={editing.id}
            recentSubcategories={recentSubcategories}
            customCategories={customCategories}
            goals={goals}
            layout="stacked"
            onSuccess={() => setEditingId(null)}
            defaultDescription={editing.description ?? undefined}
            defaultAmount={editing.originalCurrency ? (editing.originalAmount ?? editing.amount) : editing.amount}
            defaultCurrency={editing.originalCurrency ?? undefined}
            defaultExchangeRate={editing.exchangeRate ?? undefined}
            defaultCategory={editing.category}
            defaultParentCategory={(editing.parentCategory as ParentCategory) ?? undefined}
            defaultSubcategory={editing.subcategory ?? undefined}
            defaultEntryDate={editing.entryDate ?? undefined}
            defaultGoalId={editing.goalId ?? undefined}
          />
        )}
      </Modal>
    </div>
  );
}
