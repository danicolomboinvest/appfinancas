import { pareceEstorno } from "./estorno";
import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Fatura do cartão C6 Bank em PDF.
 *
 *   Compras e pagamentos feitos até o fechamento desta fatura em 18/09/26.
 *   ...
 *   Transações do cartão principal
 *   C6 Carbon Final 0000 - PESSOA Subtotal deste cartão R$ 118,90
 *   25 ago SMILES CLUBE SMILES 46,00
 *   13 set Estorno Tarifa - Estorno 98,00                            ← estorno, SEM sinal
 *   15 set OPENAI *CHATGPT 42,22<TAB>USD 7,76 | Cotação USD: R$5,44  ← compra em dólar
 *   03 nov LOJA EXEMPLO - Parcela 11/12 666,66                       ← comprada no ano passado
 *   19 ago Inclusao de Pagamento 2.131,00                            ← pagamento, SEM sinal
 *   Formas de pagamento
 *   ... boleto: "VALOR TOTAL 8.542,60", "25/09/2026", "(-) PAGAMENTO MÍNIMO" ...
 *
 * O leitor genérico lia três problemas aqui: o boleto no fim (a fatura inteira entrava de novo
 * como compra, duas vezes, e o pagamento mínimo também), a compra em dólar (pegava a cotação
 * R$ 5,44 em vez dos R$ 42,22) e "00271 SH TERESINA" (o número da loja virava o ano 0027).
 * Uma fatura de R$ 8.542 foi lida como R$ 26.946.
 *
 * Nada na linha diz se é compra ou crédito: estorno e pagamento só se reconhecem pela descrição.
 */

const MESES: Record<string, string> = {
  jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06",
  jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12",
};

const LINHA_RE = /^(\d{2}) (jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez) (.+?) (\d{1,3}(?:\.\d{3})*,\d{2})$/i;
const FECHAMENTO_RE = /fechamento desta fatura em \d{2}\/(\d{2})\/(\d{2})/i;
const INICIO_RE = /^Transa[çc][õo]es do cart[ãa]o/i;
const FIM_RE = /^Formas de pagamento\b/i;
const PAGAMENTO_RE = /\binclus[aã]o de pagamento\b/i;

export function isC6Invoice(texto: string): boolean {
  return /\b(C6 Bank|BANCO C6)\b/i.test(texto) && /Transa[çc][õo]es do cart[ãa]o/i.test(texto);
}

export function parseC6Invoice(texto: string, refYear: number = new Date().getFullYear()): ParsedTransaction[] {
  const fech = texto.match(FECHAMENTO_RE);
  const mesFechamento = fech ? Number(fech[1]) : null;
  const anoFechamento = fech ? 2000 + Number(fech[2]) : refYear;

  const out: ParsedTransaction[] = [];
  let dentro = false;
  for (const bruta of texto.split(/\r?\n/)) {
    // Depois do TAB vem a coluna ao lado: "USD 7,76 | Cotação...", "IOF Transações Exterior".
    const [principal, lado = ""] = bruta.split("\t");
    const linha = principal.replace(/\s+/g, " ").trim();
    if (INICIO_RE.test(linha)) {
      dentro = true;
      continue;
    }
    if (!dentro) continue;
    if (FIM_RE.test(linha)) break;
    const m = linha.match(LINHA_RE);
    if (!m) continue;
    const [, dd, mesNome, descricao, valor] = m;
    const magnitude = parseBrazilianNumber(valor);
    if (Number.isNaN(magnitude) || magnitude === 0) continue;
    const mm = MESES[mesNome.toLowerCase()];
    const ano = mesFechamento !== null && Number(mm) > mesFechamento ? anoFechamento - 1 : anoFechamento;
    const credito = pareceEstorno(descricao) || PAGAMENTO_RE.test(descricao);
    const iof = /^IOF\b/i.test(lado.trim()) && !/\bIOF\b/i.test(descricao);
    out.push({
      date: `${ano}-${mm}-${dd}`,
      description: iof ? `${descricao} - IOF` : descricao,
      amount: credito ? -magnitude : magnitude,
    });
  }
  return out;
}
