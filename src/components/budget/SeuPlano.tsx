"use client";

import { useState } from "react";
import { useMoney } from "@/components/money/MoneyProvider";
import { Explica } from "@/components/ui/Explica";
import { corDoPlano } from "@/lib/planning/cores-do-plano";

type Item = { key: string; label: string; cor: string; planejado: number; gasto: number };

/** O anelzinho do quanto do plano já foi (protótipo, face "Feito"). */
function Anel({ uso, passou }: { uso: number; passou: boolean }) {
  const C = 34.56;
  const f = Math.max(0, Math.min(1, uso));
  return (
    <svg viewBox="0 0 14 14" className="size-3.5 shrink-0 -rotate-90" aria-hidden>
      <circle cx="7" cy="7" r="5.5" fill="none" stroke="var(--color-border-strong)" strokeWidth="2" />
      {f > 0 && <circle cx="7" cy="7" r="5.5" fill="none" stroke={passou ? "var(--color-danger)" : "var(--color-ink)"} strokeWidth="2" strokeDasharray={`${(f * C).toFixed(2)} ${C}`} strokeLinecap="round" />}
    </svg>
  );
}

/**
 * "Seu plano" (protótipo aprovado): o plano do mês numa barra só, dividida por categoria, nas
 * cores da família do tema (do maior plano para o menor). A face "O que você fez" mostra o gasto
 * contra o plano: a barra vai só até o que saiu (o resto cinza) e cada categoria ganha um anel com
 * o quanto do plano já foi, em vermelho quando passou.
 */
export function SeuPlano({ itens, meses = 1 }: { itens: Item[]; /** Período de vários meses: "em 3 meses" (protótipo). */ meses?: number }) {
  const money = useMoney();
  const m = (v: number) => money(v, { round: true });
  const [modo, setModo] = useState<"plano" | "feito">("plano");
  if (itens.every((i) => i.planejado <= 0)) return null;
  const ordem = itens.filter((i) => i.planejado > 0).sort((a, b) => b.planejado - a.planejado);
  const cor = (k: number) => corDoPlano(k);
  const plano = ordem.reduce((s, i) => s + i.planejado, 0);
  const gasto = ordem.reduce((s, i) => s + Math.max(0, i.gasto), 0);
  const escala = modo === "plano" ? plano : Math.max(plano, gasto);

  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-4" data-seu-plano={modo}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[17px] font-medium text-ink">{modo === "plano" ? "Seu plano" : "O que você fez"}</h2>
        <div className="flex items-center gap-1.5">
          <div className="flex rounded-full bg-surface-2 p-0.5" role="group" aria-label="Plano ou feito">
            {(["plano", "feito"] as const).map((x) => (
              <button key={x} type="button" aria-pressed={modo === x} onClick={() => setModo(x)} className={`min-h-8 rounded-full px-3 text-sm ${modo === x ? "bg-pill text-on-pill shadow-[inset_0_0_0_1px_var(--color-border-strong)]" : "text-ink-muted"}`}>
                {x === "plano" ? "Plano" : "Feito"}
              </button>
            ))}
          </div>
          <Explica>Plano é como você dividiu o mês. Feito é o que já saiu de cada categoria; o anel é quanto do plano dela já foi.</Explica>
        </div>
      </div>
      <p className="text-sm text-ink-muted">
        {modo === "plano" ? (
          <>
            <span className="text-ink">{m(plano)}</span> {meses > 1 ? `em ${meses} meses` : "por mês"}
          </>
        ) : (
          <>
            <span className="text-ink">{m(gasto)}</span> de {m(plano)}
          </>
        )}
      </p>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-surface-2">
        {ordem.map((i, k) => {
          const v = modo === "plano" ? i.planejado : Math.max(0, i.gasto);
          return v > 0 ? <span key={i.key} className="h-full" style={{ width: `${(v / Math.max(1, escala)) * 100}%`, background: cor(k) }} /> : null;
        })}
      </div>
      <ul className="grid grid-cols-2 gap-x-5 gap-y-1.5 text-sm max-[359px]:grid-cols-1">
        {ordem.map((i, k) => {
          const uso = i.planejado > 0 ? i.gasto / i.planejado : 0;
          const passou = uso > 1.005;
          return (
            <li key={i.key} className="flex min-w-0 items-center gap-2">
              <span className="size-2 shrink-0 rounded-full" style={{ background: cor(k) }} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-ink">{i.label}</span>
              {modo === "plano" ? (
                <span className="shrink-0 tabular-nums text-ink-muted">{Math.round((i.planejado / Math.max(1, plano)) * 100)}%</span>
              ) : (
                <span className={`flex shrink-0 items-center gap-1 tabular-nums ${passou ? "text-danger" : "text-ink-muted"}`} aria-label={`${Math.round(uso * 100)}% do plano`}>
                  <Anel uso={uso} passou={passou} />
                  {passou ? "↑" : ""}
                  {Math.round(uso * 100)}%
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
