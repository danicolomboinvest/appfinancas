"use client";

import { simulateConsortiumVsFinancing } from "@/lib/simulators/consortium";
import type { ConsortiumFormValues } from "@/lib/validations/consortium.schema";
import { OutcomeComparison } from "@/components/charts/OutcomeComparison";
import { DetalhesDoResultado } from "@/components/simulators/DetalhesDoResultado";
import { SimulatorWizard, type WizardField, type WizardValues } from "@/components/simulators/SimulatorWizard";
import { useMoney } from "@/components/money/MoneyProvider";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import type { Titulos } from "@/lib/profiles/voice";


/** As perguntas vêm do catálogo de voz, então a lista é montada com o tema em mãos. */
function campos(t: Titulos): WizardField[] {
  return [
    { name: "creditValue", label: t.simConsValorBem, kind: "currency", help: t.simConsValorBemHint, grupo: "bem", max: 1000000, step: 5000, chips: [50000, 100000, 300000, 500000] },
    { name: "consortiumAdminFeeRate", label: t.simConsTaxaAdm, kind: "percent", suffix: "total", help: t.simConsTaxaAdmHint, grupo: "consorcio", min: 0.05, max: 0.3, chips: [0.12, 0.15, 0.18, 0.22] },
    { name: "consortiumTermMonths", label: t.simConsPrazo, kind: "number", suffix: "meses", help: t.simConsPrazoHint, grupo: "consorcio", min: 12, max: 240, step: 12, chips: [60, 120, 180, 200] },
    { name: "financingDownPayment", label: t.simConsEntrada, kind: "currency", help: t.simConsEntradaHint, grupo: "financiamento", max: 500000, step: 1000 },
    { name: "financingCetAnnualRate", label: t.simCet, kind: "percent", help: t.simConsCetHint, grupo: "financiamento", min: 0.05, max: 0.3, chips: [0.1, 0.12, 0.15, 0.2] },
    { name: "financingTermMonths", label: t.simConsPrazoFin, kind: "number", suffix: "meses", help: t.simConsPrazoFinHint, grupo: "financiamento", min: 12, max: 420, step: 12, chips: [48, 60, 120, 240] },
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
    { name: "opportunityCostAnnualRate", label: t.simConsOportunidade, kind: "percent", help: t.simConsOportunidadeHint, avancado: true, max: 0.18 },
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

const PRAZO_INVALIDO = "Informe os dois prazos, em meses";

export default function ConsorcioPage() {
  const money = useMoney();
  const { voz } = useProfileTheme();
  const t = voz.titulos;
  const veredito = (values: WizardValues) => {
    const result = simulateConsortiumVsFinancing(toInput(values));
    if (result.invalidTerm) return PRAZO_INVALIDO;
    return result.winner === "CONSORCIO" ? t.simConsVenceConsorcio : t.simConsVenceFinanciamento;
  };
  return (
    <SimulatorWizard
      eyebrow={t.simConsEyebrow}
      fields={campos(t)}
      grupos={[
        { id: "bem", titulo: "O que você quer comprar" },
        { id: "consorcio", titulo: "No consórcio" },
        { id: "financiamento", titulo: "No financiamento" },
      ]}
      defaults={DEFAULTS}
      save={{ type: "CONSORCIO_VS_FINANCIAMENTO", resumo: veredito }}
      renderResult={(values) => {
        const result = simulateConsortiumVsFinancing(toInput(values));
        // Prazo zerado ou apagado no "Ajustar respostas": sem conta, não há veredito — pede o
        // prazo em vez de mostrar parcela infinita ou um financiamento "vencendo" com custo negativo.
        if (result.invalidTerm) {
          return (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-strong">{t.simResultado}</p>
              <h2 className="mt-1 text-xl font-bold leading-snug tracking-tight text-ink">{PRAZO_INVALIDO}</h2>
            </div>
          );
        }
        const diferenca = money(result.differenceInFavorOfWinner);
        const vencedor = result.winner === "CONSORCIO" ? "CONSORCIO" : "FINANCIAMENTO";
        return (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-strong">{t.simResultado}</p>
              <h2 className="mt-1 text-xl font-bold leading-snug tracking-tight text-ink">
                {veredito(values)} <span className="text-ink-muted">{t.simConsDiferenca(diferenca)}</span>
              </h2>
            </div>
              {/* Barras de CUSTO: a menor é a melhor, então quem diz o vencedor é a cor.
                  As duas precisam estar na mesma base do veredito (custo da operação, sem o bem):
                  com o total pago do consórcio (bem + taxa) de um lado e só juros do outro, a
                  barra do vencedor saía a maior e a diferença não batia com nenhuma das duas. */}
              <OutcomeComparison
                a={{ label: t.simConsBarraConsorcio, value: result.consortium.operationCost, hint: t.simConsBarraConsorcioHint(money(result.consortium.installment)) }}
                b={{ label: t.simConsBarraFinanciamento, value: result.financing.totalCostWithOpportunity, hint: t.simConsBarraFinanciamentoHint }}
                winner={vencedor === "CONSORCIO" ? "a" : "b"}
                verdict={t.simConsVeredito(vencedor, diferenca)}
              />
            <DetalhesDoResultado itens={[{ rotulo: t.simConsParcela, valor: money(result.consortium.installment) }, { rotulo: t.simConsPrimeiraParcela, valor: money(result.financing.firstInstallment) }, { rotulo: t.simConsCustoOportunidade, valor: money(result.financing.downPaymentOpportunityCost) }]} />
          </div>
        );
      }}
    />
  );
}
