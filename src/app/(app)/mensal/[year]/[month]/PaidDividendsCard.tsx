"use client";

import { useState, useTransition } from "react";
import { Coins } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useMoney } from "@/components/money/MoneyProvider";
import { useToast } from "@/components/ui/toast-context";
import { registerDividendIncomeAction } from "./actions";

export type PaidDividendItem = { ticker: string; kind: string; paymentDate: string; dateLabel: string; amount: number };

/** "Caiu na conta": proventos pagos nos últimos dias que ainda não viraram renda no mês. */
export function PaidDividendsCard({
  items,
  titulo = "Caiu na conta",
  sub = "Proventos dos seus ativos pagos nos últimos dias. Um toque lança como renda no dia do pagamento.",
}: {
  items: PaidDividendItem[];
  titulo?: string;
  sub?: string;
}) {
  const money = useMoney();
  const { showToast } = useToast();
  const [done, setDone] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const visible = items.filter((d) => !done.has(`${d.ticker}|${d.paymentDate}`));
  if (visible.length === 0) return null;

  return (
    <Card className="flex flex-col gap-3 border-success/30 bg-success-soft/30 p-4">
      <div className="flex items-center gap-2">
        <Coins size={16} className="text-success" />
        <p className="text-[15px] font-semibold text-ink">{titulo}</p>
      </div>
      <p className="text-caption text-ink-muted">{sub}</p>
      <ul className="flex flex-col divide-y divide-border">
        {visible.map((d) => (
          <li key={`${d.ticker}|${d.paymentDate}`} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">
                {d.ticker} <span className="font-normal text-ink-muted">· {d.kind}</span>
              </p>
              <p className="text-caption text-ink-faint">{d.dateLabel} · {money(d.amount)}</p>
            </div>
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const res = await registerDividendIncomeAction({ ticker: d.ticker, kind: d.kind, paymentDate: d.paymentDate, amount: d.amount });
                  if (!res.ok) {
                    showToast("Não consegui lançar. Tente de novo.");
                    return;
                  }
                  setDone((prev) => new Set(prev).add(`${d.ticker}|${d.paymentDate}`));
                  showToast(`${money(d.amount)} de ${d.ticker} lançado como renda.`);
                })
              }
              className="shrink-0 rounded-full border border-success bg-success-soft px-3 py-1.5 text-xs font-semibold text-success disabled:opacity-50"
            >
              Lançar como renda
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
