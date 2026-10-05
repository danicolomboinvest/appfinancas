import type { ParsedTransaction } from "./statement-parser";

/**
 * Fatura de cartão de Israel (hebraico, da direita pra esquerda), em shekel:
 *
 *   data da compra | nome do estabelecimento | valor da compra | valor da cobrança | nº do comprovante | detalhe
 *   28.09.26         HOT                        ₪89.00            ₪89.00              208022206           (ordem de débito fixo)
 *
 * Datas "DD.MM.AA", valor com ₪ e PONTO decimal ("₪1,279.35"). O PDF sai com as colunas em ordem
 * invertida e as palavras em hebraico às vezes embaralhadas, então o leitor não depende da ordem
 * nem de entender o hebraico: pega a data, os valores com ₪ e o que sobra como descrição.
 * Quando a compra tem desconto e a cobrança é ₪0,00 (taxa do cartão perdoada), não é gasto.
 */

const DATA_RE = /\b(\d{2})\.(\d{2})\.(\d{2})\b/;
const VALOR_RE = /₪\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)|(\d{1,3}(?:,\d{3})*\.\d{2})\s*₪/g;
const HEBRAICO_RE = /[֐-׿]/;
/** Observações da última coluna (débito fixo, site do exterior, desconto): não são o nome da loja. */
const OBSERVACOES = ["הוראת קבע", "אתר חו\"ל", "אתר חו״ל", "הנחה"];

export function isIsraelCardStatement(texto: string): boolean {
  if (!texto.includes("₪") || !HEBRAICO_RE.test(texto)) return false;
  const linhas = texto.split(/\r?\n/).filter((l) => DATA_RE.test(l) && l.includes("₪"));
  return linhas.length >= 3;
}

function numero(bruto: string): number {
  return Number(bruto.replace(/,/g, ""));
}

export function parseIsraelCardStatement(texto: string): ParsedTransaction[] {
  const out: ParsedTransaction[] = [];
  for (const linha of texto.split(/\r?\n/)) {
    const data = linha.match(DATA_RE);
    if (!data || !linha.includes("₪")) continue;
    const valores = [...linha.matchAll(VALOR_RE)].map((m) => numero(m[1] ?? m[2]));
    if (valores.length === 0) continue;
    // Compra e cobrança iguais na maioria; se diferirem, vale a cobrança (a menor, na ordem em que o PDF sair).
    const cobrado = Math.min(...valores.slice(0, 2));
    if (!(cobrado > 0)) continue;
    let descricao = linha.replace(DATA_RE, " ").replace(VALOR_RE, " ").replace(/\b\d{6,}\b/g, " ");
    for (const o of OBSERVACOES) descricao = descricao.split(o).join(" ");
    descricao = descricao.replace(/\s+/g, " ").trim();
    out.push({
      date: `20${data[3]}-${data[2]}-${data[1]}`,
      description: descricao || "Lançamento",
      amount: cobrado,
    });
  }
  return out;
}
