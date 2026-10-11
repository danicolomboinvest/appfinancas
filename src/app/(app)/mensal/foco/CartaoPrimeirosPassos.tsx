"use client";

import { useEffect, useTransition } from "react";
import Link from "next/link";
import { CalendarCheck, Check, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { trackEvent } from "@/lib/usage/track-event";
import { caminhoDoEvento, EVENTOS_DO_COMECO, PREMIO_DOS_PRIMEIROS_PASSOS, type PrimeiroPasso } from "@/lib/onboarding/comeco";
import { alternarPrimeiroPassoAction, fecharAhaAction, fecharPrimeirosPassosAction } from "./comeco-actions";

export type PassoNaTela = { chave: PrimeiroPasso; titulo: string; tempo: string; href: string; feito: boolean };

/**
 * "Primeiros passos" (versão nova): cinco itens, a barra que enche e o prêmio discreto. Marcam
 * sozinhos pelo que ela fez de verdade; o círculo deixa marcar à mão. Some quando ela fecha
 * depois dos cinco.
 */
export function CartaoPrimeirosPassos({ passos, feitos }: { passos: PassoNaTela[]; feitos: number }) {
  const [pendente, startTransition] = useTransition();
  const completo = feitos === passos.length;
  return (
    <Card className="flex flex-col gap-1.5 p-4" aria-busy={pendente}>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-ink">Primeiros passos</h2>
        <span className="text-[13.5px] font-semibold text-ink-muted">
          {feitos} de {passos.length}
        </span>
      </div>
      <div className="mb-1.5 mt-0.5 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={feitos} aria-valuemin={0} aria-valuemax={passos.length} aria-label="Primeiros passos feitos">
        <i className="block h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${(feitos / passos.length) * 100}%` }} />
      </div>
      {completo ? (
        <>
          <p className="flex items-start gap-2.5 text-[14.5px] font-medium leading-snug text-ink">
            <Check size={16} className="mt-0.5 shrink-0 text-success" aria-hidden />
            <span>{PREMIO_DOS_PRIMEIROS_PASSOS.depois}</span>
          </p>
          <button type="button" onClick={() => startTransition(() => fecharPrimeirosPassosAction())} className="mr-auto inline-flex min-h-11 items-center text-sm font-medium text-ink-muted underline decoration-border-strong underline-offset-4 hover:text-ink">
            Fechar
          </button>
        </>
      ) : (
        <>
          <ul className="flex flex-col">
            {passos.map((p) => (
              <li key={p.chave} className="grid min-h-[46px] grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-1">
                <button
                  type="button"
                  onClick={() => startTransition(() => alternarPrimeiroPassoAction(p.chave))}
                  aria-pressed={p.feito}
                  aria-label={`${p.feito ? "Desmarcar" : "Marcar"}: ${p.titulo}`}
                  className="-ml-2.5 flex size-11 items-center justify-center"
                >
                  <span className={`flex size-6 items-center justify-center rounded-full ${p.feito ? "bg-success text-canvas" : "shadow-[inset_0_0_0_1.5px_var(--color-border-strong)]"}`}>
                    {p.feito && <Check size={14} strokeWidth={2.5} aria-hidden />}
                  </span>
                </button>
                <Link href={p.href} className={`flex min-h-11 items-center text-[15px] font-medium ${p.feito ? "text-ink-muted line-through decoration-border-strong" : "text-ink"}`}>
                  {p.titulo}
                </Link>
                {!p.feito && p.tempo ? <small className="text-[12.5px] font-semibold text-accent-strong">{p.tempo}</small> : <span />}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 flex items-center gap-2 rounded-[14px] bg-surface-2 px-3 py-2.5 text-[13.5px] font-medium text-ink-muted">
            <CalendarCheck size={15} className="shrink-0" aria-hidden />
            {PREMIO_DOS_PRIMEIROS_PASSOS.antes}
          </p>
        </>
      )}
    </Card>
  );
}

/** O "Fechar" do aha. */
export function FecharAha() {
  const [pendente, startTransition] = useTransition();
  return (
    <button type="button" disabled={pendente} onClick={() => startTransition(() => fecharAhaAction())} className="inline-flex min-h-11 items-center gap-1 px-1 text-sm font-medium text-ink-muted hover:text-ink">
      <X size={15} aria-hidden />
      Fechar
    </button>
  );
}

/** A marca "viu o mês" do funil do começo: uma vez por aparelho, quando o aha do mês aparece. */
export function MarcaViuOMes() {
  useEffect(() => {
    try {
      if (window.localStorage.getItem("comeco-viu-mes") === "1") return;
      window.localStorage.setItem("comeco-viu-mes", "1");
    } catch {
      // Sem armazenamento: marca mesmo assim (no pior caso, duas marcas da mesma pessoa).
    }
    trackEvent(EVENTOS_DO_COMECO.viuMes, caminhoDoEvento(EVENTOS_DO_COMECO.viuMes));
  }, []);
  return null;
}
