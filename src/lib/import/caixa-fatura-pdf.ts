import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Fatura dos Cartões Caixa em PDF.
 *
 *   VENCIMENTO
 *   17/09/2026
 *   ...                                                  ← boleto, simulação de parcelamento, limites
 *   Demonstrativo
 *   07/08 TOTAL DA FATURA ANTERIOR 1.810,54D             ← resumo, não é compra
 *   10/08 OBRIGADO PELO PAGAMENTO 1.810,54C              ← pagamento da anterior
 *   17/08 AJUSTE CREDITO PARC. LOJISTAA 0,05C            ← crédito de verdade
 *   14/08 LOJA EXEMPLO Rio de Janeir 228,74D
 *   23/01 LOJA PARCELADA 08 DE 12 Baureri 55,00D         ← parcela desta fatura (compra antiga)
 *   Total COMPRAS PARCELADAS 1.721,10D
 *   Valor total desta fatura R$ 1.949,71 D               ← fim
 *
 * O leitor genérico pegava a data de vencimento do boleto com o valor da fatura e o "DESPESAS A
 * VENCER" das próximas faturas como se fossem compras: uma fatura de R$ 1.949 foi lida como R$ 8.990.
 */

const LINHA_RE = /^(\d{2})\/(\d{2})\s+(.+?)\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*([DC])$/;
// Anuidade vem sem data, na seção "ANUIDADE" antes das compras: "ANUIDADE DIFERENCIADA TIT 04/ 12 17,25D".
const ANUIDADE_RE = /^(ANUIDADE\b.*?)\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*([DC])$/i;
const FECHAMENTO_RE = /^FT (\d{2})\/(\d{2})\/(\d{4})/m;
const VENCIMENTO_RE = /^VENCIMENTO\s*\n\s*(\d{2})\/(\d{2})\/(\d{4})/m;
const FORA_RE = /^(TOTAL DA FATURA ANTERIOR|OBRIGADO PELO PAGAMENTO|PAGAMENTO\b)/i;

export function isCaixaInvoice(texto: string): boolean {
  return /CART[ÕO]ES CAIXA/i.test(texto) && /^Demonstrativo\s*$/m.test(texto) && /^Valor total desta fatura\b/im.test(texto);
}

export function parseCaixaInvoice(texto: string, refYear: number = new Date().getFullYear()): ParsedTransaction[] {
  const venc = texto.match(VENCIMENTO_RE);
  const mesVenc = venc ? Number(venc[2]) : null;
  const anoVenc = venc ? Number(venc[3]) : refYear;
  const out: ParsedTransaction[] = [];
  let dentro = false;
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.replace(/\s+/g, " ").trim();
    if (/^Demonstrativo$/i.test(linha)) {
      dentro = true;
      continue;
    }
    if (!dentro) continue;
    // Só depois do demonstrativo: o topo da fatura também diz "VALOR TOTAL DESTA FATURA".
    if (/^Valor total desta fatura\b/i.test(linha)) break;
    const anuidade = linha.match(ANUIDADE_RE);
    if (anuidade) {
      const valor = parseBrazilianNumber(anuidade[2]);
      const fech = texto.match(FECHAMENTO_RE);
      const data = fech ? `${fech[3]}-${fech[2]}-${fech[1]}` : venc ? `${venc[3]}-${venc[2]}-${venc[1]}` : null;
      if (valor > 0 && data) {
        out.push({ date: data, description: anuidade[1].replace(/\s+(\d{2})\/\s*(\d{2})$/, " $1/$2"), amount: anuidade[3].toUpperCase() === "C" ? -valor : valor });
      }
      continue;
    }
    const m = linha.match(LINHA_RE);
    if (!m) continue;
    const [, dd, mm, descricao, valor, dc] = m;
    if (FORA_RE.test(descricao)) continue;
    const magnitude = parseBrazilianNumber(valor);
    if (!(magnitude > 0)) continue;
    // Parcela de compra antiga traz a data da compra: mês depois do vencimento é do ano anterior.
    const ano = mesVenc !== null && Number(mm) > mesVenc ? anoVenc - 1 : anoVenc;
    out.push({ date: `${ano}-${mm}-${dd}`, description: descricao, amount: dc === "C" ? -magnitude : magnitude });
  }
  return out;
}
