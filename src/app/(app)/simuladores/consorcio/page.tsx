"use client";

import { simulateConsortiumVsFinancing } from "@/lib/simulators/consortium";
import type { ConsortiumFormValues } from "@/lib/validations/consortium.schema";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { OutcomeComparison } from "@/components/charts/OutcomeComparison";
import { SimulatorWizard, type WizardField, type WizardValues } from "@/components/simulators/SimulatorWizard";
import { useMoney } from "@/components/money/MoneyProvider";


const FIELDS: WizardField[] = [
  { name: "creditValue", label: "Valor do bem", kind: "currency", help: "O valor da carta de crédito do consórcio / preço do bem que você quer." },
  { name: "consortiumAdminFeeRate", label: "Taxa de administração do consórcio", kind: "percent", suffix: "total", help: "Taxa total cobrada pela administradora ao longo do consórcio (ex.: 18%)." },
  { name: "consortiumTermMonths", label: "Prazo do consórcio", kind: "number", suffix: "meses", help: "Em quantos meses o consórcio é pago." },
  { name: "financingDownPayment", label: "Entrada do financiamento", kind: "currency", help: "Quanto você daria de entrada se optasse pelo financiamento." },
  { name: "financingCetAnnualRate", label: "Custo do financiamento (CET)", kind: "percent", help: "Custo Efetivo Total ao ano do financiamento." },
  { name: "financingTermMonths", label: "Prazo do financiamento", kind: "number", suffix: "meses", help: "Em quantos meses o financiamento é pago." },
  {
    name: "financingSystem",
    label: "Sistema de amortização",
    kind: "select",
    help: "Price: parcelas fixas. SAC: parcelas decrescentes.",
    options: [
      { value: "PRICE", label: "Price (parcelas fixas)" },
      { value: "SAC", label: "SAC (parcelas decrescentes)" },
    ],
  },
  { name: "opportunityCostAnnualRate", label: "Taxa de oportunidade", kind: "percent", help: "Quanto renderia por ano o dinheiro da entrada se estivesse investido (o consórcio não exige entrada)." },
];

const DEFAULTS: WizardValues = {
  creditValue: 100000,
  consortiumAdminFeeRate: 0.18,
  consortiumTermMonths: 120,
  financingDownPayment: 20000,
  financingCetAnnualRate: 0.12,
  financingTermMonths: 120,
  financingSystem: "PRICE",
  opportunityCostAnnualRate: 0.11,
};

function toInput(values: WizardValues): ConsortiumFormValues {
  return {
    creditValue: Number(values.creditValue),
    consortiumAdminFeeRate: Number(values.consortiumAdminFeeRate),
    consortiumTermMonths: Number(values.consortiumTermMonths),
    financingDownPayment: Number(values.financingDownPayment),
    financingCetAnnualRate: Number(values.financingCetAnnualRate),
    financingTermMonths: Number(values.financingTermMonths),
    financingSystem: values.financingSystem === "SAC" ? "SAC" : "PRICE",
    opportunityCostAnnualRate: Number(values.opportunityCostAnnualRate),
  };
}

export default function ConsorcioPage() {
  const money = useMoney();
  return (
    <SimulatorWizard
      eyebrow="Consórcio vs. Financiamento"
      fields={FIELDS}
      defaults={DEFAULTS}
      renderResult={(values) => {
        const result = simulateConsortiumVsFinancing(toInput(values));
        return (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-strong">Resultado</p>
              <h1 className="mt-1 font-serif text-2xl text-ink">
                {result.winner === "CONSORCIO" ? "Consórcio sai mais barato" : "Financiamento sai mais barato"}{" "}
                <span className="text-ink-muted">({money(result.differenceInFavorOfWinner)})</span>
              </h1>
            </div>
            <Card className="p-4">
              {/* Barras de CUSTO: a menor é a melhor, então quem diz o vencedor é a cor. */}
              <OutcomeComparison
                a={{ label: "Consórcio", value: result.consortium.totalPaid, hint: `Total pago · parcela de ${money(result.consortium.installment)}` }}
                b={{ label: "Financiamento", value: result.financing.totalCostWithOpportunity, hint: `Custo total, já com o custo de oportunidade da entrada` }}
                winner={result.winner === "CONSORCIO" ? "a" : "b"}
                verdict={`${result.winner === "CONSORCIO" ? "Consórcio" : "Financiamento"} sai ${money(result.differenceInFavorOfWinner)} mais barato.`}
              />
            </Card>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Consórcio, parcela" value={money(result.consortium.installment)} />
              <StatCard label="Financiamento, 1ª parcela" value={money(result.financing.firstInstallment)} />
              <StatCard label="Custo de oportunidade da entrada" value={money(result.financing.downPaymentOpportunityCost)} />
            </div>
          </div>
        );
      }}
    />
  );
}
