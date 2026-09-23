"use client";

import { simulateMarkToMarket } from "@/lib/simulators/mark-to-market";
import type { MarkToMarketFormValues } from "@/lib/validations/mark-to-market.schema";
import { SensitivityHeatmap } from "@/components/charts/SensitivityHeatmap";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { SimulatorWizard, type WizardField, type WizardValues } from "@/components/simulators/SimulatorWizard";
import { formatPercentNumber } from "@/lib/format";
import { useMoney } from "@/components/money/MoneyProvider";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import type { Titulos } from "@/lib/profiles/voice";


/** A dica da ANBIMA: o link fica no meio, então o texto do catálogo vem em duas metades. */
function anbimaLink(t: Titulos) {
  return (
    <>
      {t.simMarcAnbimaAntes}{" "}
      <a href="https://www.anbima.com.br" target="_blank" rel="noopener noreferrer" className="text-accent-strong underline">
        www.anbima.com.br
      </a>{" "}
      {t.simMarcAnbimaDepois}
    </>
  );
}

/** As perguntas vêm do catálogo de voz, então a lista é montada com o tema em mãos. */
function campos(t: Titulos): WizardField[] {
  return [
    { name: "faceValue", label: t.simMarcValorFace, kind: "currency", help: <>{t.simMarcValorFaceHint} {anbimaLink(t)}</> },
    { name: "originalRate", label: t.simMarcTaxaContratada, kind: "percent", help: t.simMarcTaxaContratadaHint },
    { name: "newRate", label: t.simMarcNovaTaxa, kind: "percent", help: t.simMarcNovaTaxaHint },
    { name: "totalYears", label: t.simMarcPrazoTotal, kind: "number", suffix: "anos", help: t.simMarcPrazoTotalHint },
    { name: "yearsRemaining", label: t.simMarcAnosRestantes, kind: "number", suffix: "anos", help: t.simMarcAnosRestantesHint },
    {
      name: "hasSemiannualCoupons",
      label: t.simMarcCupons,
      kind: "select",
      help: t.simMarcCuponsHint,
      options: [
        { value: "nao", label: t.simNao },
        { value: "sim", label: t.simSim },
      ],
    },
    {
      name: "duration",
      label: t.simMarcDuration,
      kind: "number",
      suffix: "anos",
      showIf: (v) => v.hasSemiannualCoupons === "sim",
      help: <>{t.simMarcDurationHint} {anbimaLink(t)}</>,
    },
    { name: "investedAmount", label: t.simMarcInvestido, kind: "currency", help: t.simMarcInvestidoHint },
  ];
}

const DEFAULTS: WizardValues = {
  faceValue: 1000,
  originalRate: 0.1,
  newRate: 0.12,
  totalYears: 10,
  yearsRemaining: 6,
  hasSemiannualCoupons: "nao",
  duration: 0,
  investedAmount: 0,
};

function toInput(values: WizardValues): MarkToMarketFormValues {
  const semiannual = values.hasSemiannualCoupons === "sim";
  const duration = Number(values.duration);
  const invested = Number(values.investedAmount);
  return {
    faceValue: Number(values.faceValue),
    originalRate: Number(values.originalRate),
    newRate: Number(values.newRate),
    totalYears: Number(values.totalYears),
    yearsRemaining: Number(values.yearsRemaining),
    hasSemiannualCoupons: semiannual,
    duration: semiannual && duration > 0 ? duration : undefined,
    investedAmount: invested > 0 ? invested : undefined,
  };
}

export default function MarcacaoMercadoPage() {
  const money = useMoney();
  const { voz } = useProfileTheme();
  const t = voz.titulos;
  return (
    <SimulatorWizard
      eyebrow={t.simMarcEyebrow}
      fields={campos(t)}
      defaults={DEFAULTS}
      renderResult={(values) => {
        const result = simulateMarkToMarket(toInput(values));
        return (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-strong">{t.simResultado}</p>
              <h1 className="mt-1 text-h2 font-bold tracking-tight text-ink">{result.profitOrLoss >= 0 ? t.simMarcLucro : t.simMarcPrejuizo}</h1>
              <p className="mt-1 text-xs text-ink-muted">{t.simMarcSub}</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <StatCard
                label={t.simMarcLucroVenda}
                value={money(result.profitOrLoss)}
                tone={result.profitOrLoss >= 0 ? "success" : "danger"}
              />
              <StatCard label={t.simMarcSensibilidade} value={formatPercentNumber(result.approximateSensitivity * 100, 2)} />
              <StatCard label={t.simMarcPrecoCarrego} value={money(result.carryingPrice)} />
              <StatCard label={t.simMarcPrecoMercado} value={money(result.marketPrice)} />
            </div>
            {result.scaledMarketValue !== undefined && result.scaledProfitOrLoss !== undefined && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <StatCard label={t.simMarcValorMercado} value={money(result.scaledMarketValue)} />
                <StatCard
                  label={t.simMarcLucroInvestido}
                  value={money(result.scaledProfitOrLoss)}
                  tone={result.scaledProfitOrLoss >= 0 ? "success" : "danger"}
                />
              </div>
            )}
            <Card className="p-4">
              <p className="mb-3 text-xs font-medium text-ink-muted">{t.simMarcHeatmap}</p>
              <SensitivityHeatmap rows={result.sensitivityMatrix} />
            </Card>
          </div>
        );
      }}
    />
  );
}
