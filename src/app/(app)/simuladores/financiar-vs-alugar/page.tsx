"use client";

import { simulateFinancingVsRent, type FinancingVsRentInput } from "@/lib/simulators/financing-vs-rent";
import { FinancingVsRentChart } from "@/components/charts/FinancingVsRentChart";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { SimulatorWizard, type WizardField, type WizardValues } from "@/components/simulators/SimulatorWizard";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const FIELDS: WizardField[] = [
  { name: "propertyValue", label: "Valor do imóvel", kind: "currency", help: "O preço de venda do imóvel que você quer comprar." },
  { name: "downPayment", label: "Entrada", kind: "currency", help: "Quanto você paga à vista. O restante é o valor financiado." },
  { name: "cetAnnualRate", label: "Custo do financiamento (CET)", kind: "percent", help: "Custo Efetivo Total ao ano, juros mais tarifas e seguros do financiamento." },
  { name: "propertyAppreciationAnnualRate", label: "Valorização do imóvel", kind: "percent", help: "Quanto o imóvel valoriza por ano, em média." },
  { name: "termMonths", label: "Prazo", kind: "number", suffix: "meses", help: "Em quantos meses o financiamento é pago (ex.: 360 = 30 anos)." },
  {
    name: "system",
    label: "Sistema de amortização",
    kind: "select",
    help: "SAC: as parcelas começam maiores e caem com o tempo. Price: parcelas fixas do começo ao fim.",
    options: [
      { value: "SAC", label: "SAC (parcelas decrescentes)" },
      { value: "PRICE", label: "Price (parcelas fixas)" },
    ],
  },
  { name: "monthlyRent", label: "Aluguel mensal", kind: "currency", help: "Quanto custaria alugar o mesmo imóvel por mês (cenário alternativo)." },
  { name: "rentAnnualAdjustment", label: "Reajuste anual do aluguel", kind: "percent", help: "Quanto o aluguel sobe por ano (ex.: IGP-M ou IPCA)." },
  { name: "investmentAnnualRate", label: "Rentabilidade ao investir a diferença", kind: "percent", help: "Quanto rende por ano o dinheiro que você investiria em vez de comprar." },
];

const DEFAULTS: WizardValues = {
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

function toInput(values: WizardValues): FinancingVsRentInput {
  return {
    propertyValue: Number(values.propertyValue),
    downPayment: Number(values.downPayment),
    cetAnnualRate: Number(values.cetAnnualRate),
    propertyAppreciationAnnualRate: Number(values.propertyAppreciationAnnualRate),
    termMonths: Number(values.termMonths),
    system: values.system === "PRICE" ? "PRICE" : "SAC",
    monthlyRent: Number(values.monthlyRent),
    rentAnnualAdjustment: Number(values.rentAnnualAdjustment),
    investmentAnnualRate: Number(values.investmentAnnualRate),
  };
}

export default function FinanciarVsAlugarPage() {
  return (
    <SimulatorWizard
      eyebrow="Financiar vs. Alugar + Investir"
      fields={FIELDS}
      defaults={DEFAULTS}
      renderResult={(values) => {
        const result = simulateFinancingVsRent(toInput(values));
        return (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-strong">Resultado</p>
              <h1 className="mt-1 font-serif text-2xl text-ink">
                {result.winner === "FINANCIAR" ? "Financiar sai na frente" : "Alugar e investir sai na frente"}
              </h1>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Patrimônio final, Financiar" value={formatBRL(result.finalFinancingPatrimony)} tone={result.winner === "FINANCIAR" ? "accent" : "neutral"} />
              <StatCard label="Patrimônio final, Alugar + investir" value={formatBRL(result.finalInvestedPatrimony)} tone={result.winner === "ALUGAR_E_INVESTIR" ? "accent" : "neutral"} />
              <StatCard label="Valor financiado" value={formatBRL(result.financedAmount)} />
            </div>
            <Card className="p-4">
              <FinancingVsRentChart schedule={result.schedule} />
            </Card>
          </div>
        );
      }}
    />
  );
}
