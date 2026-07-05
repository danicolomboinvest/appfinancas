"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { EntryForm } from "./[year]/[month]/EntryForm";
import { getRecentSubcategoriesAction } from "./actions";

function currentYearMonthFromPath(pathname: string): { year: number; month: number } {
  const match = pathname.match(/^\/mensal\/(\d+)(?:\/(\d+))?/);
  const now = new Date();
  const year = match?.[1] ? Number(match[1]) : now.getFullYear();
  const month = match?.[2] ? Number(match[2]) : now.getMonth() + 1;
  return { year, month };
}

/** Botão fixo "+ Novo gasto", disponível em qualquer tela do Fluxo Financeiro (/mensal/**). */
export function QuickExpenseFab() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [recentSubcategories, setRecentSubcategories] = useState<string[]>([]);
  const { year, month } = currentYearMonthFromPath(pathname);

  useEffect(() => {
    if (open) {
      getRecentSubcategoriesAction().then(setRecentSubcategories);
    }
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full bg-gold px-4 py-3 text-sm font-medium text-black shadow-premium transition-transform hover:scale-105 active:scale-95"
      >
        <Plus size={18} strokeWidth={2} />
        Novo gasto
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={`Novo gasto`}>
        <EntryForm
          year={year}
          month={month}
          recentSubcategories={recentSubcategories}
          layout="stacked"
          onSuccess={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
