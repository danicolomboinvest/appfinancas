"use client";

import { simulateFinancingVsRent, type FinancingVsRentInput } from "@/lib/simulators/financing-vs-rent";
import { FinancingVsRentChart } from "@/components/charts/FinancingVsRentChart";
import { OutcomeComparison } from "@/components/charts/OutcomeComparison";
import { DetalhesDoResultado } from "@/components/simulators/DetalhesDoResultado";
import { SimulatorWizard, type WizardField, type WizardValues } from "@/components/simulators/SimulatorWizard";
import { useMoney } from "@/components/money/MoneyProvider";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import type { Titulos } from "@/lib/profiles/voice";


/** As perguntas vêm do catálogo de voz, então a lista é montada com o tema em mãos. */
function campos(t: Titulos): WizardField[] {
  return [
    { name: "propertyValue", label: t.simFinValorImovel, kind: "currency", help: t.simFinValorImovelHint, grupo: "imovel", max: 3000000, step: 10000, chips: [300000, 500000, 800000, 1200000] },
    { name: "downPayment", label: t.simFinEntrada, kind: "currency", help: t.simFinEntradaHint, grupo: "financiamento", max: 1500000, step: 5000 },
    { name: "cetAnnualRate", label: t.simCet, kind: "percent", help: t.simFinCetHint, grupo: "financiamento", min: 0.05, max: 0.2, chips: [0.09, 0.11, 0.13] },
    { name: "propertyAppreciationAnnualRate", label: t.simFinValorizacao, kind: "percent", help: t.simFinValorizacaoHint, avancado: true, max: 0.15 },
    { name: "termMonths", label: t.simFinPrazo, kind: "number", suffix: "meses", help: t.simFinPrazoHint, grupo: "financiamento", min: 12, max: 420, step: 12, chips: [120, 240, 360, 420] },
    {
      name: "system",
      label: t.simSistema,
      kind: "select",
      help: t.simFinSistemaHint,
      grupo: "financiamento",
      options: [
        { value: "SAC", label: t.simSac },
        { value: "PRICE", label: t.simPrice },
      ],
    },
    { name: "monthlyRent", label: t.simFinAluguel, kind: "currency", help: t.simFinAluguelHint, grupo: "aluguel", max: 15000, step: 100, chips: [1500, 2200, 3500, 5000] },
    { name: "rentAnnualAdjustment", label: t.simFinReajuste, kind: "percent", help: t.simFinReajusteHint, avancado: true, max: 0.15 },
    // Bruta, com o IR logo abaixo: quem aluga paga imposto sobre o que rende, e ignorar isso
    // virava o veredito a favor do aluguel. Mesmos textos de IR do Amortizar vs. Investir.
    { name: "investmentAnnualRate", label: t.simFinRentabilidade, kind: "percent", help: t.simFinRentabilidadeHint, grupo: "aluguel", min: 0.04, max: 0.18, chips: [0.09, 0.11, 0.13] },
    { name: "incomeTaxRate", label: t.simAmortIr, kind: "percent", help: t.simAmortIrHint, avancado: true, max: 0.225, chips: [0, 0.15, 0.225] },
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
  incomeTaxRate: 0.15,
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
    incomeTaxRate: Number(values.incomeTaxRate),
  };
}

const PRAZO_INVALIDO = "Informe o prazo do financiamento, em meses";

export default function FinanciarVsAlugarPage() {
  const money = useMoney();
  const { voz } = useProfileTheme();
  const t = voz.titulos;
  const veredito = (values: WizardValues) => {
    const result = simulateFinancingVsRent(toInput(values));
    if (result.invalidTerm) return PRAZO_INVALIDO;
    return result.winner === "FINANCIAR" ? t.simFinVenceFinanciar : t.simFinVenceAlugar;
  };
  return (
    <SimulatorWizard
      eyebrow={t.simFinEyebrow}
      fields={campos(t)}
      grupos={[
        { id: "imovel", titulo: "O imóvel" },
        { id: "financiamento", titulo: "Se financiar" },
        { id: "aluguel", titulo: "Se alugar e investir a diferença" },
      ]}
      defaults={DEFAULTS}
      save={{ type: "FINANCIAR_VS_ALUGAR", resumo: veredito }}
      renderResult={(values) => {
        const result = simulateFinancingVsRent(toInput(values));
        // Prazo apagado ou zerado no "Ajustar respostas": sem tabela, não há veredito — pede o
        // prazo em vez de mostrar números vazios (antes a tela inteira caía).
        if (result.invalidTerm) {
          return (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-strong">{t.simResultado}</p>
              <h2 className="mt-1 text-xl font-bold leading-snug tracking-tight text-ink">{PRAZO_INVALIDO}</h2>
            </div>
          );
        }
        return (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-strong">{t.simResultado}</p>
              <h2 className="mt-1 text-xl font-bold leading-snug tracking-tight text-ink">{veredito(values)}</h2>
            </div>
            <OutcomeComparison
              a={{ label: "Financiar", value: result.finalFinancingPatrimony, hint: "o imóvel quitado, no valor do fim do prazo" }}
              b={{ label: "Alugar e investir a diferença", value: result.finalInvestedPatrimony, hint: "o que você teria investido, já sem o imposto" }}
              winner={result.winner === "FINANCIAR" ? "a" : "b"}
              verdict={`${result.winner === "FINANCIAR" ? "Financiar" : "Alugar e investir"} termina com ${money(Math.abs(result.finalFinancingPatrimony - result.finalInvestedPatrimony), { round: true })} a mais.`}
            />
            <DetalhesDoResultado titulo="Ver ano a ano" itens={[{ rotulo: t.simFinValorFinanciado, valor: money(result.financedAmount) }, { rotulo: t.simFinPatrimonioFinanciar, valor: money(result.finalFinancingPatrimony) }, { rotulo: t.simFinPatrimonioAlugar, valor: money(result.finalInvestedPatrimony) }]}>
              <FinancingVsRentChart schedule={result.schedule} winner={result.winner} />
            </DetalhesDoResultado>
          </div>
        );
      }}
    />
  );
}
