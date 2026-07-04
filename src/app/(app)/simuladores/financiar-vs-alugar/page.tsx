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
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Field, SelectField } from "@/components/ui/Field";
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
          <SelectField label="Sistema de amortização" {...register("system")}>
            <option value="SAC">SAC</option>
            <option value="PRICE">Price</option>
          </SelectField>
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
              tone="gold"
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
