"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  consortiumSchema,
  type ConsortiumFormInput,
  type ConsortiumFormValues,
} from "@/lib/validations/consortium.schema";
import { simulateConsortiumVsFinancing, type ConsortiumVsFinancingResult } from "@/lib/simulators/consortium";

const defaultValues: ConsortiumFormInput = {
  creditValue: 100000,
  consortiumAdminFeeRate: 0.18,
  consortiumTermMonths: 120,
  financingDownPayment: 20000,
  financingCetAnnualRate: 0.12,
  financingTermMonths: 120,
  financingSystem: "PRICE",
  opportunityCostAnnualRate: 0.11,
};

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ConsorcioPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ConsortiumFormInput, unknown, ConsortiumFormValues>({
    resolver: zodResolver(consortiumSchema),
    defaultValues,
  });
  const [result, setResult] = useState<ConsortiumVsFinancingResult | null>(null);

  const onSubmit = handleSubmit((values) => {
    setResult(simulateConsortiumVsFinancing(values));
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Consórcio vs. Financiamento</h1>
        <p className="mt-1 text-sm text-black/60">
          Inclui o custo de oportunidade da entrada do financiamento — dinheiro que poderia render se, em vez de
          financiar, você tivesse optado pelo consórcio (que não exige entrada).
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-lg border border-black/10 p-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Valor do bem (R$)" error={errors.creditValue?.message} {...register("creditValue")} type="number" step="0.01" />
          <Field
            label="Taxa de administração do consórcio (ex.: 0.18)"
            error={errors.consortiumAdminFeeRate?.message}
            {...register("consortiumAdminFeeRate")}
            type="number"
            step="0.001"
          />
          <Field
            label="Prazo do consórcio (meses)"
            error={errors.consortiumTermMonths?.message}
            {...register("consortiumTermMonths")}
            type="number"
          />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field
            label="Entrada do financiamento (R$)"
            error={errors.financingDownPayment?.message}
            {...register("financingDownPayment")}
            type="number"
            step="0.01"
          />
          <Field
            label="CET do financiamento (a.a.)"
            error={errors.financingCetAnnualRate?.message}
            {...register("financingCetAnnualRate")}
            type="number"
            step="0.0001"
          />
          <Field
            label="Prazo do financiamento (meses)"
            error={errors.financingTermMonths?.message}
            {...register("financingTermMonths")}
            type="number"
          />
          <div className="flex flex-col gap-1">
            <label htmlFor="financingSystem" className="text-xs">
              Sistema de amortização
            </label>
            <select id="financingSystem" {...register("financingSystem")} className="rounded border border-black/20 px-2 py-1.5 text-sm">
              <option value="PRICE">Price</option>
              <option value="SAC">SAC</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field
            label="Taxa de oportunidade (a.a.)"
            error={errors.opportunityCostAnnualRate?.message}
            {...register("opportunityCostAnnualRate")}
            type="number"
            step="0.0001"
          />
        </div>
        <button type="submit" className="w-fit rounded bg-black px-4 py-2 text-sm text-white">
          Simular
        </button>
      </form>

      {result && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <SummaryCard label="Consórcio — parcela" value={formatBRL(result.consortium.installment)} />
          <SummaryCard label="Consórcio — custo da operação" value={formatBRL(result.consortium.operationCost)} />
          <SummaryCard label="Consórcio — total pago" value={formatBRL(result.consortium.totalPaid)} />
          <SummaryCard label="Financiamento — 1ª parcela" value={formatBRL(result.financing.firstInstallment)} />
          <SummaryCard label="Financiamento — custo da operação (juros)" value={formatBRL(result.financing.operationCost)} />
          <SummaryCard
            label="Financiamento — custo de oportunidade da entrada"
            value={formatBRL(result.financing.downPaymentOpportunityCost)}
          />
          <SummaryCard
            label="Financiamento — custo total (com oportunidade)"
            value={formatBRL(result.financing.totalCostWithOpportunity)}
          />
          <SummaryCard
            label="Conclusão"
            value={`${result.winner === "CONSORCIO" ? "Consórcio" : "Financiamento"} (${formatBRL(result.differenceInFavorOfWinner)} mais barato)`}
          />
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
