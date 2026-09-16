"use client";

import { simulateCarComparison } from "@/lib/simulators/car";
import type { CarComparisonFormValues } from "@/lib/validations/car.schema";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { OutcomeComparison } from "@/components/charts/OutcomeComparison";
import { SimulatorWizard, type WizardField, type WizardValues } from "@/components/simulators/SimulatorWizard";
import { useMoney } from "@/components/money/MoneyProvider";


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
  const money = useMoney();
  return (
    <SimulatorWizard
      eyebrow="Carro: Assinar vs. Comprar"
      fields={FIELDS}
      defaults={DEFAULTS}
      save={{
        type: "CARRO",
        resumo: (values) => simulateCarComparison(toInput(values)).winner === "ASSINATURA" ? "Assinar sai mais barato" : "Comprar sai mais barato",
      }}
      renderResult={(values) => {
        const result = simulateCarComparison(toInput(values));
        return (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-strong">Resultado (24 meses)</p>
              <h1 className="mt-1 font-serif text-2xl text-ink">
                {result.winner === "ASSINATURA" ? "Assinar sai mais barato" : "Comprar sai mais barato"}{" "}
                <span className="text-ink-muted">({money(result.differenceInFavorOfWinner)})</span>
              </h1>
            </div>
            <Card className="p-4">
              {/* Barras de CUSTO: aqui a menor é a melhor, e é por isso que a cor marca a
                  vencedora em vez do comprimento. */}
              <OutcomeComparison
                a={{ label: "Assinatura", value: result.netResultSubscription, hint: "Custo líquido em 24 meses" }}
                b={{ label: "Comprar 0km", value: result.netResultPurchase, hint: "Custo líquido, já com depreciação e custo de oportunidade" }}
                winner={result.winner === "ASSINATURA" ? "a" : "b"}
                verdict={`${result.winner === "ASSINATURA" ? "Assinar" : "Comprar"} sai ${money(result.differenceInFavorOfWinner)} mais barato em 24 meses.`}
              />
            </Card>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard label="Custo caixa, assinatura" value={money(result.subscriptionCashCost)} />
              <StatCard label="Custo caixa, compra" value={money(result.purchaseCashCost)} />
              <StatCard label="Custo de oportunidade da compra" value={money(result.opportunityCost)} />
            </div>
          </div>
        );
      }}
    />
  );
}
