"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  amortizeVsInvestSchema,
  type AmortizeVsInvestFormInput,
  type AmortizeVsInvestFormValues,
} from "@/lib/validations/amortize-vs-invest.schema";
import { simulateAmortizeVsInvest, type AmortizeVsInvestResult } from "@/lib/simulators/amortize-vs-invest";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Field, SelectField } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

const defaultValues: AmortizeVsInvestFormInput = {
  outstandingBalance: 200000,
  cetAnnualRate: 0.11,
  remainingMonths: 240,
  system: "SAC",
  extraAmount: 20000,
  investmentAnnualRate: 0.12,
  incomeTaxRate: 0.15,
};

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function AmortizarVsInvestirPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AmortizeVsInvestFormInput, unknown, AmortizeVsInvestFormValues>({
    resolver: zodResolver(amortizeVsInvestSchema),
    defaultValues,
  });
  const [result, setResult] = useState<AmortizeVsInvestResult | null>(null);

  const onSubmit = handleSubmit((values) => {
    setResult(simulateAmortizeVsInvest(values));
  });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Amortizar vs. Investir"
        subtitle="Sobrou dinheiro: usar para amortizar o financiamento (reduzindo o prazo) ou investir a taxa líquida de IR?"
      />

      <Card as="form" onSubmit={onSubmit} className="flex flex-col gap-4 p-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Saldo devedor (R$)" error={errors.outstandingBalance?.message} {...register("outstandingBalance")} type="number" step="0.01" />
          <Field label="CET (a.a.)" error={errors.cetAnnualRate?.message} {...register("cetAnnualRate")} type="number" step="0.0001" />
          <Field label="Prazo restante (meses)" error={errors.remainingMonths?.message} {...register("remainingMonths")} type="number" />
          <SelectField label="Sistema de amortização" {...register("system")}>
            <option value="SAC">SAC</option>
            <option value="PRICE">Price</option>
          </SelectField>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Valor disponível (R$)" error={errors.extraAmount?.message} {...register("extraAmount")} type="number" step="0.01" />
          <Field
            label="Rentabilidade do investimento (a.a., bruta)"
            error={errors.investmentAnnualRate?.message}
            {...register("investmentAnnualRate")}
            type="number"
            step="0.0001"
          />
          <Field
            label="Alíquota de IR (ex.: 0.15 = 15%)"
            error={errors.incomeTaxRate?.message}
            {...register("incomeTaxRate")}
            type="number"
            step="0.001"
          />
        </div>
        <Button type="submit" className="w-fit">
          Simular
        </Button>
      </Card>

      {result && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Economia de juros ao amortizar" value={formatBRL(result.interestSavings)} tone="success" />
            <StatCard label="Rentabilidade líquida de IR (a.a.)" value={`${(result.netInvestmentAnnualRate * 100).toFixed(2)}%`} />
            <StatCard label="Ganho líquido ao investir" value={formatBRL(result.investmentGain)} />
            <StatCard
              label="Conclusão"
              value={`${result.winner === "AMORTIZAR" ? "Amortizar" : "Investir"} (${formatBRL(result.differenceInFavorOfWinner)} a mais)`}
              tone="gold"
            />
          </div>
          <p className="text-sm text-ink-muted">
            Sem amortizar: {result.scheduleWithoutExtra.length} meses restantes, {formatBRL(result.totalInterestWithoutExtra)} em
            juros totais. Amortizando: quita em {result.scheduleWithExtra.length} meses,{" "}
            {formatBRL(result.totalInterestWithExtra)} em juros totais.
          </p>
        </div>
      )}
    </div>
  );
}
