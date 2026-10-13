import type { ParsedTransaction } from "./statement-parser";

/**
 * Extrato em .txt com colunas alinhadas por espaços (conta corrente, exportado pelo app do banco):
 *
 *   Data  Lançamento  Detalhes  N° documento  Valor  Tipo Lançamento
 *   01/06/2026  Pix - Recebido  31/05 00:41 00006767848360 ANA BEATRIZ  310041376249642  25,00  Entrada
 *   01/06/2026  Pix - Enviado   30/05 12:02 REFUGIO TIA RE LTDA  60101  -30,00  Saída
 *   01/06/2026  Saldo do dia  1.020,41
 *
 * Não é CSV (sem ponto e vírgula) e o leitor de texto solto não achava o valor entre as colunas:
 * uma cliente subiu o mês de junho (116 linhas com valor) e viu zero lançamentos. As colunas são
 * separadas por 2 ou mais espaços; a data da coluna 1 é a que vale (a de dentro de "Detalhes" é
 * a da operação). Saldo anterior, saldo do dia e saldo final não são lançamento.
 */

const LINHA_RE = /^(\d{2})\/(\d{2})\/(\d{4})\s{2,}(.+)$/;
const VALOR_RE = /^-?\d{1,3}(?:\.\d{3})*,\d{2}$/;
const SALDO_RE = /^(saldo|s\s?a\s?l\s?d\s?o)\b/i;

export function isExtratoColunasTxt(texto: string): boolean {
  const cabecalho = texto.split(/\r?\n/, 5).join(" ").replace(/\s+/g, " ");
  return /^\s*Data Lan[çc]amento Detalhes N[°º] documento Valor Tipo Lan[çc]amento/i.test(cabecalho);
}

export function parseExtratoColunasTxt(texto: string): ParsedTransaction[] {
  const out: ParsedTransaction[] = [];
  for (const bruta of texto.split(/\r?\n/)) {
    const m = bruta.trim().match(LINHA_RE);
    if (!m) continue;
    const colunas = m[4].trim().split(/\s{2,}/);
    const lancamento = colunas[0];
    if (SALDO_RE.test(lancamento)) continue;
    const tipo = colunas.at(-1) ?? "";
    const bruto = colunas.at(-2) ?? "";
    if (!/^(entrada|sa[ií]da)$/i.test(tipo) || !VALOR_RE.test(bruto)) continue;
    const valor = Number(bruto.replace(/\./g, "").replace(",", "."));
    if (!(Math.abs(valor) > 0)) continue;
    // Detalhes: "30/05 12:02 REFUGIO TIA RE LTDA" ou "31/05 00:41 00006767848360 ANA BEATRIZ"; só o nome interessa.
    const detalhe = colunas.length > 4 ? colunas[1].replace(/^\d{2}\/\d{2}\s+\d{2}:\d{2}\s*/, "").replace(/^\d{6,}\s+/, "").trim() : "";
    const descricao = [lancamento, detalhe].filter(Boolean).join(" ");
    const sinal = /^entrada/i.test(tipo) ? 1 : -1;
    out.push({ date: `${m[3]}-${m[2]}-${m[1]}`, description: descricao, amount: sinal * Math.abs(valor) });
  }
  return out;
}
