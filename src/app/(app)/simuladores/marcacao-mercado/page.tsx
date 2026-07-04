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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Marcação a Mercado</h1>
        <p className="mt-1 text-sm text-black/60">
          Preço de um título prefixado e sensibilidade a variações de taxa — levar até o vencimento elimina o risco.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-lg border border-black/10 p-4">
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
        <button type="submit" className="w-fit rounded bg-black px-4 py-2 text-sm text-white">
          Simular
        </button>
      </form>

      {result && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <SummaryCard label="Preço de carrego (taxa contratada)" value={formatBRL(result.carryingPrice)} />
            <SummaryCard label="Preço a mercado (nova taxa)" value={formatBRL(result.marketPrice)} />
            <SummaryCard label="Lucro/Prejuízo na venda antecipada" value={formatBRL(result.profitOrLoss)} />
            <SummaryCard label="Sensibilidade aproximada" value={`${(result.approximateSensitivity * 100).toFixed(2)}%`} />
          </div>
          <div>
            <h2 className="mb-3 text-lg font-semibold">Matriz de sensibilidade (duration × variação de taxa)</h2>
            <SensitivityHeatmap rows={result.sensitivityMatrix} />
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-black/10 p-4">
      <p className="text-xs text-black/60">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function Field({
  label,
  error,
  ...inputProps
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs">{label}</label>
      <input {...inputProps} className="rounded border border-black/20 px-2 py-1.5 text-sm" />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
