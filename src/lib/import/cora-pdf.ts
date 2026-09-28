import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Extrato da conta Cora (banco digital PJ) em PDF.
 *
 * A data vem numa linha própria com o saldo do dia, e os lançamentos daquele dia vêm embaixo
 * SEM data, com o sinal e o valor NO COMEÇO da linha:
 *
 *   Cora SCFI - CNPJ 00.000.000/0001-00
 *   25/09/2026   Saldo do dia R$ 0,00                               ← abre o dia
 *   - R$ 1.892,00   Transf Pix enviada   FULANO…   000.000.000-00
 *   + R$ 1.892,00   Transferência recebida   EMPRESA LTDA   00.000.000/0001-00
 *
 * O leitor genérico procura a data no começo de cada lançamento: aqui nenhum lançamento tem
 * data, então o arquivo inteiro (19 linhas com valor) virava zero lançamentos.
 */

const DIA_RE = /^(\d{2})\/(\d{2})\/(\d{4})\s+Saldo do dia\b/i;
const LANC_RE = /^([+-])\s*R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})\s+(.+)$/;
/** CPF/CNPJ do outro lado, no fim da linha: não ajuda a reconhecer o gasto. */
const DOC_RE = /\s+(?:\d{3}\.\d{3}\.\d{3}-\d{2}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|[*•]{3}\.?\d{3}\.?\d{3}-?[*•]{2})\s*$/;

export function isCoraStatement(texto: string): boolean {
  if (!/\bCora SCFI\b|\bCora\b.*Ouvidoria|Extrato gerado no dia/i.test(texto)) return false;
  const linhas = texto.split(/\r?\n/).map((l) => l.replace(/\t/g, " ").trim());
  return linhas.some((l) => DIA_RE.test(l)) && linhas.some((l) => LANC_RE.test(l));
}

export function parseCoraStatement(texto: string): ParsedTransaction[] {
  const out: ParsedTransaction[] = [];
  let data: string | null = null;

  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.replace(/\t/g, " ").replace(/\s+/g, " ").trim();
    const dia = linha.match(DIA_RE);
    if (dia) {
      data = `${dia[3]}-${dia[2]}-${dia[1]}`;
      continue;
    }
    // Antes do primeiro dia só tem o resumo do topo ("Total de entradas + R$ ...").
    if (!data) continue;
    const m = linha.match(LANC_RE);
    if (!m) continue;
    const magnitude = parseBrazilianNumber(m[2]);
    if (Number.isNaN(magnitude) || magnitude === 0) continue;
    const descricao = m[3].replace(DOC_RE, "").trim();
    out.push({ date: data, description: descricao, amount: m[1] === "-" ? -magnitude : magnitude });
  }
  return out;
}
