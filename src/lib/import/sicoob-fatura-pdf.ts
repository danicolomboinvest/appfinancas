import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Fatura do cartão Sicoob (Sicoobcard Mastercard) em PDF.
 *
 *   LANÇAMENTOS - SICOOB MASTERCARD GOLD PRO
 *   MOVIMENTAÇÕES DA CONTA
 *   SALDO ANTERIOR R$ 211,83
 *   06 ABR PAGAMENTO DEBITO EM                     ← a descrição quebra e o valor desce
 *   CONTA -R$ 211,83                               ← pagamento da anterior: não é lançamento
 *   23 ABR ANUIDADE MASTERCARD
 *   (1962) 02/12 R$ 9,90
 *   23 ABR DESC ANUIDADE USO
 *   MASTER -R$ 9,90                                ← crédito vem com "-"
 *   DATA DESCRIÇÃO CIDADE VALOR EM R$
 *   FULANA DE TAL 1962                             ← portador e final do cartão
 *   07 ABR 0697 IMBUI 01/04 SALVADOR R$ 55,05
 *   22 JUN ANTHROPIC* CLAUDE SU SAN FRANCISCO
 *   R$ 110,00 U$ 21,40                             ← compra em dólar: o valor em real vem
 *   V.DOL 5,1395 R$ 110,00                            duas vezes, conta uma
 *   TOTAL DE FULANA R$ 715,69
 *   Veja como você usou seu Sicoob Mastercard...   ← fim (depois vem o gasto por categoria)
 *
 * O leitor genérico pegava o "PAGAMENTO MÍNIMO" da 1ª página como gasto, o pagamento da fatura
 * anterior (que vem duas vezes: débito em conta e boleto) como gasto, tratava "0697" como ano e
 * gravava só a cidade como descrição: uma fatura de R$ 426,27 em compras era lida como R$ 977,81.
 */

const MESES: Record<string, string> = {
  JAN: "01", FEV: "02", MAR: "03", ABR: "04", MAI: "05", JUN: "06",
  JUL: "07", AGO: "08", SET: "09", OUT: "10", NOV: "11", DEZ: "12",
};

const INICIO_RE = /^(\d{2}) (JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ) (.*)$/;
const VALOR_NO_FIM_RE = /^(.*?)\s*(-?)R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})$/;
const FECHAMENTO_RE = /DATA DE FECHAMENTO DA FATURA \d{2}\/(\d{2})\/(\d{4})/;
const PAGAMENTO_RE = /^PAGAMENTO[\s-]+(?:DEBITO EM CONTA|BOLETO BANCARIO)\b/;
/** Cabeçalho e rodapé de página no meio dos lançamentos. */
const QUEBRA_DE_PAGINA_RE = /^(?:de \d+\s+P[áa]gina \d+|-- \d+ of \d+ --|REF \d+ [A-Z]{3} A \d+ [A-Z]{3})$/;

export function isSicoobInvoice(texto: string): boolean {
  return /^LAN[ÇC]AMENTOS - SICOOB\b/m.test(texto) && /^RESUMO DA FATURA$/m.test(texto);
}

export function parseSicoobInvoice(texto: string, refYear: number = new Date().getFullYear()): ParsedTransaction[] {
  const fech = texto.match(FECHAMENTO_RE);
  const mesFech = fech ? Number(fech[1]) : null;
  const anoFech = fech ? Number(fech[2]) : refYear;
  const out: ParsedTransaction[] = [];
  let atual: { date: string; partes: string[] } | null = null;
  let dentro = false;

  const fechar = (trecho: string): boolean => {
    const m = trecho.match(VALOR_NO_FIM_RE);
    if (!m || !atual) return false;
    const descricao =
      [...atual.partes, m[1]]
        .join(" ")
        .replace(/\bR\$\s*[\d.]+,\d{2}\s+U\$\s*[\d.]+,\d{2}/g, "")
        .replace(/\bV\.DOL\s+[\d.,]+/g, "")
        .replace(/\s+/g, " ")
        .trim() || "Lançamento";
    const valor = parseBrazilianNumber(m[3]);
    if (valor && !PAGAMENTO_RE.test(descricao)) {
      out.push({ date: atual.date, description: descricao, amount: m[2] === "-" ? -valor : valor });
    }
    atual = null;
    return true;
  };

  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.replace(/\s+/g, " ").trim();
    if (!linha) continue;
    if (/^LAN[ÇC]AMENTOS - SICOOB\b/.test(linha)) {
      dentro = true;
      continue;
    }
    if (!dentro) continue;
    if (/^Veja como voc[êe] usou/i.test(linha)) {
      dentro = false;
      atual = null;
      continue;
    }
    const inicio = linha.match(INICIO_RE);
    if (inicio) {
      const [, dd, mesNome, resto] = inicio;
      const mm = MESES[mesNome];
      // Parcela comprada antes da virada do ano (anuidade "01 DEZ" na fatura de outubro).
      const ano = mesFech !== null && Number(mm) > mesFech ? anoFech - 1 : anoFech;
      atual = { date: `${ano}-${mm}-${dd}`, partes: [] };
      if (!fechar(resto)) atual.partes.push(resto);
      continue;
    }
    if (!atual || QUEBRA_DE_PAGINA_RE.test(linha)) continue;
    if (/^(TOTAL\b|DATA DESCRI)/.test(linha) || atual.partes.length >= 3) {
      atual = null;
      continue;
    }
    if (!fechar(linha)) atual.partes.push(linha);
  }
  return out;
}
