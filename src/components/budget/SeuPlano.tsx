"use client";

import { useState } from "react";
import { useMoney } from "@/components/money/MoneyProvider";
import { Explica } from "@/components/ui/Explica";

/**
 * "Seu plano" (protótipo aprovado): o plano do mês numa barra só, dividida por categoria, com a
 * porcentagem de cada uma. "Feito" mostra a mesma barra com o que já foi gasto.
 */
export function SeuPlano({ itens }: { itens: { key: string; label: string; cor: string; planejado: number; gasto: number }[] }) {
  const money = useMoney();
  const [modo, setModo] = useState<"plano" | "feito">("plano");
  const valor = (i: (typeof itens)[number]) => (modo === "plano" ? i.planejado : i.gasto);
  const visiveis = itens.filter((i) => valor(i) > 0).sort((a, b) => valor(b) - valor(a));
  const total = visiveis.reduce((s, i) => s + valor(i), 0);
  if (itens.every((i) => i.planejado <= 0)) return null;
  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="titulo-tema text-[17px] font-medium text-ink">Seu plano</h2>
        <div className="flex items-center gap-1.5">
          <div className="flex rounded-full bg-surface-2 p-0.5" role="group" aria-label="Plano ou feito">
            {(["plano", "feito"] as const).map((x) => (
              <button key={x} type="button" aria-pressed={modo === x} onClick={() => setModo(x)} className={`min-h-8 rounded-full px-3 text-sm ${modo === x ? "bg-pill text-on-pill shadow-[inset_0_0_0_1px_var(--color-border-strong)]" : "text-ink-muted"}`}>
                {x === "plano" ? "Plano" : "Feito"}
              </button>
            ))}
          </div>
          <Explica>Plano é como você dividiu o mês. Feito é o que já saiu de cada categoria.</Explica>
        </div>
      </div>
      <p className="text-sm text-ink-muted">
        <span className="text-ink">{money(total, { round: true })}</span> {modo === "plano" ? "por mês" : "até agora"}
      </p>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {visiveis.map((i) => (
          <span key={i.key} className="h-full" style={{ width: `${(valor(i) / Math.max(1, total)) * 100}%`, background: i.cor }} />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-5 gap-y-1.5 text-sm">
        {visiveis.map((i) => (
          <li key={i.key} className="flex min-w-0 items-center gap-2">
            <span className="size-2 shrink-0 rounded-full" style={{ background: i.cor }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-ink">{i.label}</span>
            <span className="shrink-0 tabular-nums text-ink-muted">{Math.round((valor(i) / Math.max(1, total)) * 100)}%</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
