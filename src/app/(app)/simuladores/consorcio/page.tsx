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
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Field, SelectField } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

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
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Consórcio vs. Financiamento"
        subtitle="Inclui o custo de oportunidade da entrada do financiamento — dinheiro que poderia render se, em vez de financiar, você tivesse optado pelo consórcio (que não exige entrada)."
      />

      <Card as="form" onSubmit={onSubmit} className="flex flex-col gap-4 p-5">
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
          <SelectField label="Sistema de amortização" {...register("financingSystem")}>
            <option value="PRICE">Price</option>
            <option value="SAC">SAC</option>
          </SelectField>
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
        <Button type="submit" className="w-fit">
          Simular
        </Button>
      </Card>

      {result && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatCard label="Consórcio — parcela" value={formatBRL(result.consortium.installment)} />
          <StatCard label="Consórcio — custo da operação" value={formatBRL(result.consortium.operationCost)} />
          <StatCard label="Consórcio — total pago" value={formatBRL(result.consortium.totalPaid)} />
          <StatCard label="Financiamento — 1ª parcela" value={formatBRL(result.financing.firstInstallment)} />
          <StatCard label="Financiamento — custo da operação (juros)" value={formatBRL(result.financing.operationCost)} />
          <StatCard
            label="Financiamento — custo de oportunidade da entrada"
            value={formatBRL(result.financing.downPaymentOpportunityCost)}
          />
          <StatCard
            label="Financiamento — custo total (com oportunidade)"
            value={formatBRL(result.financing.totalCostWithOpportunity)}
          />
          <StatCard
            label="Conclusão"
            value={`${result.winner === "CONSORCIO" ? "Consórcio" : "Financiamento"} (${formatBRL(result.differenceInFavorOfWinner)} mais barato)`}
            tone="gold"
          />
        </div>
      )}
    </div>
  );
}
