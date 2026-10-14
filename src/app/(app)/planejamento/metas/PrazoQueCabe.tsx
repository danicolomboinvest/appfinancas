"use client";

import { useState } from "react";
import { CalendarCheck } from "lucide-react";
import { CampoDeDinheiro } from "@/components/ui/CampoDeDinheiro";
import { useCurrency, useMoney } from "@/components/money/MoneyProvider";
import { currencySymbol } from "@/lib/money";
import { motivoDoAperto, prazoQueCabe, type LimiteDasMetas } from "@/lib/metas/prazo-que-cabe";

/**
 * O aviso do prazo apertado (14/10/2026), no passo "Para quando?" da folha da meta: o valor por
 * mês passou do que cabe (ver lib/metas/prazo-que-cabe). Diz quanto é, em que ano chega com o
 * que cabe, e deixa ela trocar o valor por mês. "Usar esse prazo" só preenche o prazo na folha:
 * nada é salvo até ela tocar em Salvar.
 */
export function PrazoQueCabe({
  porMes,
  limite,
  alvo,
  guardado,
  taxaAnual,
  hoje,
  onUsar,
}: {
  porMes: number;
  limite: LimiteDasMetas;
  alvo: number;
  guardado: number;
  taxaAnual: number;
  hoje: Date;
  onUsar: (ano: number, mes: number) => void;
}) {
  const money = useMoney();
  const simbolo = currencySymbol(useCurrency());
  const m = (v: number) => money(v, { round: true });
  const [valor, setValor] = useState<number | null>(limite.porMes);
  const sugestao = valor && valor > 0 ? prazoQueCabe({ alvo, guardado, porMes: valor, taxaAnual, hoje }) : null;

  return (
    <div className="flex flex-col gap-3 rounded-[20px] border border-border bg-surface p-4 shadow-premium-sm" data-prazo-que-cabe>
      <p className="text-[15px] font-medium leading-snug text-ink">
        São <b className="whitespace-nowrap font-semibold">{m(porMes)}</b> por mês, {motivoDoAperto(porMes, limite)}.
      </p>
      {valor && valor > 0 ? (
        <p aria-live="polite" className="flex items-start gap-2 text-[15px] leading-snug text-ink">
          <CalendarCheck size={18} className="mt-0.5 shrink-0 text-accent-strong" aria-hidden />
          <span>
            Com <b className="whitespace-nowrap font-semibold">{m(valor)}</b> por mês,{" "}
            {sugestao ? (
              <>
                chega em <b className="font-semibold text-accent-strong">{sugestao.ano}</b>.
              </>
            ) : (
              "não chega até 2080."
            )}
          </span>
        </p>
      ) : null}
      <label className="flex min-h-12 flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl bg-surface-2 px-3.5 py-2 text-[15px] text-ink">
        <span className="text-ink-muted">Guardar</span>
        <span className="flex items-baseline gap-1">
          <span className="text-ink-muted">{simbolo}</span>
          <CampoDeDinheiro
            aria-label="Quanto guardar por mês"
            placeholder="0,00"
            valor={valor}
            onValor={setValor}
            className="w-[8.5ch] border-b border-border-strong bg-transparent text-center text-[17px] font-semibold tabular-nums text-ink outline-none focus:border-accent"
          />
        </span>
        <span className="text-ink-muted">por mês</span>
      </label>
      {sugestao && (
        <button
          type="button"
          onClick={() => onUsar(sugestao.ano, sugestao.mes)}
          className="flex min-h-12 w-full items-center justify-center rounded-full bg-accent px-5 text-[16px] font-semibold text-on-accent"
        >
          Usar esse prazo
        </button>
      )}
    </div>
  );
}
