import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Fatura do cartão Nubank em PDF.
 *
 *   FATURA 14 SET 2026 EMISSÃO E ENVIO 07 SET 2026
 *   TRANSAÇÕES DE 07 AGO A 07 SET
 *   07 AGO •••• 0000 Loja Exemplo - Parcela 4/4 R$ 56,21
 *   27 AGO 99Food - NuPay R$ 136,40
 *   04 SET Estorno de iFood - NuPay −R$ 38,89
 *   13 JUL •••• 0000 Servico Exterior             ← compra em dólar: o valor em reais vem
 *   USD 50.00                                       três linhas depois, depois da cotação
 *   Conversão: USD 1 = R$ 5,31
 *   R$ 265,66
 *   Pagamentos e Financiamentos -R$ 567,66
 *   11 AGO Pagamento em 11 AGO −R$ 1.612,56
 *   07 AGO Pessoa Exemplo - Parcela 5/5           ← Pix no crédito parcelado: a parcela do mês
 *   Total a pagar: R$ 294,70 (valor da transação ...) divididos em 5 parcelas de R$ 58,94.
 *   R$ 58,94
 *   14 AGO Saldo restante da fatura anterior R$ 0,00
 *
 * O leitor genérico perdia tudo que tem o valor numa linha separada: pegava a cotação (R$ 5,31)
 * no lugar da compra em dólar, e as parcelas de Pix no crédito, "limite convertido em saldo" e
 * parcelamento de fatura sumiam. Uma fatura de R$ 2.252 foi lida como R$ 1.285.
 *
 * Compra sai positiva; estorno e pagamento (com o menos) saem negativos.
 */

const MESES: Record<string, string> = {
  JAN: "01", FEV: "02", MAR: "03", ABR: "04", MAI: "05", JUN: "06",
  JUL: "07", AGO: "08", SET: "09", OUT: "10", NOV: "11", DEZ: "12",
};
const MES = "(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)";
const VALOR = String.raw`([−-])?R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})`;

const COMPLETA_RE = new RegExp(String.raw`^(\d{2}) ${MES} (.+?) ${VALOR}$`);
const ABERTA_RE = new RegExp(String.raw`^(\d{2}) ${MES} (.+)$`);
const SO_VALOR_RE = new RegExp(String.raw`^${VALOR}$`);
const EMISSAO_RE = new RegExp(String.raw`EMISS[ÃA]O E ENVIO \d{2} ${MES} (\d{4})`);
const INICIO_RE = /^TRANSA[ÇC][ÕO]ES DE /;
const FIM_RE = /^Em cumprimento à regula[çc][ãa]o/i;
const SALDO_RESTANTE_RE = /^Saldo restante da fatura anterior/i;

export function isNubankInvoice(texto: string): boolean {
  // "Nu Pagamentos" some em parte das faturas (só sobra "O Nubank declara..." no resumo).
  return /Nu Pagamentos|\bNubank\b/i.test(texto) && /RESUMO DA FATURA ATUAL/.test(texto) && /^TRANSA[ÇC][ÕO]ES DE /m.test(texto);
}

export function parseNubankInvoice(texto: string, refYear: number = new Date().getFullYear()): ParsedTransaction[] {
  const emissao = texto.match(EMISSAO_RE);
  const mesFechamento = emissao ? Number(MESES[emissao[1]]) : null;
  const anoFechamento = emissao ? Number(emissao[2]) : refYear;
  const data = (dd: string, mes: string) => {
    const mm = MESES[mes];
    const ano = mesFechamento !== null && Number(mm) > mesFechamento ? anoFechamento - 1 : anoFechamento;
    return `${ano}-${mm}-${dd}`;
  };

  const out: ParsedTransaction[] = [];
  let pendente: { date: string; description: string } | null = null;
  const lancar = (date: string, descricao: string, menos: string | undefined, valor: string) => {
    const magnitude = parseBrazilianNumber(valor);
    if (Number.isNaN(magnitude) || magnitude === 0) return;
    const description = descricao.replace(/^•+\s*\d{4}\s+/, "").trim();
    if (SALDO_RESTANTE_RE.test(description)) return;
    out.push({ date, description, amount: menos ? -magnitude : magnitude });
  };

  let dentro = false;
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.replace(/\s+/g, " ").trim();
    if (INICIO_RE.test(linha)) {
      dentro = true;
      continue;
    }
    if (!dentro) continue;
    if (FIM_RE.test(linha)) break;

    const completa = linha.match(COMPLETA_RE);
    if (completa) {
      const [, dd, mes, descricao, menos, valor] = completa;
      lancar(data(dd, mes), descricao, menos, valor);
      pendente = null;
      continue;
    }
    const aberta = linha.match(ABERTA_RE);
    if (aberta) {
      pendente = { date: data(aberta[1], aberta[2]), description: aberta[3] };
      continue;
    }
    const soValor = linha.match(SO_VALOR_RE);
    if (soValor && pendente) {
      lancar(pendente.date, pendente.description, soValor[1], soValor[2]);
      pendente = null;
    }
  }
  return out;
}
