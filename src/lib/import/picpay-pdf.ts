import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Extrato da conta PicPay em PDF.
 *
 *   Extrato de conta
 *   25 de setembro 2026 Saldo ao final do dia: R$ 0,22          ← um cabeçalho por dia
 *   Hora Tipo Valor Origem / Destino Forma de pagamento
 *   21:36 Pix enviado −R$ 756,34 <TAB> FULANA DE TAL Com cartão   ← o sinal vem no valor (− ou +)
 *   17:39 Pix enviado −R$ 19,16 <TAB>                              ← o nome pode quebrar em várias
 *   <TAB> Beltrana Dos                                               linhas
 *   Santos Com cartão
 *
 * O leitor genérico não entendia a data por extenso nem o "−" tipográfico: 0 de 70 linhas (04/10/2026).
 * O "Saldo ao final do dia" é saldo, não lançamento.
 */

const MESES: Record<string, string> = {
  janeiro: "01", fevereiro: "02", marco: "03", março: "03", abril: "04", maio: "05", junho: "06",
  julho: "07", agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12",
};

const DIA_RE = /^(\d{1,2}) de ([a-zç]+) (\d{4})\b.*saldo ao final do dia/i;
const LINHA_RE = /^(\d{2}:\d{2})\s+(.+?)\s+([−–+-])\s*R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})\s*(.*)$/;
const FORMA_RE = /\s*\bCom (?:cart[ãa]o|saldo|pix|boleto|cr[ée]dito|d[ée]bito)\b.*$/i;
const RODAPE_RE = /^(Documento emitido|D[úu]vidas\?|\d+ de \d+\b|--\s*\d+ of \d+)/i;

export function isPicPayStatement(texto: string): boolean {
  return /PicPay/i.test(texto) && /saldo ao final do dia/i.test(texto) && /Hora\s+Tipo\s+Valor/i.test(texto);
}

export function parsePicPayStatement(texto: string): ParsedTransaction[] {
  const out: ParsedTransaction[] = [];
  let data: string | null = null;
  let aberto: { index: number } | null = null;
  let rodape = false;
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.replace(/\s+/g, " ").trim();
    if (!linha) continue;
    const dia = linha.match(DIA_RE);
    if (dia) {
      const mes = MESES[dia[2].toLowerCase()];
      data = mes ? `${dia[3]}-${mes}-${dia[1].padStart(2, "0")}` : null;
      aberto = null;
      rodape = false;
      continue;
    }
    if (RODAPE_RE.test(linha)) {
      aberto = null;
      rodape = true;
      continue;
    }
    const m = linha.match(LINHA_RE);
    if (m) {
      rodape = false;
      if (!data) continue;
      const valor = parseBrazilianNumber(m[4]);
      const sinal = m[3] === "+" ? 1 : -1;
      const destino = m[5].replace(FORMA_RE, "").trim();
      out.push({ date: data, description: [m[2], destino].filter(Boolean).join(" "), amount: sinal * valor });
      aberto = { index: out.length - 1 };
      continue;
    }
    if (rodape || !aberto || /^Hora Tipo Valor/i.test(linha)) continue;
    // Continuação do nome (o destino quebrou de linha).
    const atual = out[aberto.index];
    atual.description = `${atual.description} ${linha.replace(FORMA_RE, "")}`.replace(/\s+/g, " ").trim();
  }
  return out;
}
