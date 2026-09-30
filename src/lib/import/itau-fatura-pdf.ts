import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Fatura do cartão Itaú em PDF.
 *
 *   Emissão: 26/09/2026
 *   Pagamentos efetuados
 *   04/09 Pagamento via conta -1.000,00                  ← pagamento da fatura anterior
 *   Lançamentos: compras e saques
 *   09/06 LOJA EXEMPLO 04/06 99,99                        ← parcela cobrada NESTA fatura
 *   outros SAO PAULO                                      ← categoria + cidade: ignora
 *   Lançamentos internacionais
 *   29/08 FARMACIA EXEMPLO 12,12                          ← o valor da linha já é em R$
 *   26,00 BOB 2,20                                        ← moeda de origem e dólar: ignora
 *   Repasse de IOF em R$ 0,67                             ← cobrança de verdade, sem data
 *   Total dos lançamentos atuais 9.741,14
 *   Compras parceladas - próximas faturas                 ← NÃO é desta fatura
 *   09/06 LOJA EXEMPLO 05/06 99,99
 *
 * O leitor genérico pegava toda linha com data e valor: o quadro "Compras parceladas - próximas
 * faturas", que só avisa o que VAI ser cobrado, entrava como gasto deste mês — numa fatura de
 * R$ 9.741, R$ 2.662 a mais, e a mesma parcela de novo na fatura seguinte. E o "Repasse de IOF"
 * das compras no exterior, que não tem data, ficava de fora.
 *
 * Compra sai POSITIVA e pagamento/estorno NEGATIVO; o pagamento sai como linha de resumo
 * (ver `isFaturaSummaryLine`).
 */

const LINHA_RE = /^(\d{2})\/(\d{2})\s+(.+?)\s+(-)?\s?(\d{1,3}(?:\.\d{3})*,\d{2})$/;
const EMISSAO_RE = /(?:Emiss[ãa]o|Postagem):\s*(\d{2})\/(\d{2})\/(\d{4})/i;
const INICIO_RE = /^(Pagamentos efetuados|Lan[çc]amentos:\s*compras e saques|Lan[çc]amentos internacionais|Lan[çc]amentos:\s*produtos e servi[çc]os)\b/i;
const FIM_RE = /^(Total dos lan[çc]amentos atuais|Compras parceladas\s*-\s*pr[óo]ximas faturas)\b/i;
const IOF_RE = /^Repasse de IOF em R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})$/i;

export function isItauInvoice(texto: string): boolean {
  return (
    /\bita[uú](?![a-z])/i.test(texto) &&
    /Lan[çc]amentos:\s*compras e saques/i.test(texto) &&
    /Total dos lan[çc]amentos atuais/i.test(texto)
  );
}

export function parseItauInvoice(texto: string, refYear: number = new Date().getFullYear()): ParsedTransaction[] {
  // A fatura não traz o ano de cada compra. A emissão traz: compra de um mês DEPOIS do mês da
  // emissão só pode ser do ano anterior (parcela de compra antiga).
  const emissao = texto.match(EMISSAO_RE);
  const mesEmissao = emissao ? Number(emissao[2]) : null;
  const anoEmissao = emissao ? Number(emissao[3]) : refYear;

  const out: ParsedTransaction[] = [];
  let dentro = false;
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.replace(/\t/g, " ").replace(/\s+/g, " ").trim();
    if (FIM_RE.test(linha)) break;
    if (INICIO_RE.test(linha)) {
      dentro = true;
      continue;
    }
    if (!dentro) continue;

    const iof = linha.match(IOF_RE);
    if (iof) {
      const valor = parseBrazilianNumber(iof[1]);
      // Sem data própria: cai no dia da emissão (ou no da última compra, se a emissão sumiu).
      const data = emissao ? `${emissao[3]}-${emissao[2]}-${emissao[1]}` : out.at(-1)?.date;
      if (data && valor > 0) out.push({ date: data, description: "Repasse de IOF (compras no exterior)", amount: valor });
      continue;
    }

    const m = linha.match(LINHA_RE);
    if (!m) continue;
    const [, dd, mm, descricao, menos, valor] = m;
    const magnitude = parseBrazilianNumber(valor);
    if (Number.isNaN(magnitude) || magnitude === 0) continue;
    const ano = mesEmissao !== null && Number(mm) > mesEmissao ? anoEmissao - 1 : anoEmissao;
    out.push({ date: `${ano}-${mm}-${dd}`, description: descricao.trim(), amount: menos ? -magnitude : magnitude });
  }
  return out;
}
