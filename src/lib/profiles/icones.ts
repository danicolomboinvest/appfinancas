/**
 * O ícone de categoria de cada tema.
 *
 * Desde a versão nova (11/10/2026) nenhum tema troca o ícone de linha por emoji: a regra é
 * "sem emoji na interface; emoji só no que a pessoa escreve". O Girly e o Sem filtro trocavam;
 * o Sem filtro saiu e o Girly ficou com o ícone de traço fino, como os outros três. A função
 * continua existindo para quem chama não precisar mudar: devolve sempre `undefined`.
 */

export type CategoriaParaEmoji =
  | { kind: "parent"; value: string }
  | { kind: "custom"; iconKey?: string | null }
  | { kind: "income" }
  | { kind: "investment" }
  | { kind: "none" };

/** O emoji desta categoria no tema, ou undefined quando o tema usa ícone de linha (todos, hoje). */
export function emojiDaCategoria(tema: string, c: CategoriaParaEmoji): string | undefined {
  void tema;
  void c;
  return undefined;
}
