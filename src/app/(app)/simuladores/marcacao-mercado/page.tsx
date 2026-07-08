"use client";

import { useState } from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  markToMarketSchema,
  type MarkToMarketFormInput,
  type MarkToMarketFormValues,
} from "@/lib/validations/mark-to-market.schema";
import { simulateMarkToMarket, type MarkToMarketResult } from "@/lib/simulators/mark-to-market";
import { SensitivityHeatmap } from "@/components/charts/SensitivityHeatmap";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { PercentInputControlled } from "@/components/ui/PercentInputControlled";
import { CurrencyInputControlled } from "@/components/ui/CurrencyInputControlled";
import { Button } from "@/components/ui/Button";
import { HelpTooltip } from "@/components/forms/HelpTooltip";
import { formatPercentNumber } from "@/lib/format";

const defaultValues: MarkToMarketFormInput = {
  faceValue: 1000,
  originalRate: 0.1,
  newRate: 0.12,
  totalYears: 10,
  yearsRemaining: 6,
  hasSemiannualCoupons: false,
  duration: undefined,
  investedAmount: undefined,
};

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function MarcacaoMercadoPage() {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<MarkToMarketFormInput, unknown, MarkToMarketFormValues>({
    resolver: zodResolver(markToMarketSchema),
    defaultValues,
  });
  const [result, setResult] = useState<MarkToMarketResult | null>(null);
  const hasSemiannualCoupons = useWatch({ control, name: "hasSemiannualCoupons" });

  const onSubmit = handleSubmit((values) => {
    setResult(simulateMarkToMarket(values));
  });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Marcação a Mercado"
        subtitle="Preço de um título prefixado e sensibilidade a variações de taxa — levar até o vencimento elimina o risco."
      />

      <Card as="form" onSubmit={onSubmit} className="flex flex-col gap-4 p-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Controller
            control={control}
            name="faceValue"
            render={({ field }) => (
              <CurrencyInputControlled
                label="Valor de face (R$)"
                labelExtra={
                  <HelpTooltip
                    text={
                      <>
                        Valor de face é o valor nominal do título na data de vencimento. Para Tesouro Direto,
                        especialmente Tesouro IPCA+, consulte o valor atualizado em{" "}
                        <a
                          href="https://www.anbima.com.br"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent-strong underline"
                        >
                          www.anbima.com.br
                        </a>{" "}
                        (Preços e Índices).
                      </>
                    }
                  />
                }
                value={field.value}
                onChange={field.onChange}
                error={errors.faceValue?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="originalRate"
            render={({ field }) => (
              <PercentInputControlled label="Taxa contratada (a.a.)" value={field.value} onChange={field.onChange} error={errors.originalRate?.message} />
            )}
          />
          <Controller
            control={control}
            name="newRate"
            render={({ field }) => (
              <PercentInputControlled
                label="Nova taxa de mercado (a.a.)"
                value={field.value}
                onChange={field.onChange}
                error={errors.newRate?.message}
              />
            )}
          />
          <Field label="Prazo total (anos)" error={errors.totalYears?.message} {...register("totalYears")} type="number" step="0.1" />
          <Field
            label="Anos restantes até o vencimento"
            error={errors.yearsRemaining?.message}
            {...register("yearsRemaining")}
            type="number"
            step="0.1"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center text-xs font-medium text-ink-muted">
              Paga juros semestrais?
              <HelpTooltip text="Alguns títulos (ex.: Tesouro IPCA+ com juros semestrais) pagam cupons periódicos em vez de tudo no vencimento. Nesses casos, o prazo correto para medir a sensibilidade a variações de taxa é a duration, não o prazo até o vencimento." />
            </label>
            <Controller
              control={control}
              name="hasSemiannualCoupons"
              render={({ field }) => (
                <div className="flex gap-1.5">
                  {[
                    { value: true, label: "Sim" },
                    { value: false, label: "Não" },
                  ].map((opt) => (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => field.onChange(opt.value)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        field.value === opt.value
                          ? "border-accent bg-accent-soft text-accent-strong"
                          : "border-border-strong bg-surface-2 text-ink-muted hover:text-ink"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            />
          </div>
          {hasSemiannualCoupons && (
            <Field
              label="Duration (anos)"
              labelExtra={
                <HelpTooltip
                  text={
                    <>
                      A duration mede o prazo médio ponderado dos fluxos do título (mais curta que o prazo até o
                      vencimento, já que os cupons antecipam parte do fluxo). Consulte a duration do seu título em{" "}
                      <a
                        href="https://www.anbima.com.br"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent-strong underline"
                      >
                        www.anbima.com.br
                      </a>{" "}
                      (Preços e Índices) — use como referência inicial.
                    </>
                  }
                />
              }
              error={errors.duration?.message}
              {...register("duration")}
              type="number"
              step="0.1"
            />
          )}
          <Controller
            control={control}
            name="investedAmount"
            render={({ field }) => (
              <CurrencyInputControlled
                label="Valor investido (R$, opcional)"
                value={field.value}
                onChange={field.onChange}
                error={errors.investedAmount?.message}
              />
            )}
          />
        </div>

        <Button type="submit" className="w-fit">
          Simular
        </Button>
      </Card>

      {result && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Preço de carrego (taxa contratada)" value={formatBRL(result.carryingPrice)} />
            <StatCard label="Preço a mercado (nova taxa)" value={formatBRL(result.marketPrice)} />
            <StatCard
              label="Lucro/Prejuízo na venda antecipada"
              value={formatBRL(result.profitOrLoss)}
              tone={result.profitOrLoss >= 0 ? "success" : "danger"}
            />
            <StatCard label="Sensibilidade aproximada" value={formatPercentNumber(result.approximateSensitivity * 100, 2)} />
          </div>
          {result.scaledMarketValue !== undefined && result.scaledProfitOrLoss !== undefined && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard label="Valor de mercado hoje (sobre o valor investido)" value={formatBRL(result.scaledMarketValue)} />
              <StatCard
                label="Lucro/Prejuízo sobre o valor investido"
                value={formatBRL(result.scaledProfitOrLoss)}
                tone={result.scaledProfitOrLoss >= 0 ? "success" : "danger"}
              />
            </div>
          )}
          <div>
            <h2 className="mb-3 text-sm font-medium text-ink-muted">Matriz de sensibilidade (duration × variação de taxa)</h2>
            <Card className="p-5">
              <SensitivityHeatmap rows={result.sensitivityMatrix} />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
