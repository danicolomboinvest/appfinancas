"use client";

import { useActionState } from "react";
import { ChevronDown } from "lucide-react";
import { Field } from "@/components/ui/Field";
import { CurrencyField } from "@/components/ui/CurrencyField";
import { PercentField } from "@/components/ui/PercentField";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { savePlanningParamsAction, type PlanningParamsState } from "./actions";

const initialState: PlanningParamsState = {};

type Defaults = {
  currentAge?: number;
  retirementAge?: number;
  lifeExpectancyAge?: number | null;
  currentPatrimony?: number;
  monthlyContributionAccumulation?: number;
  accumulationAnnualRate?: number;
  inflationAnnualRate?: number;
  usufructAnnualRate?: number;
  desiredPassiveIncome?: number;
  otherPassiveIncome?: number;
};

export function PlanningParamsForm({ defaults }: { defaults: Defaults }) {
  const [state, formAction, isPending] = useActionState(savePlanningParamsAction, initialState);
  useSuccessToast(isPending, state.error);

  return (
    <Card as="form" action={formAction} className="flex flex-col gap-5 p-5">
      {state.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}

      {/* Duas metades com pesos diferentes. Em cima, o que a pessoa SABE responder, na mesma
          voz do wizard da primeira vez. Embaixo, recolhido, o que ela não sabe: taxa,
          inflação e rendimento na aposentadoria eram três campos obrigatórios de mercado
          financeiro no meio do formulário, e é ali que quem não é do ramo desiste. */}
      <div className="flex flex-col gap-5">
        <CurrencyField
          label="Quanto custa a vida que você quer?"
          name="desiredPassiveIncome"
          defaultValue={defaults.desiredPassiveIncome}
          hint="Por mês, em dinheiro de hoje."
          required
        />
        <CurrencyField
          label="Quanto você já tem investido?"
          name="currentPatrimony"
          defaultValue={defaults.currentPatrimony}
          required
        />
        <CurrencyField
          label="Quanto consegue guardar por mês?"
          name="monthlyContributionAccumulation"
          defaultValue={defaults.monthlyContributionAccumulation}
          hint="Vale por esse valor em dinheiro de hoje: o plano assume que você acompanha a inflação."
          required
        />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Sua idade hoje" name="currentAge" type="number" defaultValue={defaults.currentAge} required />
          <Field
            label="Quer parar aos"
            name="retirementAge"
            type="number"
            defaultValue={defaults.retirementAge}
            required
          />
        </div>
      </div>

      <details className="rounded-xl border border-border bg-surface-2/40 [&[open]>summary>span:last-child]:rotate-180">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-ink">Premissas</span>
            <span className="text-caption text-ink-faint">
              Os números técnicos. Já vieram preenchidos — só abra se quiser mexer.
            </span>
          </span>
          <span className="text-ink-faint transition-transform">
            <ChevronDown size={18} strokeWidth={1.75} />
          </span>
        </summary>

        <div className="flex flex-col gap-5 border-t border-border p-4">
          <p className="text-caption leading-relaxed text-ink-muted">
            Nenhum destes números é promessa: são o cenário que você escolhe simular.
          </p>

          <PercentField
            label="Quanto seus investimentos rendem por ano"
            name="accumulationAnnualRate"
            defaultValue={defaults.accumulationAnnualRate}
            suggestions={[0.08, 0.1, 0.12]}
            hint="Antes de descontar a inflação. Se você investe perto do CDI, use a taxa do CDI."
            required
          />
          <PercentField
            label="Inflação que você assume"
            name="inflationAnnualRate"
            defaultValue={defaults.inflationAnnualRate}
            suggestions={[0.035, 0.045, 0.06]}
            hint="É ela que traz o dinheiro do futuro para o poder de compra de hoje."
            required
          />
          <PercentField
            label="Rendimento já vivendo de renda"
            name="usufructAnnualRate"
            defaultValue={defaults.usufructAnnualRate}
            suggestions={[0.04, 0.05, 0.06]}
            hint="Mais conservador que o da fase de acumular, porque agora você depende dele para viver."
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Até que idade (opcional)"
              name="lifeExpectancyAge"
              type="number"
              defaultValue={defaults.lifeExpectancyAge ?? undefined}
            />
            <CurrencyField
              label="Outras rendas por mês (opcional)"
              name="otherPassiveIncome"
              defaultValue={defaults.otherPassiveIncome}
            />
          </div>
        </div>
      </details>

      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Salvando..." : "Salvar"}
      </Button>
    </Card>
  );
}
