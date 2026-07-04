"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  carComparisonSchema,
  type CarComparisonFormInput,
  type CarComparisonFormValues,
} from "@/lib/validations/car.schema";
import { simulateCarComparison, type CarComparisonResult } from "@/lib/simulators/car";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

const defaultValues: CarComparisonFormInput = {
  carPrice: 100000,
  priceAfter1Year: 85000,
  priceAfter2Years: 75000,
  monthlyFuelCost: 400,
  subscriptionMonthlyFee: 2500,
  annualFixedCosts: 4000,
  opportunityCostMonthlyRate: 0.008,
};

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function CarroPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CarComparisonFormInput, unknown, CarComparisonFormValues>({
    resolver: zodResolver(carComparisonSchema),
    defaultValues,
  });
  const [result, setResult] = useState<CarComparisonResult | null>(null);

  const onSubmit = handleSubmit((values) => {
    setResult(simulateCarComparison(values));
  });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Carro por Assinatura vs. Comprar 0km"
        subtitle="Compara os dois caminhos em uma janela de 24 meses, considerando depreciação e custo de oportunidade."
      />

      <Card as="form" onSubmit={onSubmit} className="flex flex-col gap-4 p-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Valor do carro 0km (R$)" error={errors.carPrice?.message} {...register("carPrice")} type="number" step="0.01" />
          <Field
            label="Valor de revenda em 1 ano (R$)"
            error={errors.priceAfter1Year?.message}
            {...register("priceAfter1Year")}
            type="number"
            step="0.01"
          />
          <Field
            label="Valor de revenda em 2 anos (R$)"
            error={errors.priceAfter2Years?.message}
            {...register("priceAfter2Years")}
            type="number"
            step="0.01"
          />
          <Field
            label="Combustível mensal (R$)"
            error={errors.monthlyFuelCost?.message}
            {...register("monthlyFuelCost")}
            type="number"
            step="0.01"
          />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field
            label="Mensalidade da assinatura (R$)"
            error={errors.subscriptionMonthlyFee?.message}
            {...register("subscriptionMonthlyFee")}
            type="number"
            step="0.01"
          />
          <Field
            label="Custos fixos anuais (IPVA, seguro...) (R$)"
            error={errors.annualFixedCosts?.message}
            {...register("annualFixedCosts")}
            type="number"
            step="0.01"
          />
          <Field
            label="Custo de oportunidade (% a.m., ex.: 0.008)"
            error={errors.opportunityCostMonthlyRate?.message}
            {...register("opportunityCostMonthlyRate")}
            type="number"
            step="0.0001"
          />
        </div>
        <Button type="submit" className="w-fit">
          Simular
        </Button>
      </Card>

      {result && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Desvalorização em 1 ano" value={`${(result.depreciationRateAfter1Year * 100).toFixed(1)}%`} />
          <StatCard label="Desvalorização em 2 anos" value={`${(result.depreciationRateAfter2Years * 100).toFixed(1)}%`} />
          <StatCard label="Custo caixa — assinatura (24 meses)" value={formatBRL(result.subscriptionCashCost)} />
          <StatCard label="Custo caixa — compra (24 meses)" value={formatBRL(result.purchaseCashCost)} />
          <StatCard label="Custo de oportunidade da compra" value={formatBRL(result.opportunityCost)} />
          <StatCard label="Resultado líquido — assinatura" value={formatBRL(result.netResultSubscription)} />
          <StatCard label="Resultado líquido — compra" value={formatBRL(result.netResultPurchase)} />
          <StatCard
            label="Conclusão"
            value={`${result.winner === "ASSINATURA" ? "Assinatura" : "Compra"} (${formatBRL(result.differenceInFavorOfWinner)} mais barato)`}
            tone="gold"
          />
        </div>
      )}
    </div>
  );
}
