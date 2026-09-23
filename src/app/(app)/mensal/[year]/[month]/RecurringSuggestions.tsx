"use client";

import { useEffect, useState, useTransition } from "react";
import { Repeat } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useMoney } from "@/components/money/MoneyProvider";
import { useToast } from "@/components/ui/toast-context";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import type { RecurringCandidate } from "@/lib/entries/recurrence";
import { createFromRecurringAction } from "./actions";

const DISMISS_KEY = "spi.recurring.dismissed";

/**
 * "Parece que se repete": o que apareceu nos meses anteriores e ainda não está neste mês.
 * Um toque lança; "todo mês" lança até dezembro. Dispensar some só neste aparelho.
 */
export function RecurringSuggestions({ candidates, year, month }: { candidates: RecurringCandidate[]; year: number; month: number }) {
  const money = useMoney();
  const { showToast } = useToast();
  // O convite e os botões vêm da voz do tema; o que se repete continua vindo do servidor.
  const { voz } = useProfileTheme();
  const t = voz.titulos;
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DISMISS_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura única do localStorage, sem loop
      if (raw) setHidden(new Set(JSON.parse(raw) as string[]));
    } catch {
      // sem storage: mostra tudo
    }
    setLoaded(true);
  }, []);

  const visible = candidates.filter((c) => !hidden.has(c.key));
  if (!loaded || visible.length === 0) return null;

  function hide(key: string) {
    setHidden((prev) => {
      const next = new Set(prev).add(key);
      try {
        window.localStorage.setItem(DISMISS_KEY, JSON.stringify([...next]));
      } catch {
        // ignora
      }
      return next;
    });
  }

  function launch(c: RecurringCandidate, repeat: boolean) {
    startTransition(async () => {
      const res = await createFromRecurringAction(
        {
          category: c.category,
          parentCategory: c.parentCategory,
          customCategoryId: c.customCategoryId,
          subcategory: c.subcategory,
          description: c.description,
          amount: c.amount,
          typicalDay: c.typicalDay,
        },
        year,
        month,
        repeat,
      );
      if (!res.ok) {
        showToast(t.impRepeteErro);
        return;
      }
      hide(c.key);
      showToast(repeat ? t.impRepeteLancadoAteDezembro : t.impRepeteLancado);
    });
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <Repeat size={16} className="text-accent-strong" />
        <p className="text-[15px] font-semibold text-ink">{t.impRepeteTitulo}</p>
      </div>
      <p className="text-caption text-ink-muted">{t.impRepeteSub}</p>
      <ul className="flex flex-col divide-y divide-border">
        {visible.map((c) => (
          <li key={c.key} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{c.description || c.subcategory || t.impRepeteLancamento}</p>
              <p className="text-caption text-ink-faint">
                {money(c.amount, { round: true })}
                {c.typicalDay ? ` · ${t.impRepeteCostumaCair(c.typicalDay)}` : ""}
                {` · ${t.impRepeteVistoEm(c.seenInMonths)}`}
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button type="button" disabled={isPending} onClick={() => launch(c, false)} className="rounded-full border border-accent bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent-strong disabled:opacity-50">
                {t.impRepeteLancar}
              </button>
              <button type="button" disabled={isPending} onClick={() => launch(c, true)} className="rounded-full border border-border-strong bg-surface-2 px-3 py-1.5 text-xs font-semibold text-ink-muted hover:text-ink disabled:opacity-50">
                {t.impRepeteTodoMes}
              </button>
              <button type="button" onClick={() => hide(c.key)} aria-label="Dispensar" className="rounded-full px-2 text-xs text-ink-faint hover:text-ink">
                ×
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
