"use client";

import { useActionState } from "react";
import { ChevronDown } from "lucide-react";
import { Field } from "@/components/ui/Field";
import { CurrencyField } from "@/components/ui/CurrencyField";
import { PercentField } from "@/components/ui/PercentField";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
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
  const t = useProfileTheme().voz.titulos;
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
          label={t.formApVidaPergunta}
          name="desiredPassiveIncome"
          defaultValue={defaults.desiredPassiveIncome}
          hint={t.formApVidaHint}
          required
        />
        <CurrencyField
          label={t.formApInvestidoPergunta}
          name="currentPatrimony"
          defaultValue={defaults.currentPatrimony}
          required
        />
        <CurrencyField
          label={t.formApGuardarPergunta}
          name="monthlyContributionAccumulation"
          defaultValue={defaults.monthlyContributionAccumulation}
          hint={t.formApGuardarHint}
          required
        />
        <div className="grid grid-cols-2 gap-4">
          <Field label={t.formApIdadeHoje} name="currentAge" type="number" defaultValue={defaults.currentAge} required />
          <Field
            label={t.formApPararAos}
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
            <span className="text-sm font-medium text-ink">{t.formApPremissas}</span>
            <span className="text-caption text-ink-faint">{t.formApPremissasSub}</span>
          </span>
          <span className="text-ink-faint transition-transform">
            <ChevronDown size={18} strokeWidth={1.75} />
          </span>
        </summary>

        <div className="flex flex-col gap-5 border-t border-border p-4">
          <p className="text-caption leading-relaxed text-ink-muted">{t.formApPremissasNota}</p>

          <PercentField
            label={t.formApRendem}
            name="accumulationAnnualRate"
            defaultValue={defaults.accumulationAnnualRate}
            suggestions={[0.08, 0.1, 0.12]}
            hint={t.formApRendemHint}
            required
          />
          <PercentField
            label={t.formApInflacaoAssume}
            name="inflationAnnualRate"
            defaultValue={defaults.inflationAnnualRate}
            suggestions={[0.035, 0.045, 0.06]}
            hint={t.formApInflacaoHint}
            required
          />
          <PercentField
            label={t.formApRendVivendo}
            name="usufructAnnualRate"
            defaultValue={defaults.usufructAnnualRate}
            suggestions={[0.04, 0.05, 0.06]}
            hint={t.formApRendVivendoHint}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Field
              label={t.formApAteIdade}
              name="lifeExpectancyAge"
              type="number"
              defaultValue={defaults.lifeExpectancyAge ?? undefined}
            />
            <CurrencyField
              label={t.formApOutrasRendas}
              name="otherPassiveIncome"
              defaultValue={defaults.otherPassiveIncome}
            />
          </div>
        </div>
      </details>

      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? t.formSalvando : t.formSalvar}
      </Button>
    </Card>
  );
}
