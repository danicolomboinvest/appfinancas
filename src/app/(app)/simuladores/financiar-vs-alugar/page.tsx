"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  financingVsRentSchema,
  type FinancingVsRentFormInput,
  type FinancingVsRentFormValues,
} from "@/lib/validations/financing-vs-rent.schema";
import { simulateFinancingVsRent, type FinancingVsRentResult } from "@/lib/simulators/financing-vs-rent";
import { FinancingVsRentChart } from "@/components/charts/FinancingVsRentChart";

const defaultValues: FinancingVsRentFormInput = {
  propertyValue: 500000,
  downPayment: 100000,
  cetAnnualRate: 0.11,
  propertyAppreciationAnnualRate: 0.05,
  termMonths: 360,
  system: "SAC",
  monthlyRent: 2200,
  rentAnnualAdjustment: 0.05,
  investmentAnnualRate: 0.11,
};

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function FinanciarVsAlugarPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FinancingVsRentFormInput, unknown, FinancingVsRentFormValues>({
    resolver: zodResolver(financingVsRentSchema),
    defaultValues,
  });
  const [result, setResult] = useState<FinancingVsRentResult | null>(null);

  const onSubmit = handleSubmit((values) => {
    setResult(simulateFinancingVsRent(values));
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Financiar vs. Alugar + Investir</h1>
        <p className="mt-1 text-sm text-black/60">
          Monta a amortização do financiamento (SAC ou Price) e compara com o cenário de alugar e investir a diferença.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-lg border border-black/10 p-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Valor do imóvel (R$)" error={errors.propertyValue?.message} {...register("propertyValue")} type="number" step="0.01" />
          <Field label="Entrada (R$)" error={errors.downPayment?.message} {...register("downPayment")} type="number" step="0.01" />
          <Field label="CET (a.a., ex.: 0.11)" error={errors.cetAnnualRate?.message} {...register("cetAnnualRate")} type="number" step="0.0001" />
          <Field
            label="Valorização do imóvel (a.a.)"
            error={errors.propertyAppreciationAnnualRate?.message}
            {...register("propertyAppreciationAnnualRate")}
            type="number"
            step="0.0001"
          />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Prazo (meses)" error={errors.termMonths?.message} {...register("termMonths")} type="number" />
          <div className="flex flex-col gap-1">
            <label htmlFor="system" className="text-xs">
              Sistema de amortização
            </label>
            <select id="system" {...register("system")} className="rounded border border-black/20 px-2 py-1.5 text-sm">
              <option value="SAC">SAC</option>
              <option value="PRICE">Price</option>
            </select>
          </div>
          <Field label="Aluguel mensal (R$)" error={errors.monthlyRent?.message} {...register("monthlyRent")} type="number" step="0.01" />
          <Field
            label="Reajuste anual do aluguel"
            error={errors.rentAnnualAdjustment?.message}
            {...register("rentAnnualAdjustment")}
            type="number"
            step="0.0001"
          />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field
            label="Rentabilidade de quem investe (a.a.)"
            error={errors.investmentAnnualRate?.message}
            {...register("investmentAnnualRate")}
            type="number"
            step="0.0001"
          />
        </div>
        <button type="submit" className="w-fit rounded bg-black px-4 py-2 text-sm text-white">
          Simular
        </button>
      </form>

      {result && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <SummaryCard label="Valor financiado" value={formatBRL(result.financedAmount)} />
            <SummaryCard label="Patrimônio ao final — Financiar" value={formatBRL(result.finalFinancingPatrimony)} />
            <SummaryCard label="Patrimônio ao final — Alugar + investir" value={formatBRL(result.finalInvestedPatrimony)} />
            <SummaryCard
              label="Cenário vencedor"
              value={result.winner === "FINANCIAR" ? "Financiar o imóvel" : "Alugar e investir a diferença"}
            />
          </div>
          <FinancingVsRentChart schedule={result.schedule} />
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
