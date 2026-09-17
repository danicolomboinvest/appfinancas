"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CurrencyField } from "@/components/ui/CurrencyField";
import { useMoney } from "@/components/money/MoneyProvider";
import { useToast } from "@/components/ui/toast-context";
import { planContribution } from "@/lib/portfolio/contribution-plan";
import { STRATEGY_ASSET_CLASS_COLOR } from "@/lib/portfolio/strategy";
import type { ContributionContext } from "@/lib/portfolio/contribution";
import { applyContributionAction } from "./actions";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/**
 * "Onde colocar o aporte deste mês": a resposta pronta, não a tabela. O valor vem do orçamento
 * e pode ser mudado; a divisão recalcula na hora e aponta o ativo que recebe em cada classe.
 * "Aportei assim" lança o aporte no mês e soma nos ativos — sem vender nada.
 */
export function ContributionCard({ context, year, month }: { context: ContributionContext; year: number; month: number }) {
  const money = useMoney();
  const { showToast } = useToast();
  const [amount, setAmount] = useState(context.plannedAmount);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

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
  if (done) {
    return (
      <Card className="border-success/30 bg-success-soft/40 p-4">
        <p className="text-[15px] font-semibold text-success">Aporte de {MONTHS[month - 1]} registrado.</p>
        <p className="text-sm text-ink-muted">Entrou no mês como aporte e já somou nos ativos.</p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4 border-accent/30 bg-accent-soft/30 p-4">
      <div>
        <p className="text-[15px] font-semibold text-ink">Onde colocar o aporte de {MONTHS[month - 1]}</p>
        <p className="text-caption text-ink-muted">
          {context.plannedAmount > 0 ? "O valor vem do seu orçamento. " : "Diga quanto vai aportar. "}
          A divisão leva a carteira pra mais perto da estratégia, sem vender nada.
        </p>
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

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          type="button"
          size="sm"
          disabled={isPending || amount <= 0 || slices.length === 0}
          onClick={() =>
            startTransition(async () => {
              const res = await applyContributionAction(
                slices.map((s) => ({ assetClass: s.assetClass, amount: s.amount, assetId: context.destinations[s.assetClass]?.assetId ?? null })),
                year,
                month,
              );
              if (!res.ok) {
                showToast(res.error);
                return;
              }
              setDone(true);
              showToast("Aporte registrado no mês e somado nos ativos.");
            })
          }
        >
          {isPending ? "Registrando..." : "Aportei assim"}
        </Button>
        <p className="text-caption text-ink-faint">Lança o aporte em {MONTHS[month - 1]} e soma o valor no ativo de cada tipo.</p>
      </div>
    </Card>
  );
}
