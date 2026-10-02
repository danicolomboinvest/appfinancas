import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Fatura do cartão PicPay em PDF.
 *
 *   15/09/2026 | 09/09/2026	Vencimento: Fechamento:
 *   Data Estabelecimento Valor (R$)
 *   08/08 ASSINATURA 11,99
 *   07/08 CRED COMPRA PARC                ← descrição quebra, o valor desce
 *   CONTESTADA -111,00                    ← crédito vem COM sinal
 *   14/08 PAGAMENTO DE FATURA -1.629,66
 *   Transações Internacionais
 *   15/08 PAYU*AR*UBER
 *   Peso argentino: 5.173,00              ← valor na moeda de lá: não é o que foi cobrado
 *   Câmbio do dia: R$ 5,48
 *   3,69 20,23                            ← US$ e R$: o cobrado é o último
 *   Subtotal dos lançamentos 196,89
 *   Total geral dos lançamentos 1.728,00
 *
 * O leitor genérico somava o "Peso argentino: 32.211,00" como compra e invertia o sinal de tudo:
 * uma fatura de R$ 1.506 virou R$ 180 mil.
 */

const DATA_RE = /^(\d{2})\/(\d{2})\s+(.*)$/;
const VALOR = String.raw`-?\d{1,3}(?:\.\d{3})*,\d{2}`;
const VALOR_NO_FIM_RE = new RegExp(`^(.*?)\\s*(${VALOR})$`);
const DOIS_VALORES_RE = new RegExp(`^${VALOR}\\s+(${VALOR})$`);
const FECHAMENTO_RE = /\d{2}\/\d{2}\/\d{4}\s*\|\s*\d{2}\/(\d{2})\/(\d{4})\s+Vencimento:\s*Fechamento:/i;
const IGNORAR_RE = /^(Peso|D[óo]lar|Euro|Libra)\b[^:]*:|^C[âa]mbio do dia:|^Subtotal\b|^Data Estabelecimento\b|^Transa[çc][õo]es\b|^Picpay Card\b/i;

export function isPicPayInvoice(texto: string): boolean {
  return /picpay/i.test(texto) && /^Total geral dos lan[çc]amentos\b/im.test(texto) && /^Data Estabelecimento\b/im.test(texto);
}

export function parsePicPayInvoice(texto: string, refYear: number = new Date().getFullYear()): ParsedTransaction[] {
  const fech = texto.match(FECHAMENTO_RE);
  const mesFechamento = fech ? Number(fech[1]) : null;
  const anoFechamento = fech ? Number(fech[2]) : refYear;
  const out: ParsedTransaction[] = [];
  let atual: { date: string; partes: string[] } | null = null;

  const lancar = (resto: string, bruto: string) => {
    if (!atual) return;
    const descricao = [...atual.partes, resto].join(" ").replace(/\s+/g, " ").trim() || "Lançamento";
    const valor = parseBrazilianNumber(bruto);
    // Na fatura do PicPay a compra vem sem sinal e o crédito (estorno, pagamento) com "-".
    if (valor) out.push({ date: atual.date, description: descricao, amount: valor });
    atual = null;
  };

  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.replace(/\s+/g, " ").trim();
    if (!linha) continue;
    if (/^Total geral dos lan[çc]amentos\b/i.test(linha)) break;
    if (IGNORAR_RE.test(linha)) continue;

    const data = linha.match(DATA_RE);
    if (data) {
      const [, dd, mm, resto] = data;
      const ano = mesFechamento !== null && Number(mm) > mesFechamento ? anoFechamento - 1 : anoFechamento;
      atual = { date: `${ano}-${mm}-${dd}`, partes: [] };
      const noFim = resto.match(VALOR_NO_FIM_RE);
      if (noFim && noFim[1]) lancar(noFim[1], noFim[2]);
      else atual.partes.push(resto);
      continue;
    }
    if (!atual) continue;
    const dois = linha.match(DOIS_VALORES_RE);
    if (dois) {
      lancar("", dois[1]);
      continue;
    }
    const noFim = linha.match(VALOR_NO_FIM_RE);
    if (noFim) {
      lancar(noFim[1], noFim[2]);
      continue;
    }
    if (atual.partes.length < 2) atual.partes.push(linha);
    else atual = null;
  }
  return out;
}
