"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  financingVsRentSchema,
  type FinancingVsRentFormInput,
  type FinancingVsRentFormValues,
} from "@/lib/validations/financing-vs-rent.schema";
import { simulateFinancingVsRent, type FinancingVsRentResult } from "@/lib/simulators/financing-vs-rent";
import { FinancingVsRentChart } from "@/components/charts/FinancingVsRentChart";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Field, SelectField } from "@/components/ui/Field";
import { PercentInputControlled } from "@/components/ui/PercentInputControlled";
import { CurrencyInputControlled } from "@/components/ui/CurrencyInputControlled";
import { Button } from "@/components/ui/Button";

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
    control,
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
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Financiar vs. Alugar + Investir"
        subtitle="Monta a amortização do financiamento (SAC ou Price) e compara com o cenário de alugar e investir a diferença."
      />

      <Card as="form" onSubmit={onSubmit} className="flex flex-col gap-4 p-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Controller
            control={control}
            name="propertyValue"
            render={({ field }) => (
              <CurrencyInputControlled
                label="Valor do imóvel (R$)"
                value={field.value}
                onChange={field.onChange}
                error={errors.propertyValue?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="downPayment"
            render={({ field }) => (
              <CurrencyInputControlled
                label="Entrada (R$)"
                value={field.value}
                onChange={field.onChange}
                error={errors.downPayment?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="cetAnnualRate"
            render={({ field }) => (
              <PercentInputControlled label="CET (a.a.)" value={field.value} onChange={field.onChange} error={errors.cetAnnualRate?.message} />
            )}
          />
          <Controller
            control={control}
            name="propertyAppreciationAnnualRate"
            render={({ field }) => (
              <PercentInputControlled
                label="Valorização do imóvel (a.a.)"
                value={field.value}
                onChange={field.onChange}
                error={errors.propertyAppreciationAnnualRate?.message}
              />
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Prazo (meses)" error={errors.termMonths?.message} {...register("termMonths")} type="number" />
          <SelectField label="Sistema de amortização" {...register("system")}>
            <option value="SAC">SAC</option>
            <option value="PRICE">Price</option>
          </SelectField>
          <Controller
            control={control}
            name="monthlyRent"
            render={({ field }) => (
              <CurrencyInputControlled
                label="Aluguel mensal (R$)"
                value={field.value}
                onChange={field.onChange}
                error={errors.monthlyRent?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="rentAnnualAdjustment"
            render={({ field }) => (
              <PercentInputControlled
                label="Reajuste anual do aluguel"
                value={field.value}
                onChange={field.onChange}
                error={errors.rentAnnualAdjustment?.message}
              />
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Controller
            control={control}
            name="investmentAnnualRate"
            render={({ field }) => (
              <PercentInputControlled
                label="Rentabilidade de quem investe (a.a.)"
                value={field.value}
                onChange={field.onChange}
                error={errors.investmentAnnualRate?.message}
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
            <StatCard label="Valor financiado" value={formatBRL(result.financedAmount)} />
            <StatCard label="Patrimônio ao final — Financiar" value={formatBRL(result.finalFinancingPatrimony)} />
            <StatCard label="Patrimônio ao final — Alugar + investir" value={formatBRL(result.finalInvestedPatrimony)} />
            <StatCard
              label="Cenário vencedor"
              value={result.winner === "FINANCIAR" ? "Financiar o imóvel" : "Alugar e investir a diferença"}
              tone="accent"
            />
          </div>
          <Card className="p-5">
            <FinancingVsRentChart schedule={result.schedule} />
          </Card>
        </div>
      )}
    </div>
  );
}
