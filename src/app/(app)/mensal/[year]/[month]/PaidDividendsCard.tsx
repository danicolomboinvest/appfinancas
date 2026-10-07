"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Coins } from "lucide-react";
import { useMoney } from "@/components/money/MoneyProvider";
import { useToast } from "@/components/ui/toast-context";
import { registerDividendIncomeAction } from "./actions";

/** `id` é o do provento (DividendEvent): JSCP e Dividendos do mesmo ativo no mesmo dia são dois itens. */
export type PaidDividendItem = { id: string; ticker: string; kind: string; paymentDate: string; dateLabel: string; amount: number };

/**
 * "Caiu na conta": proventos pagos nos últimos dias que ainda não viraram renda no mês.
 *
 * Uma linha só (07/10/2026, "mesma cara, menos texto"): quantos pagamentos, o total e UM botão que
 * lança todos. Antes eram uma explicação e uma linha com botão para cada provento; a lista, com o
 * botão de cada um, continua a um toque, para quem quer lançar só alguns.
 */
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
  const { showToast, showError } = useToast();
  const [done, setDone] = useState<Set<string>>(new Set());
  const [aberto, setAberto] = useState(false);
  const [isPending, startTransition] = useTransition();
  // Pelo id, não por ativo + dia: lançar o JSCP não pode esconder os Dividendos pagos junto.
  const visible = items.filter((d) => !done.has(d.id));
  if (visible.length === 0) return null;
  const total = visible.reduce((s, d) => s + d.amount, 0);

  function lancar(lista: PaidDividendItem[]) {
    startTransition(async () => {
      const feitos: string[] = [];
      // Um por vez: cada um vira um lançamento no dia do pagamento, e um erro no meio não pode
      // apagar da tela os que já entraram.
      for (const d of lista) {
        const res = await registerDividendIncomeAction({ eventId: d.id });
        if (!res.ok) break;
        feitos.push(d.id);
      }
      if (feitos.length > 0) setDone((prev) => new Set([...prev, ...feitos]));
      if (feitos.length < lista.length) return showError("Não consegui lançar. Tente de novo.");
      const soma = lista.reduce((s, d) => s + d.amount, 0);
      showToast(lista.length === 1 ? `${money(soma)} de ${lista[0].ticker} lançado como renda.` : `${money(soma)} lançados como renda.`);
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-surface px-3.5 py-2.5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          className="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success">
            <Coins size={18} aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold text-ink">{titulo}</span>
            <span className="flex items-center gap-1 text-caption tabular-nums text-ink-muted">
              {visible.length === 1 ? "1 pagamento" : `${visible.length} pagamentos`}, {money(total)}
              <ChevronDown size={14} className={`shrink-0 transition-transform ${aberto ? "rotate-180" : ""}`} aria-hidden />
            </span>
          </span>
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => lancar(visible)}
          className="min-h-10 shrink-0 rounded-full bg-success-soft px-4 text-sm font-semibold text-success disabled:opacity-50"
        >
          {isPending ? "Lançando…" : "Lançar"}
        </button>
      </div>

      {aberto && (
        <div className="mt-1 border-t border-border pt-2">
          <p className="pb-1 text-caption text-ink-faint">{sub}</p>
          <ul className="flex flex-col divide-y divide-border">
            {visible.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">
                    {d.ticker} <span className="font-normal text-ink-muted">{d.kind}</span>
                  </p>
                  <p className="text-caption tabular-nums text-ink-faint">
                    {d.dateLabel}, {money(d.amount)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => lancar([d])}
                  className="shrink-0 rounded-full border border-success/40 px-3 py-1.5 text-xs font-semibold text-success disabled:opacity-50"
                >
                  Lançar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
