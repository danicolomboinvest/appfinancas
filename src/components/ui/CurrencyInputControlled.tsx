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

function valueToCents(value: unknown): number | null {
  const num = typeof value === "number" ? value : Number(value);
  if (value === undefined || value === null || value === "" || Number.isNaN(num)) return null;
  return Math.round(num * 100);
}

/**
 * Mesma ideia do CurrencyField, mas controlada por value/onChange (reais) — para usar
 * dentro de um <Controller> do react-hook-form, sem alterar o schema/zod (que continua
 * validando o valor numérico normalmente).
 */
export function CurrencyInputControlled({
  label,
  labelExtra,
  value,
  onChange,
  error,
  id,
}: {
  label: string;
  /** Conteúdo extra ao lado do rótulo (ex.: um ícone de ajuda/tooltip). */
  labelExtra?: React.ReactNode;
  /** Vem de field.value do Controller — pode ser `unknown` antes da coerção do zod. */
  value: unknown;
  onChange: (reais: number | undefined) => void;
  error?: string;
  id?: string;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [prevValue, setPrevValue] = useState(value);
  const [cents, setCents] = useState<number | null>(() => valueToCents(value));

  // Mantém o texto exibido em sincronia se o valor externo mudar (ex.: reset do form),
  // ajustando durante a renderização em vez de um efeito.
  if (value !== prevValue) {
    setPrevValue(value);
    setCents(valueToCents(value));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="flex items-center text-xs font-medium text-ink-muted">
        {label}
        {labelExtra}
      </label>
      <input
        id={inputId}
        type="text"
        inputMode="decimal"
        value={centsToBRL(cents)}
        onChange={(e) => {
          const nextCents = parseDigitsToCents(e.target.value);
          setCents(nextCents);
          onChange(nextCents === null ? undefined : nextCents / 100);
        }}
        className={`${CONTROL_CLASSES} w-full`}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
