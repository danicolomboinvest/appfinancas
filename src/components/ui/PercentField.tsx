"use client";

import { useId, useState } from "react";
import { CONTROL_CLASSES } from "./Field";

function toPercentDisplay(decimal: number | undefined): string {
  if (decimal === undefined || Number.isNaN(decimal)) return "";
  const percent = decimal * 100;
  // Evita ruído de ponto flutuante (ex.: 11.000000000000002).
  return String(Math.round(percent * 1e6) / 1e6);
}

/**
 * Input de taxa em percentual (ex.: usuário digita "11") que carrega internamente o
 * valor decimal (0.11) via um input escondido — para formulários nativos (server actions),
 * sem depender do react-hook-form.
 */
export function PercentField({
  label,
  name,
  defaultValue,
  required,
  error,
  id,
}: {
  label: string;
  name: string;
  /** Valor decimal (ex.: 0.11), como o resto do sistema já espera. */
  defaultValue?: number;
  required?: boolean;
  error?: string;
  id?: string;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [percentText, setPercentText] = useState(() => toPercentDisplay(defaultValue));
  const decimalValue = percentText === "" ? "" : Number(percentText) / 100;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-xs font-medium text-ink-muted">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type="number"
          step="0.01"
          required={required}
          value={percentText}
          onChange={(e) => setPercentText(e.target.value)}
          className={`${CONTROL_CLASSES} w-full pr-7`}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-faint">%</span>
      </div>
      <input type="hidden" name={name} value={decimalValue} />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
