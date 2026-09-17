"use client";

import Link from "next/link";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronLeft, FileUp, Keyboard, Mic, Landmark } from "lucide-react";
import type { ParentCategory } from "@prisma/client";
import { Modal } from "@/components/ui/Modal";
import { EntryForm } from "@/app/(app)/mensal/[year]/[month]/EntryForm";
import { SUBCATEGORIES, INCOME_TYPES } from "@/lib/categories";
import { getRecentSubcategoriesAction, getCustomCategoriesAction, getGoalsAction } from "@/app/(app)/mensal/actions";
import { currentYearMonthFromPath } from "@/app/(app)/mensal/current-month";
import { VoiceRecorder } from "@/app/(app)/mensal/VoiceRecorder";
import { StatementImport } from "@/components/import/StatementImport";
import type { ParsedVoiceEntry } from "@/lib/entries/voice-expense-parser";

type Mode = "choice" | "type" | "voice" | "import";

/**
 * Ponto de entrada ÚNICO de registro no app (item 1 da Rodada 2). Aberto só pelo "+" central da
 * tab bar (mobile) ou pelo botão "Registrar" da sidebar (desktop), nenhum botão solto nas telas.
 * O microfone vive aqui dentro: só aparece depois que a pessoa escolhe "Gravar áudio".
 */
export function RegistrarDrawer({
  open,
  onClose,
  openFinance,
}: {
  open: boolean;
  onClose: () => void;
  /** Open Finance ligado no servidor (chaves da Pluggy); sem isso, a opção "Conectar meu banco" não aparece. */
  openFinance: boolean;
}) {
  const pathname = usePathname();
  const [mode, setMode] = useState<Mode>("choice");
  const [parsed, setParsed] = useState<ParsedVoiceEntry | null>(null);
  const [recentSubcategories, setRecentSubcategories] = useState<Partial<Record<ParentCategory, string[]>>>({});
  const [customCategories, setCustomCategories] = useState<{ id: string; name: string }[]>([]);
  const [goals, setGoals] = useState<{ id: string; name: string }[]>([]);
  const { year, month } = currentYearMonthFromPath(pathname);

  // Carrega chips de categoria uma vez ao abrir; reseta o fluxo pro início ao fechar.
  useEffect(() => {
    if (open) {
      getRecentSubcategoriesAction().then(setRecentSubcategories);
      getCustomCategoriesAction().then(setCustomCategories);
      getGoalsAction().then(setGoals);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset ao fechar, não sincronização
      setMode("choice");
      setParsed(null);
    }
  }, [open]);

  const title =
    mode === "choice"
      ? "Registrar"
      : mode === "voice"
        ? "Falar lançamento"
        : mode === "import"
          ? "Importar extrato"
          : "Novo lançamento";

  return (
    <Modal open={open} onClose={onClose} title={title}>
      {mode !== "choice" && (
        <button
          type="button"
          onClick={() => {
            setMode("choice");
            setParsed(null);
          }}
          className="mb-4 -mt-1 flex items-center gap-1 text-sm text-ink-muted transition-colors hover:text-ink"
        >
          <ChevronLeft size={16} />
          Voltar
        </button>
      )}

      {mode === "choice" && (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setMode("type")}
            className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-6 text-center transition-all hover:border-border-strong hover:bg-surface-hover active:scale-95"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-canvas">
              <Keyboard size={22} strokeWidth={1.75} />
            </span>
            <span className="text-sm font-medium text-ink">Digitar</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("voice")}
            className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-6 text-center transition-all hover:border-border-strong hover:bg-surface-hover active:scale-95"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-on-accent">
              <Mic size={22} strokeWidth={1.75} />
            </span>
            <span className="text-sm font-medium text-ink">Gravar áudio</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("import")}
            className="col-span-2 flex items-center justify-center gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-4 text-center transition-all hover:border-border-strong hover:bg-surface-hover active:scale-95"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-canvas">
              <FileUp size={20} strokeWidth={1.75} />
            </span>
            <span className="text-sm font-medium text-ink">Importar extrato ou fatura (PDF, Excel, CSV, OFX)</span>
          </button>
          {openFinance && (
          <Link
            href="/configuracoes/conexoes"
            onClick={onClose}
            className="col-span-2 flex items-center gap-3 rounded-2xl border border-accent/50 bg-accent-soft/40 px-4 py-4 text-left transition-all hover:border-accent active:scale-95"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
              <Landmark size={20} strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ink">Conectar meu banco</span>
              <span className="block text-caption text-ink-muted">Open Finance · os lançamentos chegam sozinhos, todo dia</span>
            </span>
            <span className="shrink-0 rounded-full border border-accent/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-strong">beta</span>
          </Link>
          )}
        </div>
      )}

      {mode === "import" && <StatementImport onDone={onClose} />}

      {mode === "voice" && (
        <VoiceRecorder
          onParsed={(result) => {
            setParsed(result);
            setMode("type");
          }}
        />
      )}

      {mode === "type" && (
        <EntryForm
          year={year}
          month={month}
          recentSubcategories={recentSubcategories}
          customCategories={customCategories}
          goals={goals}
          layout="stacked"
          onSuccess={onClose}
          defaultDescription={parsed && voiceSubcategory(parsed) ? undefined : parsed?.description}
          defaultSubcategory={parsed ? voiceSubcategory(parsed) : undefined}
          defaultAmount={parsed?.amount ?? undefined}
          defaultCurrency={parsed?.currency ?? undefined}
          defaultCategory={parsed?.category}
          defaultParentCategory={parsed?.parentCategory ?? undefined}
        />
      )}
    </Modal>
  );
}

/**
 * O parser de voz devolve a palavra-chave ("Farmácia", "Salário") como descrição. Quando ela
 * é um dos tipos conhecidos, vira o chip de Tipo, e a descrição fica livre pro que a pessoa
 * quiser dizer a mais.
 */
function voiceSubcategory(parsed: ParsedVoiceEntry): string | undefined {
  const label = parsed.description.trim();
  if (!label) return undefined;
  const pool = parsed.category === "INCOME" ? INCOME_TYPES : parsed.parentCategory ? SUBCATEGORIES[parsed.parentCategory] : [];
  const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return pool.find((t) => norm(t) === norm(label) || norm(t).startsWith(norm(label)));
}
