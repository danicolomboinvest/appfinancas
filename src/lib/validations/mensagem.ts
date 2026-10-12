import type { z } from "zod";

/**
 * Erro de validação em português claro (12/10/2026). A cliente com o perfil em Shekel via
 * "Invalid input", a mensagem crua do zod, no topo do formulário. A mensagem escrita por nós (a do
 * schema) passa como está; a padrão do zod vira "Confira <o campo>".
 */
const CAMPOS: Record<string, string> = {
  amount: "o valor",
  currency: "a moeda",
  exchangeRate: "a cotação",
  entryDate: "a data",
  category: "o tipo do lançamento",
  parentCategory: "a categoria",
  customCategoryId: "a categoria",
  subcategory: "o tipo",
  year: "o mês",
  month: "o mês",
  description: "a descrição",
  goalId: "a meta",
  pessoa: "quem pagou",
  tipoCasal: "se é da casa ou pessoal",
  noCartao: "o cartão",
};

/** Mensagens que o zod escreve sozinho (em inglês ou no locale pt), não as nossas. */
const PADRAO_DO_ZOD = /^(invalid|expected|too (small|big)|required|entrada inválida|tipo inválido|opção inválida|valor inválido|número muito|texto muito|obrigatório)/i;

export function mensagemDeValidacao(issue: Pick<z.core.$ZodIssue, "message" | "path"> | undefined): string {
  if (!issue) return "Confira os campos e tente de novo.";
  if (issue.message && !PADRAO_DO_ZOD.test(issue.message)) return issue.message;
  const campo = CAMPOS[String(issue.path?.[0] ?? "")];
  return campo ? `Confira ${campo}: do jeito que está, não deu para salvar.` : "Confira os campos e tente de novo.";
}
