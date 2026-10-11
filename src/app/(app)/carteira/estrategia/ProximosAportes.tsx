"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import type { StrategyAssetClass } from "@prisma/client";
import { useCurrency, useMoney } from "@/components/money/MoneyProvider";
import { currencySymbol } from "@/lib/money";
import { STRATEGY_ASSET_CLASS_COLOR } from "@/lib/portfolio/strategy";
import { dividirProximoAporte } from "@/lib/portfolio/proximos-aportes";
import type { ClassGap } from "@/lib/portfolio/contribution-plan";
import { NOME_DA_LINHA } from "./nomes";

export type DadosDosProximosAportes = {
  valor: number | null;
  origem: "plano" | "media" | null;
  posicoes: ClassGap[];
  mesesDeReserva: number | null;
  reservaCompleta: boolean;
  semReserva: boolean;
};

/**
 * "Seus próximos aportes" (pedido da Dani, 11/10/2026), logo abaixo do gráfico da estratégia: o
 * que fazer com o próximo dinheiro, por classe, com a barra "hoje → depois do aporte" na cor da
 * classe e o tracinho do alvo. Reserva primeiro. Nunca manda vender. "Já aportei" leva para
 * registrar o aporte nos ativos (a folha Aportes de Meus ativos).
 */
export function ProximosAportes({ dados }: { dados: DadosDosProximosAportes }) {
  const money = useMoney();
  const moeda = currencySymbol(useCurrency());
  const [digitado, setDigitado] = useState("");
  const valor = dados.valor ?? (Number(digitado.replace(/\D/g, "")) || 0);
  const d = useMemo(
    () => dividirProximoAporte({ valor, posicoes: dados.posicoes, mesesDeReserva: dados.mesesDeReserva, reservaCompleta: dados.reservaCompleta, semReserva: dados.semReserva, nomes: NOME_DA_LINHA }),
    [valor, dados],
  );
  const escala = (f: number) => `${Math.min(100, f * 200)}%`;

  return (
    <section className="glass flex flex-col gap-3.5 rounded-3xl p-4" aria-label="Seus próximos aportes">
      <div>
        <h2 className="text-[17px] font-medium text-ink">Seus próximos aportes</h2>
        {dados.valor !== null ? (
          <p className="text-[14px] text-ink">
            <span className="font-medium tabular-nums">{money(dados.valor, { round: true })}</span> por mês, {dados.origem === "plano" ? "do seu plano" : "a média dos últimos 3 meses"}
          </p>
        ) : (
          <label className="mt-2 flex flex-col gap-1.5">
            <span className="text-[14px] text-ink">Quanto você vai aportar?</span>
            <span className="flex items-baseline gap-2 rounded-2xl bg-surface-2 px-3.5 py-2">
              <span className="text-[14px] text-ink">{moeda}</span>
              <input inputMode="numeric" value={digitado} onChange={(e) => setDigitado(e.target.value)} placeholder="0" aria-label="Quanto você vai aportar" className="min-w-0 flex-1 bg-transparent text-[22px] font-light tabular-nums text-ink outline-none" />
            </span>
          </label>
        )}
      </div>

      {valor > 0 && (
        <ul className="flex flex-col gap-3">
          {d.reserva > 0 && (
            <li className="flex flex-col gap-1.5">
              <span className="flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-2 text-[15px] text-ink">
                  <i className="size-2.5 shrink-0 rounded-full" style={{ background: "var(--color-dinheiro-guardou)" }} />
                  Reserva de emergência
                </span>
                <span className="shrink-0 text-[15px] font-medium tabular-nums text-ink">{money(d.reserva, { round: true })}</span>
              </span>
            </li>
          )}
          {d.classes.map((c) => (
            <li key={c.classe} className="flex flex-col gap-1.5">
              <span className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-[15px] text-ink">
                  <i className="size-2.5 shrink-0 rounded-full" style={{ background: STRATEGY_ASSET_CLASS_COLOR[c.classe as StrategyAssetClass] }} />
                  <span className="truncate">{NOME_DA_LINHA[c.classe]}</span>
                </span>
                <span className="shrink-0 text-[15px] font-medium tabular-nums text-ink">{money(c.valor, { round: true })}</span>
              </span>
              <span className="relative h-1.5 rounded-full bg-surface-2" aria-label={`Hoje ${Math.round(c.hoje * 100)}%, depois ${Math.round(c.depois * 100)}%, alvo ${Math.round(c.alvo * 100)}%`} role="img">
                <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: escala(Math.max(c.hoje, c.depois)), background: STRATEGY_ASSET_CLASS_COLOR[c.classe], opacity: 0.35 }} />
                <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: escala(c.hoje), background: STRATEGY_ASSET_CLASS_COLOR[c.classe] }} />
                <span className="absolute -top-1 h-3.5 w-0.5 rounded-full bg-ink" style={{ left: escala(c.alvo) }} />
              </span>
              <span className="text-[12.5px] tabular-nums text-ink">
                {Math.round(c.hoje * 100)}% → {Math.round(c.depois * 100)}% · alvo {Math.round(c.alvo * 100)}%
              </span>
            </li>
          ))}
        </ul>
      )}

      {valor > 0 && <p className="text-[14px] text-ink">{d.porque}</p>}

      {valor > 0 && (
        <Link href="/carteira?aportes=1" className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-full bg-accent-gradient text-[15px] font-medium text-on-accent">
          <Check size={16} /> Já aportei
        </Link>
      )}
      <p className="text-[12px] text-ink">Segue a estratégia que você escolheu. Não é recomendação de investimento.</p>
    </section>
  );
}
