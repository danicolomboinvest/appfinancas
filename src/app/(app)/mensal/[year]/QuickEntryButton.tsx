"use client";

import { useState } from "react";
import Link from "next/link";
import type { ParentCategory } from "@prisma/client";
import { Modal } from "@/components/ui/Modal";
import { EntryForm } from "./[month]/EntryForm";

const MONTH_LABELS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/** Lançamento rápido direto da listagem anual, sem precisar navegar para a página do mês. */
export function QuickEntryButton({
  year,
  month,
  recentSubcategories = {},
}: {
  year: number;
  month: number;
  recentSubcategories?: Partial<Record<ParentCategory, string[]>>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center justify-end gap-3">
      <button type="button" onClick={() => setOpen(true)} className="font-medium text-accent-strong hover:underline">
        Lançar
      </button>
      <Link href={`/mensal/${year}/${month}`} className="text-xs text-ink-faint hover:text-ink hover:underline">
        Ver mês
      </Link>

      <Modal open={open} onClose={() => setOpen(false)} title={`Lançar em ${MONTH_LABELS[month - 1]} de ${year}`}>
        <EntryForm
          year={year}
          month={month}
          recentSubcategories={recentSubcategories}
          layout="stacked"
          onSuccess={() => setOpen(false)}
        />
      </Modal>
    </div>
  );
}
