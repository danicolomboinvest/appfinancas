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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Amortizar vs. Investir</h1>
        <p className="mt-1 text-sm text-black/60">
          Sobrou dinheiro: usar para amortizar o financiamento (reduzindo o prazo) ou investir a taxa líquida de IR?
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-lg border border-black/10 p-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Saldo devedor (R$)" error={errors.outstandingBalance?.message} {...register("outstandingBalance")} type="number" step="0.01" />
          <Field label="CET (a.a.)" error={errors.cetAnnualRate?.message} {...register("cetAnnualRate")} type="number" step="0.0001" />
          <Field label="Prazo restante (meses)" error={errors.remainingMonths?.message} {...register("remainingMonths")} type="number" />
          <div className="flex flex-col gap-1">
            <label htmlFor="system" className="text-xs">
              Sistema de amortização
            </label>
            <select id="system" {...register("system")} className="rounded border border-black/20 px-2 py-1.5 text-sm">
              <option value="SAC">SAC</option>
              <option value="PRICE">Price</option>
            </select>
          </div>
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
        <button type="submit" className="w-fit rounded bg-black px-4 py-2 text-sm text-white">
          Simular
        </button>
      </form>

      {result && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <SummaryCard label="Economia de juros ao amortizar" value={formatBRL(result.interestSavings)} />
            <SummaryCard label="Rentabilidade líquida de IR (a.a.)" value={`${(result.netInvestmentAnnualRate * 100).toFixed(2)}%`} />
            <SummaryCard label="Ganho líquido ao investir" value={formatBRL(result.investmentGain)} />
            <SummaryCard
              label="Conclusão"
              value={`${result.winner === "AMORTIZAR" ? "Amortizar" : "Investir"} (${formatBRL(result.differenceInFavorOfWinner)} a mais)`}
            />
          </div>
          <p className="text-sm text-black/60">
            Sem amortizar: {result.scheduleWithoutExtra.length} meses restantes, {formatBRL(result.totalInterestWithoutExtra)} em juros totais.
            Amortizando: quita em {result.scheduleWithExtra.length} meses, {formatBRL(result.totalInterestWithExtra)} em juros totais.
          </p>
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
