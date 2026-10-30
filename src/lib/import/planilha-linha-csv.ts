/**
 * Planilha de uma coluna só em que cada célula é uma LINHA INTEIRA de CSV.
 *
 * Acontece quando a pessoa abre o CSV do banco como texto e cola na coluna A do Excel (cliente
 * do Nubank, 17/10/2026: "date,title,amount" na A1 e "2026-10-17,Cafe,"4,50"" na A2). Ao virar
 * CSV de novo, cada célula ganha aspas e a linha chega como uma coluna só, com vírgulas e aspas
 * dentro; nenhum leitor reconhecia, "20 linhas com valor, nenhuma lançamento".
 *
 * Devolve o texto das células, uma por linha, como o CSV original; ou null quando a aba não é
 * assim (qualquer aba com mais de uma coluna preenchida em alguma linha segue o caminho normal).
 */
export function desembrulharLinhasCsv(linhas: unknown[][]): string | null {
  const celulas: string[] = [];
  for (const linha of linhas) {
    const cheias = linha.filter((c) => c !== null && c !== undefined && String(c).trim() !== "");
    if (cheias.length === 0) continue;
    if (cheias.length > 1) return null;
    celulas.push(String(cheias[0]).trim());
  }
  // Cabeçalho + pelo menos uma linha, e quase todas com cara de CSV (2+ separadores).
  if (celulas.length < 2) return null;
  const comSeparador = celulas.filter((c) => (c.match(/,/g) ?? []).length >= 2 || (c.match(/;/g) ?? []).length >= 2);
  if (comSeparador.length < celulas.length * 0.8) return null;
  return celulas.join("\n");
}
