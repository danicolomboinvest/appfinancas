"use client";

import { useState } from "react";
import { MonthPicker } from "./MonthPicker";

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
 * Seletor de mês/ano das metas: calendário PRÓPRIO (MonthPicker) em vez do input nativo
 * type="month" — no Safari de computador o nativo não tem calendário e virava texto livre,
 * quebrando o cadastro. Envia o último dia do mês escolhido como valor real via input
 * escondido (a meta vence no FIM do mês alvo).
 */
export function MonthYearField({
  label,
  name,
  defaultValue,
  error,
  id,
}: {
  label: string;
  name: string;
  /** Data no formato "YYYY-MM-DD" (ou prefixo "YYYY-MM"). */
  defaultValue?: string;
  /** Mantido por compatibilidade de API; a validação de obrigatório acontece no servidor. */
  required?: boolean;
  error?: string;
  id?: string;
}) {
  const [monthValue, setMonthValue] = useState(defaultValue ? defaultValue.slice(0, 7) : "");
  const actualDate = monthValueToLastDay(monthValue);

  return (
    <>
      <MonthPicker label={label} id={id} value={monthValue} onChange={setMonthValue} error={error} />
      <input type="hidden" name={name} value={actualDate} />
    </>
  );
}
