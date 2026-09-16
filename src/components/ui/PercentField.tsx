"use client";

import { useId, useState } from "react";
import { CONTROL_CLASSES } from "./Field";
import { formatPercentNumber } from "@/lib/format";

function toPercentDisplay(decimal: number | undefined): string {
  if (decimal === undefined || Number.isNaN(decimal)) return "";
  const percent = decimal * 100;
  // Evita ruído de ponto flutuante (ex.: 11.000000000000002).
  return String(Math.round(percent * 1e6) / 1e6);
}

/**
 * Input de taxa em percentual (ex.: usuário digita "11") que carrega internamente o
 * valor decimal (0.11) via um input escondido, para formulários nativos (server actions),
 * sem depender do react-hook-form.
 */
export function PercentField({
  label,
  labelExtra,
  name,
  defaultValue,
  required,
  error,
  id,
  hint,
  suggestions,
}: {
  label: string;
  /** Conteúdo extra ao lado do rótulo (ex.: um ícone de ajuda/tooltip). */
  labelExtra?: React.ReactNode;
  name: string;
  /** Valor decimal (ex.: 0.11), como o resto do sistema já espera. */
  defaultValue?: number;
  required?: boolean;
  error?: string;
  id?: string;
  /** Uma linha em português explicando o campo, embaixo dele. */
  hint?: React.ReactNode;
  /**
   * Valores prontos (decimais, ex.: 0.08) para quem não tem o número na mão.
   *
   * Taxa, inflação e rendimento na aposentadoria são os campos onde quem não é do mercado
   * trava e fecha o app: não é falta de vontade, é não saber o que responder. Um toque num
   * valor plausível destrava, e quem sabe continua digitando por cima.
   */
  suggestions?: number[];
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [percentText, setPercentText] = useState(() => toPercentDisplay(defaultValue));
  const decimalValue = percentText === "" ? "" : Number(percentText) / 100;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="flex items-center text-xs font-medium text-ink-muted">
        {label}
        {labelExtra}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type="number"
          inputMode="decimal"
          step="0.01"
          required={required}
          value={percentText}
          onChange={(e) => setPercentText(e.target.value)}
          className={`${CONTROL_CLASSES} w-full pr-7`}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-faint">%</span>
      </div>
      <input type="hidden" name={name} value={decimalValue} />
      {suggestions && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => {
            const texto = toPercentDisplay(s);
            const escolhido = texto === percentText;
            return (
              <button
                key={s}
                type="button"
                aria-pressed={escolhido}
                onClick={() => setPercentText(texto)}
                className={`rounded-full border px-3 py-1.5 text-caption transition-colors ${
                  escolhido
                    ? "border-accent bg-accent-soft font-semibold text-accent-strong"
                    : "border-border-strong text-ink-muted hover:border-accent hover:text-ink"
                }`}
              >
                {(() => {
                  // 0.14 * 100 dá 14.000000000000002 em ponto flutuante, e sem arredondar
                  // antes o chip saía "14,0%" no meio de "10%" e "12%".
                  const pct = Math.round(s * 1e6) / 1e4;
                  return formatPercentNumber(pct, Number.isInteger(pct) ? 0 : 1);
                })()}
              </button>
            );
          })}
        </div>
      )}
      {hint && <p className="text-caption leading-relaxed text-ink-faint">{hint}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
