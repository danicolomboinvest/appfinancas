"use client";

import { simulateCarComparison } from "@/lib/simulators/car";
import type { CarComparisonFormValues } from "@/lib/validations/car.schema";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { OutcomeComparison } from "@/components/charts/OutcomeComparison";
import { SimulatorWizard, type WizardField, type WizardValues } from "@/components/simulators/SimulatorWizard";
import { useMoney } from "@/components/money/MoneyProvider";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import type { Titulos } from "@/lib/profiles/voice";


/** As perguntas vêm do catálogo de voz, então a lista é montada com o tema em mãos. */
function campos(t: Titulos): WizardField[] {
  return [
    { name: "carPrice", label: t.simCarroValor, kind: "currency", help: t.simCarroValorHint },
    { name: "priceAfter1Year", label: t.simCarroRevenda1, kind: "currency", help: t.simCarroRevenda1Hint },
    { name: "priceAfter2Years", label: t.simCarroRevenda2, kind: "currency", help: t.simCarroRevenda2Hint },
    { name: "monthlyFuelCost", label: t.simCarroCombustivel, kind: "currency", help: t.simCarroCombustivelHint },
    { name: "subscriptionMonthlyFee", label: t.simCarroAssinatura, kind: "currency", help: t.simCarroAssinaturaHint },
    { name: "annualFixedCosts", label: t.simCarroCustosFixos, kind: "currency", help: t.simCarroCustosFixosHint },
    { name: "opportunityCostMonthlyRate", label: t.simCarroOportunidade, kind: "percent", suffix: "a.m.", help: t.simCarroOportunidadeHint },
  ];
}

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
  const { voz } = useProfileTheme();
  const t = voz.titulos;
  const veredito = (values: WizardValues) =>
    simulateCarComparison(toInput(values)).winner === "ASSINATURA" ? t.simCarroVenceAssinar : t.simCarroVenceComprar;
  return (
    <SimulatorWizard
      eyebrow={t.simCarroEyebrow}
      fields={campos(t)}
      defaults={DEFAULTS}
      save={{ type: "CARRO", resumo: veredito }}
      renderResult={(values) => {
        const result = simulateCarComparison(toInput(values));
        const diferenca = money(result.differenceInFavorOfWinner);
        const vencedor = result.winner === "ASSINATURA" ? "ASSINATURA" : "COMPRA";
        return (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-strong">{t.simCarroResultado}</p>
              <h1 className="mt-1 text-h2 font-bold tracking-tight text-ink">
                {veredito(values)} <span className="text-ink-muted">{t.simCarroDiferenca(diferenca)}</span>
              </h1>
            </div>
            <Card className="p-4">
              {/* Barras de CUSTO: aqui a menor é a melhor, e é por isso que a cor marca a
                  vencedora em vez do comprimento. */}
              <OutcomeComparison
                a={{ label: t.simCarroBarraAssinatura, value: result.netResultSubscription, hint: t.simCarroBarraAssinaturaHint }}
                b={{ label: t.simCarroBarraComprar, value: result.netResultPurchase, hint: t.simCarroBarraComprarHint }}
                winner={vencedor === "ASSINATURA" ? "a" : "b"}
                verdict={t.simCarroVeredito(vencedor, diferenca)}
              />
            </Card>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard label={t.simCarroCaixaAssinatura} value={money(result.subscriptionCashCost)} />
              <StatCard label={t.simCarroCaixaCompra} value={money(result.purchaseCashCost)} />
              <StatCard label={t.simCarroCustoOportunidade} value={money(result.opportunityCost)} />
            </div>
          </div>
        );
      }}
    />
  );
}
