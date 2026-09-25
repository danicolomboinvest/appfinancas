"use client";

import { useState, useTransition } from "react";
import { CheckSquare, ChevronRight, Pencil, PiggyBank, Receipt, Square, Trash2, TrendingUp, X, type LucideIcon } from "lucide-react";
import type { ParentCategory, ProfileKind } from "@prisma/client";
import type { CurrencyCode } from "@/lib/money";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { emojiDaCategoria } from "@/lib/profiles/icones";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import type { Voz } from "@/lib/profiles/voice";
import { partesDoTexto } from "@/lib/profiles/textos/shell";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { useToast } from "@/components/ui/toast-context";
import { useMoney } from "@/components/money/MoneyProvider";
import {
  PARENT_CATEGORIES,
  PARENT_CATEGORY_COLOR,
  CUSTOM_CATEGORY_ICON_MAP,
  categoryIcon,
  categoryLabel,
  colorForCategorySlice,
  isParentCategoryKey,
} from "@/lib/categories";
import { EntryForm } from "./EntryForm";
import {
  deleteMonthlyEntriesAction,
  undoDeleteEntriesAction,
  updateMonthlyEntriesCategoryAction,
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

/** "Renda", "Gasto", "Aporte" — na voz do tema, porque o Girly não diz "aporte". */
function categoryKindLabel(category: ListEntry["category"], voz: Voz): string {
  if (category === "INCOME") return voz.titulos.uiTipoRenda;
  if (category === "EXPENSE") return voz.titulos.uiTipoGasto;
  return voz.titulos.uiTipoAporte;
}

/** Meses movimentados podem ter dezenas de lançamentos: os mais recentes direto, o resto atrás de "Ver mais". */
const VISIBLE_COUNT = 8;

function categoryVisual(
  entry: ListEntry,
  customCategories: { id: string; icon: string }[],
  tema: string,
  kind: ProfileKind,
): { icon: LucideIcon; color: string; emoji: string | undefined } {
  if (entry.category === "INCOME") return { icon: TrendingUp, color: "var(--color-success)", emoji: emojiDaCategoria(tema, { kind: "income" }) };
  if (entry.category === "INVESTMENT_CONTRIBUTION") return { icon: PiggyBank, color: "var(--color-accent)", emoji: emojiDaCategoria(tema, { kind: "investment" }) };
  if (entry.parentCategory && isParentCategoryKey(entry.parentCategory)) {
    return {
      icon: categoryIcon(kind, entry.parentCategory),
      color: PARENT_CATEGORY_COLOR[entry.parentCategory],
      emoji: emojiDaCategoria(tema, { kind: "parent", value: entry.parentCategory }),
    };
  }
  if (entry.customCategoryId) {
    const custom = customCategories.find((c) => c.id === entry.customCategoryId);
    return {
      icon: custom ? (CUSTOM_CATEGORY_ICON_MAP[custom.icon] ?? Receipt) : Receipt,
      color: colorForCategorySlice({ kind: "custom", value: entry.customCategoryId }),
      emoji: emojiDaCategoria(tema, { kind: "custom", iconKey: custom?.icon }),
    };
  }
  return { icon: Receipt, color: "var(--color-ink-faint)", emoji: emojiDaCategoria(tema, { kind: "none" }) };
}

function categoryName(entry: ListEntry, customCategories: { id: string; name: string }[], voz: Voz, kind: ProfileKind): string {
  if (entry.parentCategory && isParentCategoryKey(entry.parentCategory)) return categoryLabel(kind, entry.parentCategory);
  if (entry.customCategoryId) return customCategories.find((c) => c.id === entry.customCategoryId)?.name ?? voz.titulos.uiCategoriaSemNome;
  return categoryKindLabel(entry.category, voz);
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
  // O tema decide se a categoria é ícone de linha ou emoji (ver icones.ts); a voz, o que a
  // lista diz ("Ver mais", "Remover", os avisos de excluído/restaurado); o tipo do perfil,
  // como cada categoria-mãe se chama (numa Empresa, MORADIA é "Estrutura").
  const { key: tema, voz, kind } = useProfileTheme();
  const t = voz.titulos;
  const money = useMoney();
  const { showToast } = useToast();
  const [, startTransition] = useTransition();

  const [openId, setOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCategorizing, setBulkCategorizing] = useState(false);

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
      const base = t.uiExcluido(quantos);
      showToast(jaNaCarteira > 0 ? `${base} ${t.uiExcluidoContinuaNaCarteira}` : base, {
        label: t.uiDesfazer,
        onClick: () => {
          startTransition(async () => {
            const result = await undoDeleteEntriesAction(snapshots);
            showToast(result.ok ? t.uiRestaurado(quantos) : t.uiRestaurarFalhou);
          });
        },
      });
    });
  }

  /** Muda a categoria de todos os marcados de uma vez — as parcelas de uma mesma compra que
   * caíram em "Outros" na importação, por exemplo, todas pra mesma categoria de verdade. */
  function applyBulkCategory(category: { parentCategory: ParentCategory | null; customCategoryId: string | null }) {
    const ids = [...selected];
    setBulkCategorizing(false);
    startTransition(async () => {
      const { count } = await updateMonthlyEntriesCategoryAction(ids, category, year, month);
      showToast(t.uiCategoriaAtualizada(count));
    });
    leaveSelection();
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
    const visual = categoryVisual(entry, customCategories, tema, kind);
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
          aria-label={selecting ? `${marcado ? "Desmarcar" : "Marcar"} ${entry.subcategory ?? categoryName(entry, customCategories, voz, kind)}` : `Abrir ${entry.subcategory ?? categoryName(entry, customCategories, voz, kind)}`}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          {selecting ? (
            <span className={`shrink-0 ${marcado ? "text-accent-strong" : "text-ink-faint"}`}>
              {marcado ? <CheckSquare size={22} strokeWidth={1.75} /> : <Square size={22} strokeWidth={1.75} />}
            </span>
          ) : (
            <CategoryIcon icon={visual.icon} color={visual.color} emoji={visual.emoji} />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium text-ink">
              {entry.subcategory ?? categoryName(entry, customCategories, voz, kind)}
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
              aria-label={t.uiEditarLancamento}
              title={t.uiEditar}
              className="rounded-full p-2 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <Pencil size={15} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => removeEntries([entry])}
              aria-label={t.uiRemoverLancamento}
              title={t.uiRemover}
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

  // Categoria só existe em Gasto (Renda e Aporte não têm categoria-mãe): o botão de mudar em
  // lote só aparece quando TUDO que está marcado é gasto, pra não prometer uma troca que não
  // faz sentido pro que a pessoa selecionou.
  const selectedEntries = entries.filter((e) => selected.has(e.id));
  const podeCategorizarEmLote = selectedEntries.length > 0 && selectedEntries.every((e) => e.category === "EXPENSE");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <p className="text-caption text-ink-faint">{t.uiContagemLancamentos(entries.length)}</p>
        {selecting ? (
          <button type="button" onClick={leaveSelection} className="text-caption font-medium text-accent-strong">
            {t.uiCancelar}
          </button>
        ) : (
          <button type="button" onClick={() => setSelecting(true)} className="text-caption font-medium text-accent-strong">
            {t.uiSelecionar}
          </button>
        )}
      </div>

      {/* No computador, dois lançamentos por linha: um por linha na largura toda era um
          corredor vazio entre a descrição e o valor. */}
      <div className="flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-4">{primeiros.map(renderRow)}</div>
      {resto.length > 0 && (
        <CollapsibleSection label={t.uiVerMaisLancamentos(resto.length)}>
          <div className="flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-4">{resto.map(renderRow)}</div>
        </CollapsibleSection>
      )}

      {/* Barra do modo seleção: acima da tab bar do celular, com o que dá pra fazer. */}
      {selecting && (
        <div className="fixed inset-x-4 bottom-[calc(6.5rem_+_env(safe-area-inset-bottom))] z-30 md:inset-x-auto md:bottom-6 md:right-10 md:w-96">
          <div className="glass flex items-center justify-between gap-3 rounded-2xl border border-border-strong p-3 shadow-premium">
            <span className="text-sm text-ink">
              {/* "**3** selecionados": o número vem marcado na voz e vira o destaque aqui. */}
              {partesDoTexto(t.uiSelecionados(selected.size)).map((p, i) =>
                p.negrito ? (
                  <span key={i} className="font-semibold tabular-nums">
                    {p.texto}
                  </span>
                ) : (
                  p.texto
                ),
              )}
            </span>
            <span className="flex items-center gap-2">
              {podeCategorizarEmLote && (
                <button
                  type="button"
                  onClick={() => setBulkCategorizing(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-accent-gradient px-4 py-2 text-sm font-semibold text-on-accent transition-opacity"
                >
                  <Pencil size={15} strokeWidth={2} />
                  {t.uiMudarCategoria}
                </button>
              )}
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
                {t.uiRemover}
              </button>
              <button
                type="button"
                onClick={leaveSelection}
                aria-label={t.uiSairDaSelecao}
                className="rounded-full p-2 text-ink-muted hover:bg-surface-2 hover:text-ink"
              >
                <X size={18} />
              </button>
            </span>
          </div>
        </div>
      )}

      {/* Muda a categoria de todos os marcados de uma vez — parcelas de uma mesma compra, por
          exemplo, que a classificação automática jogou em "Outros" mas são todas a mesma coisa. */}
      <Modal open={bulkCategorizing} onClose={() => setBulkCategorizing(false)} title={t.uiMudarCategoriaTitulo(selected.size)}>
        <div className="flex flex-wrap gap-2">
          {PARENT_CATEGORIES.map((pc) => (
            <button
              key={pc}
              type="button"
              onClick={() => applyBulkCategory({ parentCategory: pc, customCategoryId: null })}
              className="rounded-full border border-border-strong bg-surface px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-accent hover:bg-accent-soft"
            >
              {categoryLabel(kind, pc)}
            </button>
          ))}
          {customCategories.map((cc) => (
            <button
              key={cc.id}
              type="button"
              onClick={() => applyBulkCategory({ parentCategory: null, customCategoryId: cc.id })}
              className="rounded-full border border-border-strong bg-surface px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-accent hover:bg-accent-soft"
            >
              {cc.name}
            </button>
          ))}
        </div>
      </Modal>

      {/* Folha do lançamento: tudo por extenso e os dois botões com espaço de sobra. */}
      <Modal open={open !== null} onClose={() => setOpenId(null)} title={t.uiLancamento}>
        {open && (
          <div className="flex flex-col gap-5">
            <div className="flex items-start gap-3">
              <CategoryIcon icon={categoryVisual(open, customCategories, tema, kind).icon} color={categoryVisual(open, customCategories, tema, kind).color} emoji={categoryVisual(open, customCategories, tema, kind).emoji} size={44} />
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold leading-tight text-ink">
                  {open.subcategory ?? categoryName(open, customCategories, voz, kind)}
                </p>
                <p className="mt-0.5 text-sm text-ink-muted">
                  {categoryKindLabel(open.category, voz)}
                  {open.subcategory && ` · ${categoryName(open, customCategories, voz, kind)}`}
                  {open.dayLabel && ` · ${open.dayLabel}`}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className={`text-xl font-semibold tabular-nums ${CATEGORY_AMOUNT_CLASS[open.category]}`}>
                  {money(open.amount)}
                </p>
                {open.originalLabel && open.exchangeRate && (
                  <p className="text-xs tabular-nums text-ink-faint">
                    {open.originalLabel} · {t.uiCotacao(open.exchangeRate.toLocaleString("pt-BR", { maximumFractionDigits: 4 }))}
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
                {t.uiEditar}
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
                {t.uiRemover}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditingId(null)} title={t.uiEditarLancamento}>
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
