import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Extrato da conta do Banco Sofisa (Sofisa Direto) em PDF.
 *
 *   Extrato do período de 01/04/2026 à 30/04/2026
 *   15/04/2026 Recebimento de transferência via PIX - De Fulana R$ 4.000,00
 *   15/04/2026 Aplicação - Meus Investimentos - CDB DIRETO DI -R$ 4.000,00
 *   15/04/2026 Saldo em 15/04/2026 R$ 0,00                ← conferência do dia, não lançamento
 *   A - 14/10/2026 Saldo Disponível R$ 0,00               ← quadro de saldo e limite, fim da lista
 *
 * O leitor genérico já acertava os lançamentos, mas o arquivo tem mais linhas com valor (saldo de
 * cada dia, limite, juros previstos) do que lançamentos: sem leitor próprio, a leitura certa era
 * contada como "leu só parte do arquivo" (3 extratos em 14/10/2026).
 */

const LANC_RE = /^(\d{2})\/(\d{2})\/(\d{4})\s+(.+?)\s+(-?)R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})$/;
const SALDO_DO_DIA_RE = /^saldo em \d{2}\/\d{2}\/\d{4}$/i;

export function isSofisaStatement(texto: string): boolean {
  return /Banco Sofisa|sofisadireto/i.test(texto) && /Extrato do per[íi]odo de \d{2}\/\d{2}\/\d{4}/i.test(texto);
}

/** Extrato do Sofisa de um período sem nenhum lançamento: só o cabeçalho e o quadro de saldo. */
export function sofisaSemMovimento(texto: string): boolean {
  return isSofisaStatement(texto) && !texto.split(/\r?\n/).some((l) => LANC_RE.test(l.replace(/\t/g, " ").replace(/\s+/g, " ").trim()));
}

export function parseSofisaStatement(texto: string): ParsedTransaction[] {
  const out: ParsedTransaction[] = [];
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.replace(/\t/g, " ").replace(/\s+/g, " ").trim();
    const m = linha.match(LANC_RE);
    if (!m || SALDO_DO_DIA_RE.test(m[4])) continue;
    const magnitude = parseBrazilianNumber(m[6]);
    if (Number.isNaN(magnitude) || magnitude === 0) continue;
    out.push({ date: `${m[3]}-${m[2]}-${m[1]}`, description: m[4], amount: m[5] === "-" ? -magnitude : magnitude });
  }
  return out;
}
