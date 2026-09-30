"use client";

import { simulateCarComparison } from "@/lib/simulators/car";
import type { CarComparisonFormValues } from "@/lib/validations/car.schema";
import { OutcomeComparison } from "@/components/charts/OutcomeComparison";
import { DetalhesDoResultado } from "@/components/simulators/DetalhesDoResultado";
import { SimulatorWizard, type WizardField, type WizardValues } from "@/components/simulators/SimulatorWizard";
import { useMoney } from "@/components/money/MoneyProvider";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import type { Titulos } from "@/lib/profiles/voice";


/** As perguntas vêm do catálogo de voz, então a lista é montada com o tema em mãos. */
function campos(t: Titulos): WizardField[] {
  return [
    { name: "carPrice", label: t.simCarroValor, kind: "currency", help: t.simCarroValorHint, grupo: "comprar", max: 400000, step: 1000, chips: [70000, 100000, 150000, 200000] },
    { name: "priceAfter1Year", label: t.simCarroRevenda1, kind: "currency", help: t.simCarroRevenda1Hint, grupo: "comprar", max: 400000, step: 1000 },
    { name: "priceAfter2Years", label: t.simCarroRevenda2, kind: "currency", help: t.simCarroRevenda2Hint, grupo: "comprar", max: 400000, step: 1000 },
    { name: "monthlyFuelCost", label: t.simCarroCombustivel, kind: "currency", help: t.simCarroCombustivelHint, grupo: "dia", max: 3000, step: 50, chips: [200, 400, 800] },
    { name: "subscriptionMonthlyFee", label: t.simCarroAssinatura, kind: "currency", help: t.simCarroAssinaturaHint, grupo: "assinar", max: 10000, step: 50, chips: [1800, 2500, 3500] },
    { name: "annualFixedCosts", label: t.simCarroCustosFixos, kind: "currency", help: t.simCarroCustosFixosHint, grupo: "comprar", max: 30000, step: 250 },
    { name: "opportunityCostMonthlyRate", label: t.simCarroOportunidade, kind: "percent", suffix: "a.m.", help: t.simCarroOportunidadeHint, avancado: true },
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
      grupos={[
        { id: "comprar", titulo: "Se comprar" },
        { id: "assinar", titulo: "Se assinar" },
        { id: "dia", titulo: "No dia a dia (vale pros dois)" },
      ]}
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
              <h2 className="mt-1 text-xl font-bold leading-snug tracking-tight text-ink">
                {veredito(values)} <span className="text-ink-muted">{t.simCarroDiferenca(diferenca)}</span>
              </h2>
            </div>
              {/* Barras de CUSTO: aqui a menor é a melhor, e é por isso que a cor marca a
                  vencedora em vez do comprimento. */}
              <OutcomeComparison
                a={{ label: t.simCarroBarraAssinatura, value: result.netResultSubscription, hint: t.simCarroBarraAssinaturaHint }}
                b={{ label: t.simCarroBarraComprar, value: result.netResultPurchase, hint: t.simCarroBarraComprarHint }}
                winner={vencedor === "ASSINATURA" ? "a" : "b"}
                verdict={t.simCarroVeredito(vencedor, diferenca)}
              />
            <DetalhesDoResultado itens={[{ rotulo: t.simCarroCaixaAssinatura, valor: money(result.subscriptionCashCost) }, { rotulo: t.simCarroCaixaCompra, valor: money(result.purchaseCashCost) }, { rotulo: t.simCarroCustoOportunidade, valor: money(result.opportunityCost) }]} />
          </div>
        );
      }}
    />
  );
}
