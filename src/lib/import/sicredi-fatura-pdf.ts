import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Fatura do cartão Sicredi em PDF.
 *
 *   Vencimento 10/09/2026
 *   Data e hora Cidade Compra Descrição Parcela Valor em Dolar ... Valor em reais
 *   17/ago 06:15 Sao Paulo Online Apple Com/bill R$ 14,99
 *   17/ago 23:10 Iof Complementar S/ Saldo Ro-       ← a descrição quebra e o valor desce
 *   tativo R$ 0,21
 *   10/ago 13:40 Pagamento Em Dinheiro Na
 *   Loja -R$ 600,00                                  ← crédito vem com "-"
 *   Total cartão (final 0000) R$ 467,50
 *   Legenda: ...                                      ← fim das transações da página
 *
 * O leitor genérico pegava as ofertas de parcelamento da 1ª página ("Entrada de R$ 531,62 + 1X")
 * como compra: uma fatura de R$ 1.026 foi lida como R$ 3.692.
 */

const MESES: Record<string, string> = {
  jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06",
  jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12",
};

const INICIO_RE = /^(\d{2})\/(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s+\d{2}:\d{2}\s+(.*)$/i;
const VALOR_NO_FIM_RE = /^(.*?)\s*(-?)R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})$/;
const VENCIMENTO_RE = /Vencimento\s+\d{2}\/(\d{2})\/(\d{4})/i;

export function isSicrediInvoice(texto: string): boolean {
  return /sicredi/i.test(texto) && /^Data e hora Cidade Compra Descri[çc][ãa]o\b/im.test(texto);
}

export function parseSicrediInvoice(texto: string, refYear: number = new Date().getFullYear()): ParsedTransaction[] {
  const venc = texto.match(VENCIMENTO_RE);
  const mesVenc = venc ? Number(venc[1]) : null;
  const anoVenc = venc ? Number(venc[2]) : refYear;
  const out: ParsedTransaction[] = [];
  let atual: { date: string; partes: string[] } | null = null;

  const fechar = (trecho: string): boolean => {
    const m = trecho.match(VALOR_NO_FIM_RE);
    if (!m || !atual) return false;
    // "Sao Paulo Online Apple Com/bill": cidade e canal antes do nome da loja.
    const bruta = [...atual.partes, m[1]].join(" ").replace(/-\s+(?=[a-zà-ú])/g, "").replace(/\s+/g, " ").trim();
    const descricao = bruta.replace(/^.*?\b(?:Online|Presencial)\s+/i, "") || "Lançamento";
    const valor = parseBrazilianNumber(m[3]);
    // "Cred P Fat Ent": o saldo da fatura anterior saindo daqui pra virar parcelamento ("P Fat Ent
    // 01/12" é a parcela). Não é estorno de compra: contado, descontava o mês inteiro do gasto.
    if (/^Cred P Fat\b/i.test(descricao)) {
      atual = null;
      return true;
    }
    if (valor) out.push({ date: atual.date, description: descricao, amount: m[2] === "-" ? -valor : valor });
    atual = null;
    return true;
  };

  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.replace(/\s+/g, " ").trim();
    if (!linha) continue;
    const inicio = linha.match(INICIO_RE);
    if (inicio) {
      const [, dd, mesNome, resto] = inicio;
      const mm = MESES[mesNome.toLowerCase()];
      // Compra de mês depois do vencimento é do ano anterior (fatura de janeiro, compra de dezembro).
      const ano = mesVenc !== null && Number(mm) > mesVenc ? anoVenc - 1 : anoVenc;
      atual = { date: `${ano}-${mm}-${dd}`, partes: [] };
      if (!fechar(resto)) atual.partes.push(resto);
      continue;
    }
    if (!atual) continue;
    if (/^(Total\b|Legenda:|Cart[ãa]o\b)/i.test(linha) || atual.partes.length >= 2) {
      atual = null;
      continue;
    }
    if (!fechar(linha)) atual.partes.push(linha);
  }
  return out;
}
