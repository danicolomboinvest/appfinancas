"use client";

import { simulateMarkToMarket } from "@/lib/simulators/mark-to-market";
import type { MarkToMarketFormValues } from "@/lib/validations/mark-to-market.schema";
import { SensitivityHeatmap } from "@/components/charts/SensitivityHeatmap";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { SimulatorWizard, type WizardField, type WizardValues } from "@/components/simulators/SimulatorWizard";
import { formatPercentNumber } from "@/lib/format";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const anbimaLink = (
  <>
    Consulte o valor atualizado em{" "}
    <a href="https://www.anbima.com.br" target="_blank" rel="noopener noreferrer" className="text-accent-strong underline">
      www.anbima.com.br
    </a>{" "}
    (Preços e Índices).
  </>
);

const FIELDS: WizardField[] = [
  { name: "faceValue", label: "Valor de face", kind: "currency", help: <>Valor nominal do título na data de vencimento. {anbimaLink}</> },
  { name: "originalRate", label: "Taxa contratada", kind: "percent", help: "A taxa que você travou ao comprar o título." },
  { name: "newRate", label: "Nova taxa de mercado", kind: "percent", help: "A taxa que o mercado pratica hoje para esse título, é o que muda o preço na marcação a mercado." },
  { name: "totalYears", label: "Prazo total", kind: "number", suffix: "anos", help: "Prazo do título, do início ao vencimento." },
  { name: "yearsRemaining", label: "Anos até o vencimento", kind: "number", suffix: "anos", help: "Quanto falta até o vencimento a partir de hoje." },
  {
    name: "hasSemiannualCoupons",
    label: "Paga juros semestrais?",
    kind: "select",
    help: "Alguns títulos pagam cupons a cada semestre em vez de tudo no vencimento. Nesses casos, use a duration para medir a sensibilidade.",
    options: [
      { value: "nao", label: "Não" },
      { value: "sim", label: "Sim" },
    ],
  },
  {
    name: "duration",
    label: "Duration",
    kind: "number",
    suffix: "anos",
    showIf: (v) => v.hasSemiannualCoupons === "sim",
    help: <>Prazo médio ponderado dos fluxos do título, mais curto que o vencimento por causa dos cupons. {anbimaLink}</>,
  },
  { name: "investedAmount", label: "Valor investido (opcional)", kind: "currency", help: "Quanto você tem aplicado nesse título, para ver o resultado em reais. Pode deixar zerado." },
];

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
  return (
    <SimulatorWizard
      eyebrow="Marcação a Mercado"
      fields={FIELDS}
      defaults={DEFAULTS}
      renderResult={(values) => {
        const result = simulateMarkToMarket(toInput(values));
        return (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-strong">Resultado</p>
              <h1 className="mt-1 font-serif text-2xl text-ink">
                {result.profitOrLoss >= 0 ? "Venda antecipada daria lucro" : "Venda antecipada daria prejuízo"}
              </h1>
              <p className="mt-1 text-xs text-ink-muted">Levar até o vencimento elimina esse risco.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Lucro/Prejuízo na venda antecipada"
                value={formatBRL(result.profitOrLoss)}
                tone={result.profitOrLoss >= 0 ? "success" : "danger"}
              />
              <StatCard label="Sensibilidade aproximada" value={formatPercentNumber(result.approximateSensitivity * 100, 2)} />
              <StatCard label="Preço de carrego (taxa contratada)" value={formatBRL(result.carryingPrice)} />
              <StatCard label="Preço a mercado (nova taxa)" value={formatBRL(result.marketPrice)} />
            </div>
            {result.scaledMarketValue !== undefined && result.scaledProfitOrLoss !== undefined && (
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Valor de mercado hoje" value={formatBRL(result.scaledMarketValue)} />
                <StatCard
                  label="Lucro/Prejuízo sobre o investido"
                  value={formatBRL(result.scaledProfitOrLoss)}
                  tone={result.scaledProfitOrLoss >= 0 ? "success" : "danger"}
                />
              </div>
            )}
            <Card className="p-4">
              <p className="mb-3 text-xs font-medium text-ink-muted">Sensibilidade (duration × variação de taxa)</p>
              <SensitivityHeatmap rows={result.sensitivityMatrix} />
            </Card>
          </div>
        );
      }}
    />
  );
}
