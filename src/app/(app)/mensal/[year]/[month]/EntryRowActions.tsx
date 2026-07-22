"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import type { ParentCategory } from "@prisma/client";
import { Modal } from "@/components/ui/Modal";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { useToast } from "@/components/ui/toast-context";
import { EntryForm } from "./EntryForm";
import { deleteMonthlyEntryAction, undoDeleteEntryAction, type DeletedEntrySnapshot } from "./actions";

export type EditableEntry = {
  id: string;
  year: number;
  month: number;
  category: "INCOME" | "EXPENSE" | "INVESTMENT_CONTRIBUTION";
  parentCategory: string | null;
  customCategoryId: string | null;
  subcategory: string | null;
  description: string | null;
  amount: number;
  /** "YYYY-MM-DD" ou null. */
  entryDate: string | null;
  goalId: string | null;
};

/**
 * Ações de um lançamento na lista do mês: Editar (abre o mesmo EntryForm em modo edição) e
 * Excluir com Desfazer, a exclusão guarda um snapshot e o toast oferece recriar por 6s,
 * em vez de exigir confirmação antes (menos atrito, mesmo nível de segurança).
 */
export function EntryRowActions({
  entry,
  recentSubcategories,
  customCategories,
  goals,
}: {
  entry: EditableEntry;
  recentSubcategories: Partial<Record<ParentCategory, string[]>>;
  customCategories: { id: string; name: string }[];
  goals: { id: string; name: string }[];
}) {
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();

  function handleDelete() {
    const snapshot: DeletedEntrySnapshot = {
      year: entry.year,
      month: entry.month,
      category: entry.category,
      parentCategory: entry.parentCategory,
      customCategoryId: entry.customCategoryId,
      subcategory: entry.subcategory,
      description: entry.description,
      amount: entry.amount,
      entryDate: entry.entryDate,
      goalId: entry.goalId,
    };
    startTransition(async () => {
      await deleteMonthlyEntryAction(entry.id, entry.year, entry.month);
      showToast("Lançamento excluído.", {
        label: "Desfazer",
        onClick: () => {
          startTransition(async () => {
            await undoDeleteEntryAction(snapshot);
            showToast("Lançamento restaurado.");
          });
        },
      });
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label="Editar lançamento"
        className="inline-flex items-center gap-1 text-xs text-ink-muted transition-colors hover:text-ink"
      >
        <Pencil size={13} strokeWidth={1.75} />
        Editar
      </button>
      <DeleteButton onDelete={handleDelete} />

      <Modal open={editing} onClose={() => setEditing(false)} title="Editar lançamento">
        <EntryForm
          year={entry.year}
          month={entry.month}
          entryId={entry.id}
          recentSubcategories={recentSubcategories}
          customCategories={customCategories}
          goals={goals}
          layout="stacked"
          onSuccess={() => setEditing(false)}
          defaultDescription={entry.description ?? undefined}
          defaultAmount={entry.amount}
          defaultCategory={entry.category}
          defaultParentCategory={(entry.parentCategory as ParentCategory) ?? undefined}
          defaultSubcategory={entry.subcategory ?? undefined}
          defaultEntryDate={entry.entryDate ?? undefined}
          defaultGoalId={entry.goalId ?? undefined}
        />
      </Modal>
    </>
  );
}
