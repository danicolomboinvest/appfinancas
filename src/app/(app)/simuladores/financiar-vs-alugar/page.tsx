"use client";

import { simulateFinancingVsRent, type FinancingVsRentInput } from "@/lib/simulators/financing-vs-rent";
import { FinancingVsRentChart } from "@/components/charts/FinancingVsRentChart";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { SimulatorWizard, type WizardField, type WizardValues } from "@/components/simulators/SimulatorWizard";
import { useMoney } from "@/components/money/MoneyProvider";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import type { Titulos } from "@/lib/profiles/voice";


/** As perguntas vêm do catálogo de voz, então a lista é montada com o tema em mãos. */
function campos(t: Titulos): WizardField[] {
  return [
    { name: "propertyValue", label: t.simFinValorImovel, kind: "currency", help: t.simFinValorImovelHint },
    { name: "downPayment", label: t.simFinEntrada, kind: "currency", help: t.simFinEntradaHint },
    { name: "cetAnnualRate", label: t.simCet, kind: "percent", help: t.simFinCetHint },
    { name: "propertyAppreciationAnnualRate", label: t.simFinValorizacao, kind: "percent", help: t.simFinValorizacaoHint },
    { name: "termMonths", label: t.simFinPrazo, kind: "number", suffix: "meses", help: t.simFinPrazoHint },
    {
      name: "system",
      label: t.simSistema,
      kind: "select",
      help: t.simFinSistemaHint,
      options: [
        { value: "SAC", label: t.simSac },
        { value: "PRICE", label: t.simPrice },
      ],
    },
    { name: "monthlyRent", label: t.simFinAluguel, kind: "currency", help: t.simFinAluguelHint },
    { name: "rentAnnualAdjustment", label: t.simFinReajuste, kind: "percent", help: t.simFinReajusteHint },
    // O rótulo fica escrito aqui (e não no catálogo) por causa do teste de jargão do Girly —
    // ver o cabeçalho de textos/simuladores.ts.
    { name: "investmentAnnualRate", label: "Rentabilidade ao investir a diferença", kind: "percent", help: t.simFinRentabilidadeHint },
  ];
}

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
  const money = useMoney();
  const { voz } = useProfileTheme();
  const t = voz.titulos;
  const veredito = (values: WizardValues) =>
    simulateFinancingVsRent(toInput(values)).winner === "FINANCIAR" ? t.simFinVenceFinanciar : t.simFinVenceAlugar;
  return (
    <SimulatorWizard
      eyebrow={t.simFinEyebrow}
      fields={campos(t)}
      defaults={DEFAULTS}
      save={{ type: "FINANCIAR_VS_ALUGAR", resumo: veredito }}
      renderResult={(values) => {
        const result = simulateFinancingVsRent(toInput(values));
        return (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-strong">{t.simResultado}</p>
              <h1 className="mt-1 text-h2 font-bold tracking-tight text-ink">{veredito(values)}</h1>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* "Patrimônio final" fica escrito aqui pelo mesmo motivo do rótulo de rentabilidade acima. */}
              <StatCard label="Patrimônio final, Financiar" value={money(result.finalFinancingPatrimony)} tone={result.winner === "FINANCIAR" ? "accent" : "neutral"} />
              <StatCard label="Patrimônio final, Alugar + investir" value={money(result.finalInvestedPatrimony)} tone={result.winner === "ALUGAR_E_INVESTIR" ? "accent" : "neutral"} />
              <StatCard label={t.simFinValorFinanciado} value={money(result.financedAmount)} />
            </div>
            <Card className="p-4">
              <FinancingVsRentChart schedule={result.schedule} winner={result.winner} />
            </Card>
          </div>
        );
      }}
    />
  );
}
