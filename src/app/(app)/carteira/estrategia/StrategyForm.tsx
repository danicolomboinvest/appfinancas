"use client";

import { useActionState, useState } from "react";
import type { StrategyAssetClass } from "@prisma/client";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSuccessToast } from "@/components/ui/useSuccessToast";
import { STRATEGY_ASSET_CLASSES, STRATEGY_ASSET_CLASS_LABEL } from "@/lib/portfolio/strategy";
import { savePortfolioStrategyAction, type PortfolioStrategyState } from "./actions";
import { formatPercentNumber } from "@/lib/format";

const initialState: PortfolioStrategyState = {};

type Preset = { label: string; description: string; values: Record<StrategyAssetClass, number> };

const PRESETS: Preset[] = [
  {
    label: "Conservador",
    description: "Prioriza previsibilidade — a maior parte em renda fixa.",
    values: {
      RENDA_FIXA_POS_FIXADA: 50,
      RENDA_FIXA_IPCA: 30,
      PREFIXADO: 10,
      ACOES_BRASIL: 5,
      FIIS: 5,
      EXTERIOR: 0,
      OUTROS: 0,
    },
  },
  {
    label: "Moderado",
    description: "Equilibra renda fixa e renda variável.",
    values: {
      RENDA_FIXA_POS_FIXADA: 25,
      RENDA_FIXA_IPCA: 20,
      PREFIXADO: 10,
      ACOES_BRASIL: 20,
      FIIS: 15,
      EXTERIOR: 10,
      OUTROS: 0,
    },
  },
  {
    label: "Arrojado",
    description: "Prioriza crescimento de longo prazo — a maior parte em renda variável.",
    values: {
      RENDA_FIXA_POS_FIXADA: 10,
      RENDA_FIXA_IPCA: 5,
      PREFIXADO: 0,
      ACOES_BRASIL: 40,
      FIIS: 20,
      EXTERIOR: 20,
      OUTROS: 5,
    },
  },
];

export function StrategyForm({ defaults }: { defaults: Record<StrategyAssetClass, number> }) {
  const [state, formAction, isPending] = useActionState(savePortfolioStrategyAction, initialState);
  useSuccessToast(isPending, state.error, "Estratégia salva com sucesso.");
  const [values, setValues] = useState<Record<StrategyAssetClass, number>>(defaults);

  const sum = STRATEGY_ASSET_CLASSES.reduce((acc, key) => acc + (values[key] || 0), 0);
  const sumOk = Math.abs(sum - 100) < 0.01;

  return (
    <Card as="form" action={formAction} className="flex flex-col gap-5 p-5">
      {state.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-ink-muted">Começar de um perfil pronto (você pode ajustar depois)</span>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              title={preset.description}
              onClick={() => setValues(preset.values)}
              className="rounded-full border border-border-strong bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-accent hover:text-ink"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {STRATEGY_ASSET_CLASSES.map((assetClass) => (
          <Field
            key={assetClass}
            label={`${STRATEGY_ASSET_CLASS_LABEL[assetClass]} (%)`}
            name={assetClass}
            type="number"
            step="0.1"
            min={0}
            max={100}
            value={values[assetClass]}
            onChange={(e) => setValues((prev) => ({ ...prev, [assetClass]: Number(e.target.value) }))}
          />
        ))}
      </div>

      <div className="flex items-center justify-between">
        <span className={`text-sm font-medium ${sumOk ? "text-success" : "text-danger"}`}>
          Soma atual: {formatPercentNumber(sum, 1)} {sumOk ? "✓" : "— precisa somar 100%"}
        </span>
        <Button type="submit" disabled={isPending || !sumOk}>
          {isPending ? "Salvando..." : "Salvar estratégia"}
        </Button>
      </div>
    </Card>
  );
}
