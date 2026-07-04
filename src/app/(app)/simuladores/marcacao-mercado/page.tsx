"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
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
import { Button } from "@/components/ui/Button";

const defaultValues: MarkToMarketFormInput = {
  faceValue: 1000,
  originalRate: 0.1,
  newRate: 0.12,
  totalYears: 10,
  yearsRemaining: 6,
};

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function MarcacaoMercadoPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MarkToMarketFormInput, unknown, MarkToMarketFormValues>({
    resolver: zodResolver(markToMarketSchema),
    defaultValues,
  });
  const [result, setResult] = useState<MarkToMarketResult | null>(null);

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
          <Field label="Valor de face (R$)" error={errors.faceValue?.message} {...register("faceValue")} type="number" step="0.01" />
          <Field label="Taxa contratada (a.a.)" error={errors.originalRate?.message} {...register("originalRate")} type="number" step="0.0001" />
          <Field label="Nova taxa de mercado (a.a.)" error={errors.newRate?.message} {...register("newRate")} type="number" step="0.0001" />
          <Field label="Prazo total (anos)" error={errors.totalYears?.message} {...register("totalYears")} type="number" step="0.1" />
          <Field
            label="Anos restantes até o vencimento"
            error={errors.yearsRemaining?.message}
            {...register("yearsRemaining")}
            type="number"
            step="0.1"
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
            <StatCard label="Sensibilidade aproximada" value={`${(result.approximateSensitivity * 100).toFixed(2)}%`} />
          </div>
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
