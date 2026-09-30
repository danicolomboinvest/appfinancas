/** Date (local) → "YYYY-MM-DD" pro valor de um input type="date". Usa os componentes locais
 * (não toISOString, que é UTC e pode "voltar um dia" perto da meia-noite). */
export function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Mesma data, um ano depois — usado pelo atalho "+1 ano" ao liberar acesso por um período
 * fechado (curso anual, assinatura). 29/02 vira 28/02, a mesma regra da Hubla (addAccessPeriod):
 * setFullYear sozinho dava 01/03 e as duas telas davam vencimentos diferentes pra mesma compra.
 * Roda no navegador da Dani, então o fuso local já é o de Brasília. */
export function plusOneYear(date: Date): Date {
  const next = new Date(date);
  const day = next.getDate();
  next.setFullYear(next.getFullYear() + 1);
  if (next.getDate() !== day) next.setDate(0);
  return next;
}
