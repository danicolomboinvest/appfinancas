"use client";

import { Sprout } from "lucide-react";
import { useMoney } from "@/components/money/MoneyProvider";

/**
 * O placar do Money Reset (proposta A+B, vindo do caminho B): "Achei até agora R$ X por mês", no
 * alto do mapa e das missões. Só número dela (o que decidiu cortar no Raio-X e o que baixou na
 * conta negociada); sem nada decidido, é R$ 0 e diz que cresce a cada marco. Pula quando cresce.
 */
export function Placar({ porMes }: { porMes: number }) {
  const money = useMoney();
  const m = (v: number) => money(v, { round: true });
  return (
    <div key={Math.round(porMes)} className="mr-pula flex items-center justify-between gap-3 rounded-2xl bg-success-soft px-4 py-2.5" aria-live="polite">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface text-success" aria-hidden>
          <Sprout size={16} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <small className="block text-[12px] font-semibold text-ink-muted">Achei até agora</small>
          <b className="block whitespace-nowrap text-[19px] font-bold tabular-nums leading-tight tracking-tight text-ink">{m(porMes)} por mês</b>
        </div>
      </div>
      <span className="shrink-0 text-right text-[12px] font-semibold leading-tight text-success">
        {porMes > 0 ? (
          <>
            {m(porMes * 12)}
            <br />
            no ano
          </>
        ) : (
          <>
            cresce a cada
            <br />
            marco
          </>
        )}
      </span>
    </div>
  );
}
