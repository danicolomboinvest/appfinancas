"use client";

import { simulateCarComparison } from "@/lib/simulators/car";
import type { CarComparisonFormValues } from "@/lib/validations/car.schema";
import { StatCard } from "@/components/ui/StatCard";
import { SimulatorWizard, type WizardField, type WizardValues } from "@/components/simulators/SimulatorWizard";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const FIELDS: WizardField[] = [
  { name: "carPrice", label: "Valor do carro 0km", kind: "currency", help: "Preço de compra do carro novo à vista." },
  { name: "priceAfter1Year", label: "Revenda em 1 ano", kind: "currency", help: "Por quanto você venderia o carro depois de 1 ano." },
  { name: "priceAfter2Years", label: "Revenda em 2 anos", kind: "currency", help: "Por quanto você venderia o carro depois de 2 anos." },
  { name: "monthlyFuelCost", label: "Combustível mensal", kind: "currency", help: "Gasto médio de combustível por mês." },
  { name: "subscriptionMonthlyFee", label: "Mensalidade da assinatura", kind: "currency", help: "Valor mensal do carro por assinatura (já inclui seguro, manutenção, IPVA)." },
  { name: "annualFixedCosts", label: "Custos fixos anuais", kind: "currency", help: "IPVA, seguro, manutenção e licenciamento por ano, no caso de comprar." },
  { name: "opportunityCostMonthlyRate", label: "Custo de oportunidade", kind: "percent", suffix: "a.m.", help: "Quanto renderia por mês o dinheiro da compra se estivesse investido." },
];

const DEFAULTS: WizardValues = {
  carPrice: 100000,
  priceAfter1Year: 85000,
  priceAfter2Years: 75000,
  monthlyFuelCost: 400,
  subscriptionMonthlyFee: 2500,
  annualFixedCosts: 4000,
  opportunityCostMonthlyRate: 0.008,
};

function toInput(values: WizardValues): CarComparisonFormValues {
  return {
    carPrice: Number(values.carPrice),
    priceAfter1Year: Number(values.priceAfter1Year),
    priceAfter2Years: Number(values.priceAfter2Years),
    monthlyFuelCost: Number(values.monthlyFuelCost),
    subscriptionMonthlyFee: Number(values.subscriptionMonthlyFee),
    annualFixedCosts: Number(values.annualFixedCosts),
    opportunityCostMonthlyRate: Number(values.opportunityCostMonthlyRate),
  };
}

export default function CarroPage() {
  return (
    <SimulatorWizard
      eyebrow="Carro: Assinar vs. Comprar"
      fields={FIELDS}
      defaults={DEFAULTS}
      renderResult={(values) => {
        const result = simulateCarComparison(toInput(values));
        return (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-strong">Resultado (24 meses)</p>
              <h1 className="mt-1 font-serif text-2xl text-ink">
                {result.winner === "ASSINATURA" ? "Assinar sai mais barato" : "Comprar sai mais barato"}{" "}
                <span className="text-ink-muted">({formatBRL(result.differenceInFavorOfWinner)})</span>
              </h1>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Resultado líquido, assinatura" value={formatBRL(result.netResultSubscription)} tone={result.winner === "ASSINATURA" ? "accent" : "neutral"} />
              <StatCard label="Resultado líquido, compra" value={formatBRL(result.netResultPurchase)} tone={result.winner === "COMPRA" ? "accent" : "neutral"} />
              <StatCard label="Custo caixa, assinatura" value={formatBRL(result.subscriptionCashCost)} />
              <StatCard label="Custo caixa, compra" value={formatBRL(result.purchaseCashCost)} />
              <StatCard label="Custo de oportunidade da compra" value={formatBRL(result.opportunityCost)} />
            </div>
          </div>
        );
      }}
    />
  );
}
