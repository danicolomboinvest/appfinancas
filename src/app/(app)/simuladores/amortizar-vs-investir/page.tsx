"use client";

import { simulateAmortizeVsInvest } from "@/lib/simulators/amortize-vs-invest";
import type { AmortizeVsInvestFormValues } from "@/lib/validations/amortize-vs-invest.schema";
import { Card } from "@/components/ui/Card";
import { OutcomeComparison } from "@/components/charts/OutcomeComparison";
import { SimulatorWizard, type WizardField, type WizardValues } from "@/components/simulators/SimulatorWizard";
import { formatPercentNumber } from "@/lib/format";
import { useMoney } from "@/components/money/MoneyProvider";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import type { Titulos } from "@/lib/profiles/voice";


/** As perguntas vêm do catálogo de voz, então a lista é montada com o tema em mãos. */
function campos(t: Titulos): WizardField[] {
  return [
    { name: "outstandingBalance", label: t.simAmortSaldo, kind: "currency", help: t.simAmortSaldoHint },
    { name: "cetAnnualRate", label: t.simCet, kind: "percent", help: t.simAmortCetHint },
    { name: "remainingMonths", label: t.simAmortPrazoRestante, kind: "number", suffix: "meses", help: t.simAmortPrazoRestanteHint },
    {
      name: "system",
      label: t.simSistema,
      kind: "select",
      help: t.simAmortSistemaHint,
      options: [
        { value: "SAC", label: t.simSac },
        { value: "PRICE", label: t.simPrice },
      ],
    },
    { name: "extraAmount", label: t.simAmortValorDisponivel, kind: "currency", help: t.simAmortValorDisponivelHint },
    // O rótulo fica escrito aqui (e não no catálogo) por causa do teste de jargão do Girly —
    // ver o cabeçalho de textos/simuladores.ts.
    { name: "investmentAnnualRate", label: "Rentabilidade do investimento (bruta)", kind: "percent", help: t.simAmortRentabilidadeHint },
    { name: "incomeTaxRate", label: t.simAmortIr, kind: "percent", help: t.simAmortIrHint },
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
      defaults={DEFAULTS}
      save={{ type: "AMORTIZAR_VS_INVESTIR", resumo: veredito }}
      renderResult={(values) => {
        const result = simulateAmortizeVsInvest(toInput(values));
        const diferenca = money(result.differenceInFavorOfWinner);
        return (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-strong">{t.simResultado}</p>
              <h1 className="mt-1 text-h2 font-bold tracking-tight text-ink">
                {veredito(values)} <span className="text-ink-muted">{t.simAmortAMais(diferenca)}</span>
              </h1>
            </div>
            <Card className="p-4">
              <OutcomeComparison
                a={{
                  label: t.simAmortBarraAmortizar,
                  value: result.interestSavings,
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
            </Card>
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
