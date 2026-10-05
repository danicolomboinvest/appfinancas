import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Fatura do Cartão Carrefour (Banco CSF) em PDF.
 *
 *   TOTAL DA SUA FATURA VENCIMENTO LIMITE DE CRÉDITO
 *   R$ 512,57 11/09/2026 R$11.520,00                     ← o ano das compras sai daqui
 *   LANÇAMENTOS NO BRASIL
 *   SALDO FATURA ANTERIOR 870,71                          ← resumo, sem data: ignora
 *   PESSOA EXEMPLO 406166******0000                       ← troca de cartão (titular/virtual)
 *   08/08 CRF 24 TBE TAMBORE - 13/15 18,60               ← parcela 13 de 15
 *   10/08 Pagamento Banco CSF 870,71-                    ← menos DEPOIS do valor = crédito
 *   04/09 Tarifa de Anuidade com desconto -              ← sem valor: ignora
 *   TOTAL DA FATURA R$ 512,57
 *
 * O leitor genérico pegava o boleto, a tabela de juros e o limite de crédito (R$ 11.520 virava
 * um "Lançamento"), e lia o pagamento como compra: R$ 16 mil numa fatura de R$ 512.
 */

const LINHA_RE = /^(\d{2})\/(\d{2})\s+(.+?)\s+(\d{1,3}(?:\.\d{3})*,\d{2})(-)?$/;
const VENCIMENTO_RE = /TOTAL DA SUA FATURA\s+VENCIMENTO[^\n]*\n[^\n]*?(\d{2})\/(\d{2})\/(\d{4})/i;
const INICIO_RE = /^LAN[ÇC]AMENTOS NO (BRASIL|EXTERIOR)\b/i;
const FIM_RE = /^TOTAL DA FATURA\b/i;

export function isCarrefourInvoice(texto: string): boolean {
  return /\bBanco CSF\b/i.test(texto) && /^LAN[ÇC]AMENTOS NO BRASIL/im.test(texto) && /^TOTAL DA FATURA\b/im.test(texto);
}

export function parseCarrefourInvoice(texto: string, refYear: number = new Date().getFullYear()): ParsedTransaction[] {
  // A linha da compra não traz o ano. Compra de mês DEPOIS do vencimento só pode ser do ano
  // anterior (parcela de compra antiga).
  const venc = texto.match(VENCIMENTO_RE);
  const mesVenc = venc ? Number(venc[2]) : null;
  const anoVenc = venc ? Number(venc[3]) : refYear;

  const out: ParsedTransaction[] = [];
  let dentro = false;
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.replace(/\t/g, " ").replace(/\s+/g, " ").trim();
    if (INICIO_RE.test(linha)) {
      dentro = true;
      continue;
    }
    if (FIM_RE.test(linha)) {
      dentro = false;
      continue;
    }
    if (!dentro) continue;
    const m = linha.match(LINHA_RE);
    if (!m) continue;
    const [, dd, mm, descricao, valor, menos] = m;
    const magnitude = parseBrazilianNumber(valor);
    if (Number.isNaN(magnitude) || magnitude === 0) continue;
    const ano = mesVenc !== null && Number(mm) > mesVenc ? anoVenc - 1 : anoVenc;
    // "Pagamento Banco CSF" é o pagamento da fatura anterior: com esse nome vira linha de resumo.
    const nome = /^pagamento\b/i.test(descricao) && menos ? "PAGAMENTO DE FATURA" : descricao.trim();
    out.push({ date: `${ano}-${mm}-${dd}`, description: nome, amount: menos ? -magnitude : magnitude });
  }
  return out;
}
