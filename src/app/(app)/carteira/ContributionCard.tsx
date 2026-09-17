"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { CurrencyField } from "@/components/ui/CurrencyField";
import { useMoney } from "@/components/money/MoneyProvider";
import { planContribution } from "@/lib/portfolio/contribution-plan";
import { STRATEGY_ASSET_CLASS_COLOR } from "@/lib/portfolio/strategy";
import type { ContributionContext } from "@/lib/portfolio/contribution";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/**
 * "Qual é o seu aporte deste mês?": a pessoa diz o valor (vem preenchido do orçamento) e o card
 * SUGERE a divisão que leva a carteira pra mais perto da estratégia, apontando o ativo de cada
 * classe. Só sugestão: o app não registra o aporte por ela (um botão "Aportei assim" dava a
 * impressão de que registrava sozinho). O aporte real entra por Registrar, como sempre.
 */
export function ContributionCard({ context, month }: { context: ContributionContext; month: number }) {
  const money = useMoney();
  const [amount, setAmount] = useState(context.plannedAmount);

  const slices = useMemo(() => planContribution(context.classes, amount), [context.classes, amount]);
  const hasAssets = context.classes.some((c) => c.currentValue > 0);

  if (!context.hasStrategy) {
    return (
      <Card className="flex flex-col gap-2 border-accent/30 bg-accent-soft/30 p-4">
        <p className="text-[15px] font-semibold text-ink">Onde colocar o aporte deste mês?</p>
        <p className="text-sm leading-relaxed text-ink-muted">
          Com uma estratégia definida, o app diz quanto vai pra cada tipo de investimento pra sua carteira chegar no alvo.
          São três perguntas.
        </p>
        <Link href="/carteira/estrategia" className="w-fit text-sm font-medium text-accent-strong hover:underline">
          Definir minha estratégia →
        </Link>
      </Card>
    );
  }
  return (
    <Card className="flex flex-col gap-4 border-accent/30 bg-accent-soft/30 p-4">
      <div>
        <p className="text-[15px] font-semibold text-ink">Qual é o seu aporte de {MONTHS[month - 1]}?</p>
        <p className="text-caption text-ink-muted">Sugestão de aporte para rebalanceamento da carteira.</p>
      </div>

      <CurrencyField label="Vou aportar" name="_contribution" defaultValue={amount || undefined} onValueChange={setAmount} className="sm:w-48" />

      {amount > 0 && slices.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex h-3 overflow-hidden rounded-full bg-surface-2">
            {slices.map((s) => (
              <span key={s.assetClass} className="h-full" style={{ width: `${(s.amount / amount) * 100}%`, backgroundColor: STRATEGY_ASSET_CLASS_COLOR[s.assetClass] }} />
            ))}
          </div>
          <ul className="flex flex-col gap-1.5">
            {slices.map((s) => {
              const dest = context.destinations[s.assetClass];
              return (
                <li key={s.assetClass} className="flex items-baseline gap-2 text-sm">
                  <span className="mt-1 size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: STRATEGY_ASSET_CLASS_COLOR[s.assetClass] }} />
                  <b className="shrink-0 tabular-nums text-ink">{money(s.amount, { round: true })}</b>
                  <span className="min-w-0 leading-snug text-ink-muted">
                    {dest ? `→ ${dest.assetName}` : `→ ${context.labels[s.assetClass]}`}
                    {!dest && <span className="text-ink-faint"> · ainda sem ativo desse tipo</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {!hasAssets && <p className="text-caption text-ink-faint">Sua carteira ainda está vazia, então a divisão segue só a estratégia.</p>}
    </Card>
  );
}
