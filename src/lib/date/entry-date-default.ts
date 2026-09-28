/** "YYYY-MM-DD" local (não usar toISOString, vira UTC e pode voltar um dia). */
export function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * O que vem escrito no campo Data do formulário de lançamento.
 *
 * A data MANDA no mês do lançamento (o schema troca year/month pelo mês dela), então o valor
 * pré-preenchido decide onde o lançamento vai parar se a pessoa não mexer no campo:
 * - Edição de lançamento sem data (compra de fatura, parcela futura): campo vazio. Pôr "hoje"
 *   ali arrastava a compra de agosto pra setembro só porque ela trocou a categoria, e ainda
 *   quebrava a chave de duplicidade da fatura, que é sem data.
 * - Lançamento novo no mês de hoje: hoje, que é o caso comum.
 * - Lançamento novo em outro mês ("Lançar em Março de 2026"): dia 1 daquele mês. Com "hoje"
 *   o lançamento caía em setembro e março ficava igual, parecendo que não tinha salvado.
 */
export function defaultEntryDateValue({
  defaultEntryDate,
  isEditing,
  year,
  month,
  today,
}: {
  defaultEntryDate?: string;
  isEditing: boolean;
  year: number;
  month: number;
  today: Date;
}): string {
  if (defaultEntryDate) return defaultEntryDate;
  if (isEditing) return "";
  if (today.getFullYear() === year && today.getMonth() + 1 === month) return toDateInputValue(today);
  return `${year}-${String(month).padStart(2, "0")}-01`;
}
