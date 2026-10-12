import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Fatura do cartão BTG Pactual (também o cartão EQI, emitido pelo BTG) em PDF.
 *
 *   Daniela Exemplo | fatura de Junho de 2026 | cartão final 0000
 *   Pagamentos feitos pelo cliente
 *   - R$ 16.754,82 <TAB> Pagamento de fatura <TAB> 18 Mai      ← pagamento da anterior: não é lançamento
 *   Lançamentos do cartão físico | Fulana | Final 0000 Total do cartão: R$ 6.190,67
 *   Total de créditos recebidos
 *   - R$ 27,81 <TAB> Cancelamento - Loja <TAB> 08 Jun          ← crédito vem com "-"
 *   Total de compras e despesas
 *   R$ 506,00 <TAB> Hospital Exemplo (4/5) <TAB> 27 Fev         ← valor, nome e data, nessa ordem
 *   US$ 36,00 <TAB> Calendly <TAB> 15 Mai                       ← compra em moeda estrangeira:
 *   Cotação da moeda -                                             a cotação e depois o valor em real
 *   Conversão para Real -                                          vêm sozinhos nas linhas de baixo
 *   R$ 5,27
 *   R$ 190,07
 *   R$ 6.218,48                                                 ← subtotal do cartão: não é lançamento
 *
 * Às vezes dois créditos saem na mesma linha ("- R$ 192,40 <TAB> Cashback Lk <TAB> 16 Ago - R$
 * 192,40 <TAB> Cashback Lk <TAB> 16 Ago"). Nenhum leitor reconhecia o formato: 180 linhas com
 * valor e zero lançamentos.
 */

const MESES: Record<string, string> = {
  jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06",
  jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12",
};
const NOMES_DOS_MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const LANCAMENTO_RE =
  /(-\s*)?(R\$|US\$|[A-Z]{3})\s*(\d{1,3}(?:\.\d{3})*,\d{2})\t([^\t]+?)\t(\d{2}) (Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)\b/g;
const SO_VALOR_RE = /^-?\s*R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})$/;
const FATURA_DE_RE = /\|\s*fatura de (\p{L}+) de (\d{4})\s*\|/iu;

export function isBtgInvoice(texto: string): boolean {
  return /BTG Pactual/i.test(texto) && /^Lan[çc]amentos do cart[ãa]o\b/m.test(texto) && /^Total de compras e despesas\b/m.test(texto);
}

export function parseBtgInvoice(texto: string, refYear: number = new Date().getFullYear()): ParsedTransaction[] {
  const fatura = texto.match(FATURA_DE_RE);
  const mesFatura = fatura ? NOMES_DOS_MESES.indexOf(fatura[1].toLowerCase()) + 1 || null : null;
  const anoFatura = fatura ? Number(fatura[2]) : refYear;
  const out: ParsedTransaction[] = [];
  // Compras em outra moeda esperando o valor em real: a 1ª linha só com "R$" é a cotação, a 2ª o valor.
  const esperando: { txn: ParsedTransaction; linhasDeValor: number }[] = [];

  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.trim();
    const soValor = linha.match(SO_VALOR_RE);
    if (soValor) {
      const pendente = esperando[0];
      if (!pendente) continue; // subtotal do cartão
      pendente.linhasDeValor += 1;
      if (pendente.linhasDeValor === 2) {
        const valor = parseBrazilianNumber(soValor[1]);
        pendente.txn.amount = pendente.txn.amount < 0 ? -valor : valor;
        out.push(pendente.txn);
        esperando.shift();
      }
      continue;
    }
    for (const m of linha.matchAll(LANCAMENTO_RE)) {
      const [, menos, moeda, valorTxt, descricao, dd, mesNome] = m;
      if (/^Pagamento de fatura\b/i.test(descricao.trim())) continue;
      const mm = MESES[mesNome.toLowerCase()];
      // Parcela comprada no ano anterior ("Cativa (10/12) 18 Ago" na fatura de junho).
      const ano = mesFatura !== null && Number(mm) > mesFatura ? anoFatura - 1 : anoFatura;
      const sinal = menos ? -1 : 1;
      const txn: ParsedTransaction = { date: `${ano}-${mm}-${dd}`, description: descricao.trim(), amount: sinal * parseBrazilianNumber(valorTxt) };
      if (moeda === "R$") out.push(txn);
      else esperando.push({ txn, linhasDeValor: 0 });
    }
  }
  return out;
}
