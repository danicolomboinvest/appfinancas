"use client";

import { simulateAmortizeVsInvest } from "@/lib/simulators/amortize-vs-invest";
import type { AmortizeVsInvestFormValues } from "@/lib/validations/amortize-vs-invest.schema";
import { StatCard } from "@/components/ui/StatCard";
import { SimulatorWizard, type WizardField, type WizardValues } from "@/components/simulators/SimulatorWizard";
import { formatPercentNumber } from "@/lib/format";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const FIELDS: WizardField[] = [
  { name: "outstandingBalance", label: "Saldo devedor", kind: "currency", help: "Quanto você ainda deve no financiamento hoje." },
  { name: "cetAnnualRate", label: "Custo do financiamento (CET)", kind: "percent", help: "Custo Efetivo Total ao ano da dívida, juros mais tarifas e seguros." },
  { name: "remainingMonths", label: "Prazo restante", kind: "number", suffix: "meses", help: "Quantos meses faltam para quitar o financiamento." },
  {
    name: "system",
    label: "Sistema de amortização",
    kind: "select",
    help: "SAC: parcelas decrescentes. Price: parcelas fixas.",
    options: [
      { value: "SAC", label: "SAC (parcelas decrescentes)" },
      { value: "PRICE", label: "Price (parcelas fixas)" },
    ],
  },
  { name: "extraAmount", label: "Valor disponível", kind: "currency", help: "O dinheiro que sobrou e que você vai usar para amortizar OU investir." },
  { name: "investmentAnnualRate", label: "Rentabilidade do investimento (bruta)", kind: "percent", help: "Quanto o investimento rende ao ano, antes de descontar o Imposto de Renda." },
  { name: "incomeTaxRate", label: "Alíquota de IR do investimento", kind: "percent", help: "Imposto de Renda sobre o rendimento (ex.: 15% para prazos longos)." },
];

const DEFAULTS: WizardValues = {
  outstandingBalance: 200000,
  cetAnnualRate: 0.11,
  remainingMonths: 240,
  system: "SAC",
  extraAmount: 20000,
  investmentAnnualRate: 0.12,
  incomeTaxRate: 0.15,
};

function toInput(values: WizardValues): AmortizeVsInvestFormValues {
  return {
    outstandingBalance: Number(values.outstandingBalance),
    cetAnnualRate: Number(values.cetAnnualRate),
    remainingMonths: Number(values.remainingMonths),
    system: values.system === "PRICE" ? "PRICE" : "SAC",
    extraAmount: Number(values.extraAmount),
    investmentAnnualRate: Number(values.investmentAnnualRate),
    incomeTaxRate: Number(values.incomeTaxRate),
  };
}

export default function AmortizarVsInvestirPage() {
  return (
    <SimulatorWizard
      eyebrow="Amortizar vs. Investir"
      fields={FIELDS}
      defaults={DEFAULTS}
      renderResult={(values) => {
        const result = simulateAmortizeVsInvest(toInput(values));
        return (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-strong">Resultado</p>
              <h1 className="mt-1 font-serif text-2xl text-ink">
                {result.winner === "AMORTIZAR" ? "Melhor amortizar" : "Melhor investir"}{" "}
                <span className="text-ink-muted">({formatBRL(result.differenceInFavorOfWinner)} a mais)</span>
              </h1>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Economia de juros ao amortizar" value={formatBRL(result.interestSavings)} tone={result.winner === "AMORTIZAR" ? "accent" : "neutral"} />
              <StatCard label="Ganho líquido ao investir" value={formatBRL(result.investmentGain)} tone={result.winner === "INVESTIR" ? "accent" : "neutral"} />
              <StatCard label="Rentabilidade líquida de IR (a.a.)" value={formatPercentNumber(result.netInvestmentAnnualRate * 100, 2)} />
            </div>
            <p className="text-xs leading-relaxed text-ink-faint">
              Sem amortizar: {result.scheduleWithoutExtra.length} meses restantes, {formatBRL(result.totalInterestWithoutExtra)} de juros
              totais. Amortizando: quita em {result.scheduleWithExtra.length} meses, {formatBRL(result.totalInterestWithExtra)} de juros.
            </p>
          </div>
        );
      }}
    />
  );
}
