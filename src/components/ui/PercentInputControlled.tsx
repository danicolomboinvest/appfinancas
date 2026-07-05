"use client";

import { useId, useState } from "react";
import { CONTROL_CLASSES } from "./Field";

function toPercentDisplay(decimal: unknown): string {
  const num = typeof decimal === "number" ? decimal : Number(decimal);
  if (decimal === undefined || decimal === null || decimal === "" || Number.isNaN(num)) return "";
  return String(Math.round(num * 100 * 1e6) / 1e6);
}

/**
 * Mesma ideia do PercentField, mas controlada por value/onChange (decimal) — para usar
 * dentro de um <Controller> do react-hook-form, sem alterar o schema/zod (que continua
 * validando o valor decimal normalmente).
 */
export function PercentInputControlled({
  label,
  value,
  onChange,
  error,
  id,
}: {
  label: string;
  /** Vem de field.value do Controller — pode ser `unknown` antes da coerção do zod. */
  value: unknown;
  onChange: (decimal: number | undefined) => void;
  error?: string;
  id?: string;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [prevValue, setPrevValue] = useState(value);
  const [percentText, setPercentText] = useState(() => toPercentDisplay(value));

  // Mantém o texto exibido em sincronia se o valor externo mudar (ex.: reset do form),
  // ajustando durante a renderização em vez de um efeito.
  if (value !== prevValue) {
    setPrevValue(value);
    setPercentText(toPercentDisplay(value));
  }

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
          value={percentText}
          onChange={(e) => {
            const text = e.target.value;
            setPercentText(text);
            onChange(text === "" ? undefined : Number(text) / 100);
          }}
          className={`${CONTROL_CLASSES} w-full pr-7`}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-faint">%</span>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
