"use client";

import { simulateConsortiumVsFinancing } from "@/lib/simulators/consortium";
import type { ConsortiumFormValues } from "@/lib/validations/consortium.schema";
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
    { name: "creditValue", label: t.simConsValorBem, kind: "currency", help: t.simConsValorBemHint },
    { name: "consortiumAdminFeeRate", label: t.simConsTaxaAdm, kind: "percent", suffix: "total", help: t.simConsTaxaAdmHint },
    { name: "consortiumTermMonths", label: t.simConsPrazo, kind: "number", suffix: "meses", help: t.simConsPrazoHint },
    { name: "financingDownPayment", label: t.simConsEntrada, kind: "currency", help: t.simConsEntradaHint },
    { name: "financingCetAnnualRate", label: t.simCet, kind: "percent", help: t.simConsCetHint },
    { name: "financingTermMonths", label: t.simConsPrazoFin, kind: "number", suffix: "meses", help: t.simConsPrazoFinHint },
    {
      name: "financingSystem",
      label: t.simSistema,
      kind: "select",
      help: t.simConsSistemaHint,
      options: [
        { value: "PRICE", label: t.simPrice },
        { value: "SAC", label: t.simSac },
      ],
    },
    { name: "opportunityCostAnnualRate", label: t.simConsOportunidade, kind: "percent", help: t.simConsOportunidadeHint },
  ];
}

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
  const { voz } = useProfileTheme();
  const t = voz.titulos;
  const veredito = (values: WizardValues) =>
    simulateConsortiumVsFinancing(toInput(values)).winner === "CONSORCIO" ? t.simConsVenceConsorcio : t.simConsVenceFinanciamento;
  return (
    <SimulatorWizard
      eyebrow={t.simConsEyebrow}
      fields={campos(t)}
      defaults={DEFAULTS}
      save={{ type: "CONSORCIO_VS_FINANCIAMENTO", resumo: veredito }}
      renderResult={(values) => {
        const result = simulateConsortiumVsFinancing(toInput(values));
        const diferenca = money(result.differenceInFavorOfWinner);
        const vencedor = result.winner === "CONSORCIO" ? "CONSORCIO" : "FINANCIAMENTO";
        return (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-strong">{t.simResultado}</p>
              <h1 className="mt-1 text-h2 font-bold tracking-tight text-ink">
                {veredito(values)} <span className="text-ink-muted">{t.simConsDiferenca(diferenca)}</span>
              </h1>
            </div>
            <Card className="p-4">
              {/* Barras de CUSTO: a menor é a melhor, então quem diz o vencedor é a cor. */}
              <OutcomeComparison
                a={{ label: t.simConsBarraConsorcio, value: result.consortium.totalPaid, hint: t.simConsBarraConsorcioHint(money(result.consortium.installment)) }}
                b={{ label: t.simConsBarraFinanciamento, value: result.financing.totalCostWithOpportunity, hint: t.simConsBarraFinanciamentoHint }}
                winner={vencedor === "CONSORCIO" ? "a" : "b"}
                verdict={t.simConsVeredito(vencedor, diferenca)}
              />
            </Card>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard label={t.simConsParcela} value={money(result.consortium.installment)} />
              <StatCard label={t.simConsPrimeiraParcela} value={money(result.financing.firstInstallment)} />
              <StatCard label={t.simConsCustoOportunidade} value={money(result.financing.downPaymentOpportunityCost)} />
            </div>
          </div>
        );
      }}
    />
  );
}
