/** Date (local) → "YYYY-MM-DD" pro valor de um input type="date". Usa os componentes locais
 * (não toISOString, que é UTC e pode "voltar um dia" perto da meia-noite). */
export function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Mesma data, um ano depois — usado pelo atalho "+1 ano" ao liberar acesso por um período
 * fechado (curso anual, assinatura). */
export function plusOneYear(date: Date): Date {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + 1);
  return next;
}
