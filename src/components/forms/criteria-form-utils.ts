export type ResponseState = { value: string; score: string; note: string };

/**
 * Mescla sugestões de valores nas respostas atuais, nunca sobrescreve um campo `value` que
 * o usuário já preencheu. Função pura, sem React nem Next.js, separada de CriteriaForm.tsx pra
 * poder ser importada em teste sem arrastar o client component (que puxa server actions/next-auth)
 * pra dentro do Vitest.
 */
export function mergeSuggestionsIntoResponses(
  responses: Record<string, ResponseState>,
  suggestions: { criterionId: string; value: string }[],
): { responses: Record<string, ResponseState>; newlyFilled: string[] } {
  const next = { ...responses };
  const newlyFilled: string[] = [];
  for (const suggestion of suggestions) {
    const current = next[suggestion.criterionId];
    if (current && current.value === "") {
      next[suggestion.criterionId] = { ...current, value: suggestion.value };
      newlyFilled.push(suggestion.criterionId);
    }
  }
  return { responses: next, newlyFilled };
}

export type ResponsePayload = {
  criterionId: string;
  value?: string | null;
  score?: number | null;
  note?: string | null;
};

/**
 * O que mudou na nota detalhada desde o último salvamento, campo a campo.
 *
 * Mandar TODOS os critérios com o valor da tela desfazia o checklist de três toques, que grava na
 * mesma coluna (value) sem passar por aqui: ela marcava "Vi algo", abria a nota detalhada, dava
 * nota a outro critério e o "Salvar" regravava o "Tranquila" antigo por cima. Só vai o que ela
 * mexeu neste formulário.
 *
 * Campo que ela APAGOU vai como `null` (limpar no banco). `undefined` no upsert do Prisma quer
 * dizer "não mexe", e a nota apagada voltava ao reabrir a ficha.
 */
export function respostasAlteradas(
  atual: Record<string, ResponseState>,
  base: Record<string, ResponseState>,
  criterionIds: string[],
): ResponsePayload[] {
  const payload: ResponsePayload[] = [];
  for (const id of criterionIds) {
    const agora = atual[id];
    if (!agora) continue;
    const antes = base[id] ?? { value: "", score: "", note: "" };
    const item: ResponsePayload = { criterionId: id };
    if (agora.value.trim() !== antes.value.trim()) item.value = agora.value.trim() || null;
    if (agora.score !== antes.score) item.score = agora.score !== "" ? Number(agora.score) : null;
    if (agora.note.trim() !== antes.note.trim()) item.note = agora.note.trim() || null;
    if (item.value !== undefined || item.score !== undefined || item.note !== undefined) payload.push(item);
  }
  return payload;
}
