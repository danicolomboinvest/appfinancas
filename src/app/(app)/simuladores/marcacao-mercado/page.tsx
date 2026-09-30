"use client";

import { simulateMarkToMarket } from "@/lib/simulators/mark-to-market";
import type { MarkToMarketFormValues } from "@/lib/validations/mark-to-market.schema";
import { SensitivityHeatmap } from "@/components/charts/SensitivityHeatmap";
import { DetalhesDoResultado } from "@/components/simulators/DetalhesDoResultado";
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
    { name: "faceValue", label: t.simMarcValorFace, kind: "currency", help: <>{t.simMarcValorFaceHint} {anbimaLink(t)}</>, grupo: "titulo", max: 10000, step: 50, chips: [1000] },
    { name: "originalRate", label: t.simMarcTaxaContratada, kind: "percent", help: t.simMarcTaxaContratadaHint, grupo: "titulo", min: 0.02, max: 0.2 },
    { name: "newRate", label: t.simMarcNovaTaxa, kind: "percent", help: t.simMarcNovaTaxaHint, grupo: "hoje", min: 0.02, max: 0.2 },
    { name: "totalYears", label: t.simMarcPrazoTotal, kind: "number", suffix: "anos", help: t.simMarcPrazoTotalHint, grupo: "titulo", min: 1, max: 35, chips: [5, 10, 20, 30] },
    { name: "yearsRemaining", label: t.simMarcAnosRestantes, kind: "number", suffix: "anos", help: t.simMarcAnosRestantesHint, grupo: "hoje", min: 0, max: 35 },
    {
      name: "hasSemiannualCoupons",
      label: t.simMarcCupons,
      kind: "select",
      help: t.simMarcCuponsHint,
      grupo: "titulo",
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
      grupo: "titulo",
      min: 0,
      max: 30,
      step: 0.1,
      showIf: (v) => v.hasSemiannualCoupons === "sim",
      help: <>{t.simMarcDurationHint} {anbimaLink(t)}</>,
    },
    { name: "investedAmount", label: t.simMarcInvestido, kind: "currency", help: t.simMarcInvestidoHint, grupo: "hoje", max: 500000, step: 1000 },
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
      grupos={[
        { id: "titulo", titulo: "O título que você tem" },
        { id: "hoje", titulo: "Se vender hoje" },
      ]}
      defaults={DEFAULTS}
      renderResult={(values) => {
        const result = simulateMarkToMarket(toInput(values));
        return (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-strong">{t.simResultado}</p>
              <h2 className="mt-1 text-xl font-bold leading-snug tracking-tight text-ink">{result.profitOrLoss >= 0 ? t.simMarcLucro : t.simMarcPrejuizo}</h2>
              <p className="mt-1 text-xs text-ink-muted">{t.simMarcSub}</p>
            </div>
            <p className={`text-3xl font-bold tabular-nums tracking-tight ${result.profitOrLoss >= 0 ? "text-success" : "text-danger"}`}>
              {money(result.scaledProfitOrLoss ?? result.profitOrLoss)}
              <span className="ml-2 text-sm font-medium text-ink-muted">{result.scaledProfitOrLoss !== undefined ? t.simMarcLucroInvestido : t.simMarcLucroVenda}</span>
            </p>
            <DetalhesDoResultado
              itens={[
                { rotulo: t.simMarcLucroVenda, valor: money(result.profitOrLoss), tom: result.profitOrLoss >= 0 ? "bom" : "ruim" },
                { rotulo: t.simMarcSensibilidade, valor: formatPercentNumber(result.approximateSensitivity * 100, 2) },
                { rotulo: t.simMarcPrecoCarrego, valor: money(result.carryingPrice) },
                { rotulo: t.simMarcPrecoMercado, valor: money(result.marketPrice) },
                ...(result.scaledMarketValue !== undefined ? [{ rotulo: t.simMarcValorMercado, valor: money(result.scaledMarketValue) }] : []),
              ]}
            >
              <p className="text-xs font-medium text-ink-muted">{t.simMarcHeatmap}</p>
              <SensitivityHeatmap rows={result.sensitivityMatrix} />
            </DetalhesDoResultado>
          </div>
        );
      }}
    />
  );
}
