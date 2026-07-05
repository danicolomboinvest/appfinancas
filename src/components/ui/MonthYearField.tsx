"use client";

import { useId, useState } from "react";
import { CONTROL_CLASSES } from "./Field";

/** Último dia do mês selecionado (dia 0 do mês seguinte), como "YYYY-MM-DD". */
function monthValueToLastDay(monthValue: string): string {
  if (!monthValue) return "";
  const [yearStr, monthStr] = monthValue.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!year || !month) return "";
  const lastDay = new Date(year, month, 0);
  const yyyy = lastDay.getFullYear();
  const mm = String(lastDay.getMonth() + 1).padStart(2, "0");
  const dd = String(lastDay.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Seletor de mês/ano (input nativo type="month") em vez de data livre — evita erros de
 * digitação. Envia o último dia do mês escolhido como valor real via input escondido.
 */
export function MonthYearField({
  label,
  name,
  defaultValue,
  required,
  error,
  id,
}: {
  label: string;
  name: string;
  /** Data no formato "YYYY-MM-DD" (ou prefixo "YYYY-MM"). */
  defaultValue?: string;
  required?: boolean;
  error?: string;
  id?: string;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [monthValue, setMonthValue] = useState(defaultValue ? defaultValue.slice(0, 7) : "");
  const actualDate = monthValueToLastDay(monthValue);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-xs font-medium text-ink-muted">
        {label}
      </label>
      <input
        id={inputId}
        type="month"
        required={required}
        value={monthValue}
        onChange={(e) => setMonthValue(e.target.value)}
        className={CONTROL_CLASSES}
      />
      <input type="hidden" name={name} value={actualDate} />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
