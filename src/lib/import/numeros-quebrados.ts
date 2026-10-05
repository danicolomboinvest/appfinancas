import type { ParsedTransaction } from "./statement-parser";

/**
 * PDF em que a extração abre espaço no meio de números ("2.30 9,02", "53 ,90", "04/ 08").
 * Começou na fatura do Itaú; o leitor inteligente usa o mesmo remendo como uma das chaves que
 * ele testa.
 */
const DATA_QUEBRADA_RE = /(?<![\d/])(\d) ?(\d) ?\/ ?(\d) ?(\d)(?!\d)/g;
/** Valor com espaço perdido no meio. Termina nos 2 centavos, seguido de fim, de texto ou de outra data. */
const VALOR_QUEBRADO_RE = /(?<![\d.,/])((?:0(?= ?,)|[1-9])(?: ?[\d.])*? ?, ?\d ?\d)(?=$|[^\d ]| [^\d]| \d\d\/)/g;
const VALOR_INTEIRO_RE = /^\d{1,3}(?:\.\d{3})*,\d{2}$/;

export function remendarNumeros(linha: string): string {
  return linha
    .replace(DATA_QUEBRADA_RE, "$1$2/$3$4")
    .replace(VALOR_QUEBRADO_RE, (trecho) => {
      const junto = trecho.replace(/ /g, "");
      return VALOR_INTEIRO_RE.test(junto) ? junto : trecho;
    });
}

const semEspacos = (texto: string) => texto.replace(/[ \t]+/g, "");

/**
 * A mesma compra parcelada duas vezes no arquivo — "02/05" (desta fatura) e "03/05" (do quadro
 * das próximas), mesma data, mesmo valor: a parcela seguinte não é deste mês. "Mesmo valor" com
 * folga de centavos: o banco arredonda uma parcela diferente da outra (232,34 e depois 232,33).
 * `qualquerDescricao`: o quadro das próximas faturas escreve a MESMA compra de outro jeito
 * ("Parcela de compra lojista - Parc.6/10 ... MLP EPOCA" e "MLP EPOCA COSMETICOS K Parc. 7/10"):
 * aí valem só a data, o valor e a parcela seguinte do mesmo total.
 */
export function semParcelaSeguinte(txns: ParsedTransaction[], qualquerDescricao = false): ParsedTransaction[] {
  // "LOJA 02/05", "Loja - Parcela 2/5", "LOJA PARC 02/05 CIDADE", "Loja Parcela 2 de 5": a ÚLTIMA
  // parcela escrita na descrição; o resto (sem espaço, sem caixa) identifica a compra.
  const PARCELA_RE = /(\d{1,2})\s*(?:\/|\bde\b)\s*(\d{1,2})(?!.*\d{1,2}\s*(?:\/|\bde\b)\s*\d{1,2})/i;
  const chave = (t: ParsedTransaction) => {
    const junto = semEspacos(t.description);
    const m = junto.match(PARCELA_RE);
    if (!m || m.index === undefined) return null;
    const base = (junto.slice(0, m.index) + junto.slice(m.index + m[0].length)).toLowerCase();
    return { base, n: Number(m[1]), de: Number(m[2]) };
  };
  const chaves = txns.map(chave);
  return txns.filter((t, i) => {
    const p = chaves[i];
    if (!p || p.n < 2 || p.n > p.de) return true;
    return !txns.some((o, j) => {
      const q = j !== i ? chaves[j] : null;
      return q && o.date === t.date && Math.abs(o.amount - t.amount) <= 0.05 && (qualquerDescricao || q.base === p.base) && q.de === p.de && q.n === p.n - 1;
    });
  });
}
