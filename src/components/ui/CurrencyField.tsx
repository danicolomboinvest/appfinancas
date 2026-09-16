"use client";

import { useId, useState } from "react";
import { CONTROL_CLASSES } from "./Field";
import { formatMoney } from "@/lib/money";
import { useCurrency } from "@/components/money/MoneyProvider";

function parseDigitsToCents(text: string): number | null {
  const digits = text.replace(/\D/g, "");
  if (digits === "") return null;
  return Number(digits);
}

/**
 * Input monetário com máscara em tempo real (ex.: "R$ 1.234,56"), que carrega internamente
 * o valor decimal em reais (ex.: 1234.56) via um input escondido, para formulários nativos
 * (server actions), sem depender do react-hook-form.
 */
export function CurrencyField({
  label,
  name,
  defaultValue,
  required,
  error,
  id,
  className = "",
  onValueChange,
  hint,
}: {
  label: string;
  name: string;
  /** Valor em reais (ex.: 1234.56), como o resto do sistema já espera. */
  defaultValue?: number;
  required?: boolean;
  error?: string;
  id?: string;
  className?: string;
  /** Chamado a cada digitação com o valor atual em reais, para cálculos derivados ao vivo (ex.: total anual). */
  onValueChange?: (value: number) => void;
  /** Uma linha em português explicando o campo, embaixo dele. */
  hint?: React.ReactNode;
}) {
  const currency = useCurrency();
  /** Máscara ao vivo, na moeda escolhida: "R$ 1.234,56", "€ 1.234,56". */
  const mask = (cents: number | null) => (cents === null ? "" : formatMoney(cents / 100, currency));
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [cents, setCents] = useState<number | null>(() =>
    defaultValue === undefined ? null : Math.round(defaultValue * 100),
  );
  const decimalValue = cents === null ? "" : cents / 100;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-xs font-medium text-ink-muted">
        {label}
      </label>
      <input
        id={inputId}
        type="text"
        inputMode="decimal"
        required={required}
        value={mask(cents)}
        onChange={(e) => {
          const parsed = parseDigitsToCents(e.target.value);
          setCents(parsed);
          onValueChange?.(parsed === null ? 0 : parsed / 100);
        }}
        className={`${CONTROL_CLASSES} w-full ${className}`}
      />
      <input type="hidden" name={name} value={decimalValue} />
      {hint && <p className="text-caption leading-relaxed text-ink-faint">{hint}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
