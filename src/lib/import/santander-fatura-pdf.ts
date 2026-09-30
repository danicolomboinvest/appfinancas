import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Fatura do cartão Santander em PDF (o layout com "Detalhamento da Fatura").
 *
 *   Olá, Pessoa! Esta é a fatura do seu cartão ... realizados até 21/09.
 *   Vencimento
 *   26/09/2026
 *   Detalhamento da Fatura
 *   Pagamento e Demais Créditos
 *   Compra Data Descrição <TAB> Parcela <TAB> R$ <TAB> US$
 *   23/08 PAGAMENTO DE FATURA-INTERNET <TAB> -135,42
 *   31/08 LOJA EXEMPLO <TAB> -72,75                       ← estorno: menos na frente
 *   Parcelamentos
 *   1 <TAB> 31/12 LOJA EXEMPLO <TAB> 09/10 <TAB> 21,99      ← "1" = categoria; 09/10 = parcela
 *   Despesas
 *   3 <TAB> 19/08 FARMACIA EXEMPLO <TAB> 20,99             ← compra: sem sinal
 *   Resumo da Fatura
 *   (+) Total Despesas/Débitos no Brasil <TAB> 1.183,02
 *
 * O leitor genérico devolvia compra e estorno com o MESMO sinal: os R$ 565 de estornos de uma
 * fatura entravam como mais compra, e a fatura de R$ 617 apareceu com R$ 1.748 de gastos. Aqui a
 * compra sai positiva e o que tem o menos (pagamento, estorno) sai negativo.
 */

const VALOR = String.raw`-?\d{1,3}(?:\.\d{3})*,\d{2}`;
const LINHA_RE = new RegExp(
  String.raw`^(?:\d\s+)?(\d{2})\/(\d{2})\s+(.+?)(?:\s+(\d{2}\/\d{2}))?\s+(${VALOR})(?:\s+${VALOR})?$`,
);
const ATE_RE = /realizad[oa]s\s+at[ée]\s+(\d{2})\/(\d{2})/i;
const VENCIMENTO_RE = /Vencimento\s+\d{2}\/(\d{2})\/(\d{4})/i;
const INICIO_RE = /^Detalhamento da Fatura/i;
const FIM_RE = /^Resumo da Fatura/i;

export function isSantanderInvoice(texto: string): boolean {
  return /\bSantander\b/i.test(texto) && /Detalhamento da Fatura/i.test(texto) && /Resumo da Fatura/i.test(texto);
}

export function parseSantanderInvoice(texto: string, refYear: number = new Date().getFullYear()): ParsedTransaction[] {
  // A linha só traz dia/mês. O fechamento ("realizados até 21/09") dá o mês; o ano vem do
  // vencimento, que pode já estar no ano seguinte (fecha em dezembro, vence em janeiro).
  const ate = texto.match(ATE_RE);
  const venc = texto.match(VENCIMENTO_RE);
  const mesFechamento = ate ? Number(ate[2]) : null;
  let anoFechamento = venc ? Number(venc[2]) : refYear;
  if (venc && mesFechamento !== null && mesFechamento > Number(venc[1])) anoFechamento -= 1;

  const out: ParsedTransaction[] = [];
  let dentro = false;
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.replace(/\t/g, " ").replace(/\s+/g, " ").trim();
    if (INICIO_RE.test(linha)) {
      dentro = true;
      continue;
    }
    if (!dentro) continue;
    if (FIM_RE.test(linha)) {
      dentro = false;
      continue;
    }
    const m = linha.match(LINHA_RE);
    if (!m) continue;
    const [, dd, mm, descricao, parcela, valor] = m;
    const amount = parseBrazilianNumber(valor);
    if (Number.isNaN(amount) || amount === 0) continue;
    const ano = mesFechamento !== null && Number(mm) > mesFechamento ? anoFechamento - 1 : anoFechamento;
    out.push({
      date: `${ano}-${mm}-${dd}`,
      description: parcela ? `${descricao} ${parcela}` : descricao,
      // O PDF imprime a compra sem sinal e o crédito com menos: a compra sai positiva.
      amount,
    });
  }
  return out;
}
