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
