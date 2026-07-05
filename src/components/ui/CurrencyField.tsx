"use client";

import { useId, useState } from "react";
import { CONTROL_CLASSES } from "./Field";

function centsToBRL(cents: number | null): string {
  if (cents === null) return "";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseDigitsToCents(text: string): number | null {
  const digits = text.replace(/\D/g, "");
  if (digits === "") return null;
  return Number(digits);
}

/**
 * Input monetário com máscara em tempo real (ex.: "R$ 1.234,56"), que carrega internamente
 * o valor decimal em reais (ex.: 1234.56) via um input escondido — para formulários nativos
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
}: {
  label: string;
  name: string;
  /** Valor em reais (ex.: 1234.56), como o resto do sistema já espera. */
  defaultValue?: number;
  required?: boolean;
  error?: string;
  id?: string;
  className?: string;
}) {
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
        value={centsToBRL(cents)}
        onChange={(e) => setCents(parseDigitsToCents(e.target.value))}
        className={`${CONTROL_CLASSES} w-full ${className}`}
      />
      <input type="hidden" name={name} value={decimalValue} />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
