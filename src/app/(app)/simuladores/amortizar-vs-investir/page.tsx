"use client";

import { simulateAmortizeVsInvest } from "@/lib/simulators/amortize-vs-invest";
import type { AmortizeVsInvestFormValues } from "@/lib/validations/amortize-vs-invest.schema";
import { OutcomeComparison } from "@/components/charts/OutcomeComparison";
import { SimulatorWizard, type WizardField, type WizardValues } from "@/components/simulators/SimulatorWizard";
import { formatPercentNumber } from "@/lib/format";
import { useMoney } from "@/components/money/MoneyProvider";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import type { Titulos } from "@/lib/profiles/voice";


/** As perguntas vêm do catálogo de voz, então a lista é montada com o tema em mãos. */
function campos(t: Titulos): WizardField[] {
  return [
    { name: "outstandingBalance", label: t.simAmortSaldo, kind: "currency", help: t.simAmortSaldoHint, grupo: "divida", max: 1500000, step: 5000 },
    { name: "cetAnnualRate", label: t.simCet, kind: "percent", help: t.simAmortCetHint, grupo: "divida", min: 0.05, max: 0.2, chips: [0.09, 0.11, 0.13] },
    { name: "remainingMonths", label: t.simAmortPrazoRestante, kind: "number", suffix: "meses", help: t.simAmortPrazoRestanteHint, grupo: "divida", min: 12, max: 420, step: 12, chips: [60, 120, 240, 360] },
    {
      name: "system",
      label: t.simSistema,
      kind: "select",
      help: t.simAmortSistemaHint,
      grupo: "divida",
      options: [
        { value: "SAC", label: t.simSac },
        { value: "PRICE", label: t.simPrice },
      ],
    },
    { name: "extraAmount", label: t.simAmortValorDisponivel, kind: "currency", help: t.simAmortValorDisponivelHint, grupo: "sobra", max: 200000, step: 1000, chips: [5000, 10000, 20000, 50000] },
    { name: "investmentAnnualRate", label: t.simAmortRentabilidade, kind: "percent", help: t.simAmortRentabilidadeHint, grupo: "sobra", min: 0.04, max: 0.18, chips: [0.09, 0.11, 0.13] },
    { name: "incomeTaxRate", label: t.simAmortIr, kind: "percent", help: t.simAmortIrHint, avancado: true, max: 0.225, chips: [0, 0.15, 0.225] },
  ];
}

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
  const money = useMoney();
  const { voz } = useProfileTheme();
  const t = voz.titulos;
  const veredito = (values: WizardValues) =>
    simulateAmortizeVsInvest(toInput(values)).winner === "AMORTIZAR" ? t.simAmortVenceAmortizar : t.simAmortVenceInvestir;
  return (
    <SimulatorWizard
      eyebrow={t.simAmortEyebrow}
      fields={campos(t)}
      grupos={[
        { id: "divida", titulo: "O financiamento que você tem" },
        { id: "sobra", titulo: "O dinheiro que sobrou" },
      ]}
      defaults={DEFAULTS}
      save={{ type: "AMORTIZAR_VS_INVESTIR", resumo: veredito }}
      renderResult={(values) => {
        const result = simulateAmortizeVsInvest(toInput(values));
        const diferenca = money(result.differenceInFavorOfWinner);
        return (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-semibold text-accent-strong">{t.simResultado}</p>
              <h2 className="mt-1 text-xl font-bold leading-snug tracking-tight text-ink">
                {veredito(values)} <span className="text-ink-muted">{t.simAmortAMais(diferenca)}</span>
              </h2>
            </div>
            <OutcomeComparison
                a={{
                  label: t.simAmortBarraAmortizar,
                  // Na mesma régua do investimento: a economia de juros com as parcelas
                  // liberadas rendendo até o fim do prazo (ver simulateAmortizeVsInvest).
                  value: result.amortizeGain,
                  hint: t.simAmortBarraAmortizarHint(String(result.scheduleWithExtra.length)),
                }}
                b={{
                  label: t.simAmortBarraInvestir,
                  value: result.investmentGain,
                  hint: t.simAmortBarraInvestirHint(formatPercentNumber(result.netInvestmentAnnualRate * 100, 2)),
                }}
                winner={result.winner === "AMORTIZAR" ? "a" : "b"}
                verdict={t.simAmortVeredito(result.winner === "AMORTIZAR" ? "AMORTIZAR" : "INVESTIR", diferenca)}
              />
            <p className="text-xs leading-relaxed text-ink-faint">
              {t.simAmortNota(
                String(result.scheduleWithoutExtra.length),
                money(result.totalInterestWithoutExtra),
                String(result.scheduleWithExtra.length),
                money(result.totalInterestWithExtra),
              )}
            </p>
          </div>
        );
      }}
    />
  );
}
