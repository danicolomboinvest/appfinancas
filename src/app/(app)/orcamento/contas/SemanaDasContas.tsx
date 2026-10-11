"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMoney } from "@/components/money/MoneyProvider";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { semanaDasContas, type ContaDaSemana } from "@/lib/contas/semana-das-contas";

/** "Saem nesta semana": o total, a fita dos 7 dias com um ponto onde vence conta, e as setas. */
export function SemanaDasContas({ contas, hoje }: { contas: ContaDaSemana[]; hoje: string }) {
  const money = useMoney();
  const [semana, setSemana] = useState(0);
  const [diaAberto, setDiaAberto] = useState<string | null>(null);
  const s = semanaDasContas(contas, hoje, semana);
  const aberto = s.dias.find((d) => d.iso === diaAberto);
  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm text-ink-muted">{semana === 0 ? "Saem nesta semana" : "Saem nessa semana"}</h2>
        <div className="flex gap-1.5">
          <button type="button" aria-label="Semana anterior" disabled={semana === 0} onClick={() => { setSemana(semana - 1); setDiaAberto(null); }} className="flex size-9 items-center justify-center rounded-full border border-border text-ink disabled:opacity-35">
            <ChevronLeft size={16} aria-hidden />
          </button>
          <button type="button" aria-label="Próxima semana" disabled={semana >= 4} onClick={() => { setSemana(semana + 1); setDiaAberto(null); }} className="flex size-9 items-center justify-center rounded-full border border-border text-ink disabled:opacity-35">
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>
      </div>
      <p className="flex flex-wrap items-baseline gap-x-2 text-ink">
        <ValorDestaque texto={`${s.aproximado ? "~" : ""}${money(s.total)}`} className="text-[1.75rem] font-light tabular-nums" />
        <span className="text-sm text-ink-muted">{s.intervalo}</span>
      </p>
      <div className="grid grid-cols-7 gap-1">
        {s.dias.map((d) => {
          const on = d.iso === diaAberto;
          return (
            <button
              key={d.iso}
              type="button"
              onClick={() => setDiaAberto(on ? null : d.iso)}
              aria-pressed={on}
              aria-label={`${d.sigla} ${d.dia}: ${d.contas.length === 0 ? "nada vence" : d.contas.map((c) => c.nome).join(", ")}`}
              className={`flex min-w-0 flex-col items-center gap-0.5 rounded-2xl py-2 ${d.hoje ? "bg-ink text-canvas" : on ? "bg-surface-hover text-ink" : "bg-surface-2 text-ink"}`}
            >
              <span className="text-xs opacity-80">{d.sigla}</span>
              <span className="text-[17px] tabular-nums">{d.dia}</span>
              <span className={`size-1.5 rounded-full ${d.contas.length > 0 ? (d.hoje ? "bg-canvas" : "bg-[var(--color-dinheiro-gastou)]") : "bg-transparent"}`} aria-hidden />
            </button>
          );
        })}
      </div>
      {aberto && (
        <ul className="flex flex-col divide-y divide-border rounded-2xl bg-surface-2 px-3">
          {aberto.contas.length === 0 ? (
            <li className="py-2.5 text-sm text-ink-muted">Nada vence nesse dia.</li>
          ) : (
            aberto.contas.map((c) => (
              <li key={c.id} className="flex justify-between gap-3 py-2.5 text-sm">
                <span className="text-ink">{c.nome}</span>
                <span className="tabular-nums text-ink">{c.valor === null ? "varia" : money(c.valor)}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </section>
  );
}
