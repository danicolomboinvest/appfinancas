"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { ComoTirarExtrato } from "@/components/import/ComoTirarExtrato";
import { DIA_ZERO_ITENS } from "@/lib/money-reset/missoes";
import { comecarResetAction } from "./actions";

/**
 * Dia 0: uma tarefa só, separar 3 coisas. Sem a trilha dos 21 dias embaixo: na revisão a Dani
 * sentiu a primeira tela como "muita informação, dá sensação de perdido".
 */
export function Dia0() {
  const { voz } = useProfileTheme();
  const t = voz.titulos;
  const router = useRouter();
  const [separado, setSeparado] = useState(() => DIA_ZERO_ITENS.map(() => false));
  const [salvando, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2 pt-2 text-center">
        <span className="flex size-20 items-center justify-center rounded-3xl bg-accent-soft text-4xl" aria-hidden>
          🗝️
        </span>
        <h1 className="text-h2 font-bold tracking-tight text-ink">{t.mrBoas}</h1>
        <p className="max-w-xs text-sm text-ink-muted">{t.mrBoasSub}</p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="px-1 text-caption font-semibold uppercase tracking-[0.11em] text-ink-muted">{t.mrSepare}</p>
        {DIA_ZERO_ITENS.map((item, i) => (
          <button
            key={item.t}
            type="button"
            aria-pressed={separado[i]}
            onClick={() => setSeparado((s) => s.map((x, j) => (j === i ? !x : x)))}
            className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left ${separado[i] ? "border-success/50 bg-success/10" : "border-border bg-surface"}`}
          >
            <span className="text-xl" aria-hidden>
              {item.ic}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink">{item.t}</span>
              <span className="block text-caption text-ink-muted">{item.sub}</span>
            </span>
            <span className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${separado[i] ? "border-success bg-success text-white" : "border-border-strong"}`}>
              {separado[i] && <Check size={14} strokeWidth={3} />}
            </span>
          </button>
        ))}
      </div>

      <ComoTirarExtrato />

      <button
        type="button"
        disabled={salvando}
        onClick={() =>
          startTransition(async () => {
            await comecarResetAction(separado);
            router.refresh();
          })
        }
        className="inline-flex min-h-12 items-center justify-center rounded-full bg-accent-gradient px-5 text-sm font-semibold text-on-accent shadow-premium-sm disabled:opacity-50"
      >
        {t.mrSepareiTudo}
      </button>
    </div>
  );
}
