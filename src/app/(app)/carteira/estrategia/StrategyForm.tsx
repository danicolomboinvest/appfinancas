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

export function StrategyForm({ defaults }: { defaults: Record<StrategyAssetClass, number> }) {
  const [state, formAction, isPending] = useActionState(savePortfolioStrategyAction, initialState);
  useSuccessToast(isPending, state.error, "Estratégia salva com sucesso.");
  const [values, setValues] = useState<Record<StrategyAssetClass, number>>(defaults);

  const sum = STRATEGY_ASSET_CLASSES.reduce((acc, key) => acc + (values[key] || 0), 0);
  const sumOk = Math.abs(sum - 100) < 0.01;

  return (
    <Card as="form" action={formAction} className="flex flex-col gap-5 p-5">
      {state.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
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
