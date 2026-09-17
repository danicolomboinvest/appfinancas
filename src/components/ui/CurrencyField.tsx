"use client";

import { useId, useState } from "react";
import { CONTROL_CLASSES } from "./Field";
import { formatMoney, type CurrencyCode } from "@/lib/money";
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
  suggestion,
  currency: currencyProp,
  labelExtra,
}: {
  label: string;
  name: string;
  /** Máscara numa moeda diferente da do usuário (lançamento em euro num app em real). */
  currency?: CurrencyCode;
  /** Algo ao lado direito do rótulo, na mesma linha (ex.: o seletor de moeda). */
  labelExtra?: React.ReactNode;
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
  /**
   * Um valor pronto que o app já sabe, com a frase que explica de onde ele veio.
   *
   * É a resposta ao motivo nº 1 de formulário abandonado aqui: a pessoa não tem o número na
   * mão na hora. Quando o próprio app tem o dado (os lançamentos dela), perguntar é pior do
   * que oferecer — ela aceita com um toque, ou corrige por cima.
   */
  suggestion?: { value: number; label: string };
}) {
  const userCurrency = useCurrency();
  const currency = currencyProp ?? userCurrency;
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
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={inputId} className="text-xs font-medium text-ink-muted">
          {label}
        </label>
        {labelExtra}
      </div>
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
      {suggestion && Math.round(suggestion.value * 100) !== cents && (
        <p className="text-caption leading-relaxed text-ink-faint">
          {suggestion.label}{" "}
          <button
            type="button"
            onClick={() => {
              const novo = Math.round(suggestion.value * 100);
              setCents(novo);
              onValueChange?.(novo / 100);
            }}
            className="font-medium text-accent-strong underline-offset-2 hover:underline"
          >
            Usar {mask(Math.round(suggestion.value * 100))}
          </button>
        </p>
      )}
      {hint && <p className="text-caption leading-relaxed text-ink-faint">{hint}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
