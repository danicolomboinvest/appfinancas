"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Explica } from "@/components/ui/Explica";
import { useMoney } from "@/components/money/MoneyProvider";
import type { SituacaoDoMes } from "@/lib/metas/projecao";
import { EditarGuardado, type GuardadoDoSonho } from "./GuardadosDoSonho";
import { valorDoLancamento } from "../visual";

export type MesDaMeta = { chave: string; curto: string; nome: string; situacao: SituacaoDoMes; total: number; aportes: (GuardadoDoSonho & { linha: string })[] };

/**
 * "Mês a mês" (protótipo, rodada 12): uma bolinha por mês, cheia quando juntou o combinado, meia
 * quando juntou parte, vazia quando não juntou; o mês de agora tem o contorno. Tocar num mês mostra
 * de onde veio, e cada registro pode ser corrigido ali (o "O que você guardou" de antes).
 */
export function MesAMes({ meses }: { meses: MesDaMeta[] }) {
  const money = useMoney();
  const [sel, setSel] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const mes = meses.find((m) => m.chave === sel) ?? null;

  return (
    <section className="glass flex flex-col gap-3 rounded-3xl p-4">
      <div className="flex items-center justify-between gap-3">
        <b className="text-base font-semibold text-ink">Mês a mês</b>
        <Explica>Cheia: juntou o combinado. Meia: juntou parte. Vazia: não juntou. O contorno é o mês de agora. Toque num mês para ver de onde veio.</Explica>
      </div>
      <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${Math.max(meses.length, 6)}, minmax(0, 1fr))` }}>
        {meses.map((m) => (
          <button
            key={m.chave}
            type="button"
            aria-pressed={sel === m.chave}
            aria-label={`${m.nome}: ${m.total ? money(m.total, { round: true }) : "nada"}`}
            onClick={() => {
              setSel(sel === m.chave ? null : m.chave);
              setAberto(null);
            }}
            className="flex min-h-11 flex-col items-center justify-center gap-1"
          >
            <i className={`block size-4 rounded-full md-b-${m.situacao} ${sel === m.chave ? "outline outline-2 outline-offset-2 outline-ink" : ""}`} />
            <small className="text-xs font-medium text-ink-muted">{m.curto}</small>
          </button>
        ))}
      </div>
      {mes && (
        <div aria-live="polite" className="flex flex-col gap-1.5">
          <p className="text-sm text-ink">
            <b className="font-semibold">{mes.nome.charAt(0).toUpperCase() + mes.nome.slice(1)}</b>: {mes.aportes.length === 0 ? "nada guardado" : mes.aportes.map((a) => a.linha).join("; ")}
          </p>
          {mes.aportes.length > 0 && (
            <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border">
              {mes.aportes.map((a) =>
                aberto === a.id ? (
                  <li key={a.id} className="bg-surface-2 p-3">
                    <EditarGuardado item={a} onFechar={() => setAberto(null)} />
                  </li>
                ) : (
                  <li key={a.id}>
                    <button type="button" onClick={() => setAberto(a.id)} className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-surface-2">
                      <span className="min-w-0 flex-1 truncate text-ink-muted">{a.description ?? "Aporte"}</span>
                      <span className={`shrink-0 font-semibold tabular-nums ${a.amount < 0 ? "text-danger" : "text-ink"}`}>{valorDoLancamento(money, a.amount)}</span>
                      <span className="shrink-0 text-caption text-ink-faint">Corrigir</span>
                      <ChevronRight size={14} className="shrink-0 text-ink-faint" aria-hidden />
                    </button>
                  </li>
                ),
              )}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
