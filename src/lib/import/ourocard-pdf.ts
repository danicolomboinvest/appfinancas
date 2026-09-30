import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Fatura do cartão Ourocard (Banco do Brasil) em PDF.
 *
 *   Fatura fechada em 21/09/2026
 *   Lançamentos nesta fatura
 *   SALDO FATURA ANTERIOR BR R$ 800,00
 *   Pagamentos/Créditos
 *   28/08 PGTO. CASH AG. 0000 000000000 200 BR R$ -800,00     ← pagamento: menos DEPOIS do R$
 *   21/09 IFD*RESTAURANTE EXEMPLO BR R$ -4,99                  ← estorno
 *   Restaurantes
 *   15/09 IFD*RESTAURANTE EXEMPLO BR R$ 22,57                  ← compra: sem sinal
 *   Compras parceladas
 *   11/12 LOJA EXEMPLO PARC 10/10 SAO JOSE DOS BR R$ 164,00    ← comprada no ano passado
 *   Total da Fatura R$ 182,56
 *
 * O leitor genérico só via o menos quando vinha ANTES do "R$". Aqui ele vem depois, e sem sinal
 * nenhum a compra também sai negativa: pagamento, estorno e compra ficavam com o mesmo sinal e o
 * pagamento da fatura anterior entrava como mais uma compra. Uma fatura de R$ 2.786 apareceu com
 * R$ 13.362 de gastos.
 *
 * Aqui a compra sai POSITIVA e pagamento/estorno NEGATIVO; quem importa a fatura decide pelo
 * sinal da maioria (ver `comprasDaFaturaSaoPositivas`) e o pagamento sai como linha de resumo.
 */

const LINHA_RE = /^(\d{2})\/(\d{2})\s+(.+?)\s+R\$\s*(-)?\s*(\d{1,3}(?:\.\d{3})*,\d{2})$/;
/**
 * O outro layout do BB (visto no cartão Smiles): descrição ANTES da data, depois o país (ou a
 * agência, no pagamento) e o menos DEPOIS do valor.
 *   CARAMELO RESTAURANTE CIDADE <TAB> 31/08 BR R$ 23,00
 *   PGTO. CASH AG. 0000 000000000 200 <TAB> 08/09 10 R$ 800,00-
 */
const LINHA_DATA_NO_MEIO_RE = /^(.+?)\s+(\d{2})\/(\d{2})\s+\S{2}\s+R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})(-)?$/;
// "Fatura fechada em 21/09/2026", ou o rótulo numa coluna e as datas noutra, logo abaixo.
const FECHADA_RE = /Fatura fechada em[\s\S]{0,120}?\d{2}\/(\d{2})\/(\d{4})/i;
const INICIO_RE = /^Lan[çc]amentos nesta fatura/i;
// "Parcelamentos Próxima Fatura" lista parcelas que só vencem no mês que vem.
const FIM_RE = /^(Total da Fatura|Subtotal|Parcelamentos Pr[óo]xima Fatura)\b/i;

export function isOurocardInvoice(texto: string): boolean {
  return /\bOUROCARD\b/i.test(texto) && /Lan[çc]amentos nesta fatura/i.test(texto);
}

export function parseOurocardInvoice(texto: string, refYear: number = new Date().getFullYear()): ParsedTransaction[] {
  // A fatura não traz o ano de cada compra. O fechamento traz: compra de um mês DEPOIS do mês do
  // fechamento só pode ser do ano anterior (parcela de compra antiga).
  const fechada = texto.match(FECHADA_RE);
  const mesFechamento = fechada ? Number(fechada[1]) : null;
  const anoFechamento = fechada ? Number(fechada[2]) : refYear;

  const out: ParsedTransaction[] = [];
  let dentro = false;
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.replace(/\t/g, " ").replace(/\s+/g, " ").trim();
    if (INICIO_RE.test(linha)) {
      dentro = true;
      continue;
    }
    if (!dentro) continue;
    if (FIM_RE.test(linha)) break;
    const m = linha.match(LINHA_RE);
    const n = m ? null : linha.match(LINHA_DATA_NO_MEIO_RE);
    if (!m && !n) continue;
    const [dd, mm, descricao, menos, valor] = m ? m.slice(1) : [n![2], n![3], n![1], n![5], n![4]];
    const magnitude = parseBrazilianNumber(valor);
    if (Number.isNaN(magnitude) || magnitude === 0) continue;
    const ano = mesFechamento !== null && Number(mm) > mesFechamento ? anoFechamento - 1 : anoFechamento;
    out.push({
      date: `${ano}-${mm}-${dd}`,
      description: descricao.replace(/\s+BR$/, "").trim(),
      amount: menos ? -magnitude : magnitude,
    });
  }
  return out;
}
