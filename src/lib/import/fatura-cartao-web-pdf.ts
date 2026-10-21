import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Fatura do cartão salva em PDF da página do banco na internet (Bradesco: em 21/10/2026 a mesma
 * fatura veio assim e, minutos depois, no PDF de sempre do Bradesco, com o mesmo total).
 *
 *   Data de vencimento:
 *   ...
 *   10/10/2026                                         ← vencimento, abaixo dos rótulos
 *   Data Lançamentos Moeda de Origem Valor (US$) Cotação (US$) Valor (R$)
 *   Gastos referentes ao cartão: Final 0000 | NOME
 *   05                                                 ← o dia sozinho na linha
 *   SET LOJA EXEMPLO 89,90                             ← mês abreviado, descrição, valor
 *   OUTRA LOJA 9,90                                    ← mesmo dia: sem dia nem mês
 *   Valor da fatura: R$ 99,80                          ← subtotal no topo da página seguinte
 *   10
 *   SET SALDO ANTERIOR 2.500,00                        ← resumo, não é compra
 *   PAGTO. POR DEB EM C/C -2.500,00
 *   AGO LOJA PARCELADA ( 02/03 ) 150,00                ← parcela: o mês é o da compra
 *   Total da fatura (final 0000 + 1111): R$ 249,80
 *
 * O leitor genérico não ligava o dia sozinho à linha de baixo e só pegou o valor do vencimento,
 * como uma compra única do tamanho da fatura (que ainda "batia" com o total).
 */

const MESES: Record<string, string> = {
  JAN: "01", FEV: "02", MAR: "03", ABR: "04", MAI: "05", JUN: "06",
  JUL: "07", AGO: "08", SET: "09", OUT: "10", NOV: "11", DEZ: "12",
};
const DIA_RE = /^(\d{1,2})$/;
const LANC_RE = /^(?:(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\s+)?(.+?)\s+(-?)(\d{1,3}(?:\.\d{3})*,\d{2})$/;
const CABECALHO_RE = /^Data Lan[çc]amentos Moeda de Origem/i;
const FIM_RE = /^(Total da fatura \(final|Resumo das Despesas)/i;
/** Linhas de cabeçalho, subtotal e aviso que têm valor mas não são lançamento. */
const IGNORAR_RE = /R\$|:|^Gastos referentes ao cart[ãa]o|^Voc[êe] ainda n[ãa]o possui|^--\s*\d+ of \d+/i;
const SALDO_ANTERIOR_RE = /^SALDO ANTERIOR$/i;

export function isFaturaCartaoWeb(texto: string): boolean {
  return (
    /Data Lan[çc]amentos Moeda de Origem Valor \(US\$\) Cota[çc][ãa]o \(US\$\) Valor \(R\$\)/i.test(texto) &&
    /Gastos referentes ao cart[ãa]o: Final \d{4}/i.test(texto) &&
    /Total da fatura \(final/i.test(texto)
  );
}

function vencimento(linhas: string[]): { mes: number; ano: number } | null {
  const i = linhas.findIndex((l) => /^Data de vencimento:?$/i.test(l));
  if (i < 0) return null;
  for (const l of linhas.slice(i + 1, i + 12)) {
    const m = l.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return { mes: Number(m[2]), ano: Number(m[3]) };
  }
  return null;
}

export function parseFaturaCartaoWeb(texto: string, refYear: number = new Date().getFullYear()): ParsedTransaction[] {
  const linhas = texto.split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim());
  const venc = vencimento(linhas);
  const anoVenc = venc?.ano ?? refYear;
  const out: ParsedTransaction[] = [];
  let dentro = false;
  let dia: string | null = null;
  let mes: string | null = null;
  for (const linha of linhas) {
    if (!linha) continue;
    if (FIM_RE.test(linha)) break;
    if (CABECALHO_RE.test(linha)) {
      dentro = true;
      continue;
    }
    if (!dentro) continue;
    const d = linha.match(DIA_RE);
    if (d) {
      dia = d[1].padStart(2, "0");
      mes = null;
      continue;
    }
    if (IGNORAR_RE.test(linha) || !dia) continue;
    const m = linha.match(LANC_RE);
    if (!m) continue;
    if (m[1]) mes = MESES[m[1]];
    if (!mes) continue;
    const descricao = m[2].replace(/(\s+[\d.,]+)+$/, "").trim();
    if (SALDO_ANTERIOR_RE.test(descricao)) continue;
    const magnitude = parseBrazilianNumber(m[4]);
    if (Number.isNaN(magnitude) || magnitude === 0) continue;
    // Compra de mês depois do vencimento (parcela antiga) é do ano anterior.
    const ano = venc && Number(mes) > venc.mes ? anoVenc - 1 : anoVenc;
    out.push({ date: `${ano}-${mes}-${dia}`, description: descricao, amount: m[3] === "-" ? -magnitude : magnitude });
  }
  return out;
}
