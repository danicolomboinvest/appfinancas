import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Fatura do cartão Banrisul em PDF (boleto na 1ª página, transações na 2ª).
 *
 *   Vencimento: 02/10/2026
 *   HISTÓRICO DE TRANSAÇÕES
 *   FULANA - NR. 0000 US$ R$
 *   23/07 LOJAS EXEMPLO FL 433 02/02 269,85
 *   02/09 DEB 0000/00 00000000 -9.332,25        ← a fatura anterior, debitada da conta
 *   TOTAL DE GASTOS 3.534,36
 *
 * O leitor genérico pegava o "VALOR TOTAL" do boleto como compra e somava o débito da fatura
 * anterior (R$ 9 mil) como gasto: uma fatura de R$ 3.534 foi lida como R$ 16.400.
 */

const LINHA_RE = /^(\d{2})\/(\d{2})\s+(.+?)\s+(-?\d{1,3}(?:\.\d{3})*,\d{2})$/;
const VENCIMENTO_RE = /Vencimento:?\s*\n?\s*\d{2}\/(\d{2})\/(\d{4})/i;
// "DEB 0340/35 05647609": débito automático da fatura anterior na conta do Banrisul.
const DEBITO_DA_FATURA_RE = /^DEB\s+\d{4}\/\d+\s+\d+$/i;

export function isBanrisulInvoice(texto: string): boolean {
  return /banrisul/i.test(texto) && /^HIST[ÓO]RICO DE TRANSA[ÇC][ÕO]ES$/im.test(texto) && /^TOTAL DE GASTOS\b/im.test(texto);
}

export function parseBanrisulInvoice(texto: string, refYear: number = new Date().getFullYear()): ParsedTransaction[] {
  const venc = texto.match(VENCIMENTO_RE);
  const mesVenc = venc ? Number(venc[1]) : null;
  const anoVenc = venc ? Number(venc[2]) : refYear;
  const out: ParsedTransaction[] = [];
  let dentro = false;

  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.replace(/\s+/g, " ").trim();
    if (/^HIST[ÓO]RICO DE TRANSA[ÇC][ÕO]ES$/i.test(linha)) {
      dentro = true;
      continue;
    }
    if (!dentro) continue;
    if (/^TOTAL DE GASTOS\b/i.test(linha)) break;
    const m = linha.match(LINHA_RE);
    if (!m) continue;
    const [, dd, mm, descricao, bruto] = m;
    const valor = parseBrazilianNumber(bruto);
    if (!valor) continue;
    const ano = mesVenc !== null && Number(mm) > mesVenc ? anoVenc - 1 : anoVenc;
    // Compra sem sinal (positiva); crédito e pagamento vêm com "-".
    out.push({
      date: `${ano}-${mm}-${dd}`,
      description: DEBITO_DA_FATURA_RE.test(descricao) ? "Pagamento de fatura (débito em conta)" : descricao,
      amount: valor,
    });
  }
  return out;
}
