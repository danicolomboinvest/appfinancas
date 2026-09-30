import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Fatura do cartão Bradesco em PDF.
 *
 *   Vencimento
 *   10/10/2026
 *   Lançamentos
 *   Data Histórico de Lançamentos Cidade US$ Cotação do Dólar R$
 *   10/09 PAGTO. POR DEB EM C/C 6.384,08 -           ← crédito: o menos vem DEPOIS do valor
 *   PESSOA EXEMPLO Cartão 0000 XXXX XXXX 0000
 *   08/08 FARMACIA EXEMPLO 02/03 SAO PEDRO           ← cidade quebrada em duas linhas e o valor
 *   DA                                                  sozinho na terceira
 *   196,92
 *   04/09 LOJA ESTORNADA BARUERI 56,89 -             ← estorno
 *   29/08 SERVICO USD 12,32 SITE.COM 12,32 5,4800 67,51   ← exterior: o último é o valor em R$
 *   Total para PESSOA EXEMPLO 3.071,80
 *   ...
 *   Limites
 *   Compras R$ 40.500,00 R$ 8.000,00 R$ 32.500,00
 *
 * O leitor genérico não via o menos depois do valor: estorno virava compra (uma fatura de
 * R$ 4.981 foi lida com R$ 5.095 de gastos). Aqui compra sai positiva e crédito negativo.
 */

const VALOR = String.raw`(\d{1,3}(?:\.\d{3})*,\d{2})(\s+-)?`;
const DATA_RE = /^(\d{2})\/(\d{2})\s+(.+)$/;
const FIM_COM_VALOR_RE = new RegExp(String.raw`^(.*?)\s*${VALOR}$`);
const VENCIMENTO_RE = /Vencimento\s+\d{2}\/(\d{2})\/(\d{4})/i;
const INICIO_RE = /Hist[óo]rico de Lan[çc]amentos/i;
/** Linhas que encerram um lançamento em aberto sem ser continuação dele. */
const QUEBRA_RE = /^(Total para|Total parcelados|Mensagem Importante|Limites|Fatura Mensal|Página \d|.*\bCart[ãa]o \d{4} X)/i;

export function isBradescoInvoice(texto: string): boolean {
  return /Bradesco/i.test(texto) && INICIO_RE.test(texto) && /Resumo da fatura/i.test(texto);
}

export function parseBradescoInvoice(texto: string, refYear: number = new Date().getFullYear()): ParsedTransaction[] {
  // A linha só traz dia/mês; compra de mês DEPOIS do vencimento é do ano anterior.
  const venc = texto.match(VENCIMENTO_RE);
  const mesVencimento = venc ? Number(venc[1]) : null;
  const anoVencimento = venc ? Number(venc[2]) : refYear;

  const out: ParsedTransaction[] = [];
  let aberto: { dd: string; mm: string; partes: string[] } | null = null;
  const fechar = (resto: string, valor: string, menos: string | undefined) => {
    if (!aberto) return;
    const magnitude = parseBrazilianNumber(valor);
    const { dd, mm, partes } = aberto;
    aberto = null;
    if (Number.isNaN(magnitude) || magnitude === 0) return;
    const ano = mesVencimento !== null && Number(mm) > mesVencimento ? anoVencimento - 1 : anoVencimento;
    // Compra no exterior: "SERVICO USD 12,32 SITE.COM 12,32 5,4800" — tira os números soltos do fim.
    const description = [...partes, resto].join(" ").replace(/(\s+[\d.,]+)+$/, "").replace(/\s+/g, " ").trim();
    out.push({ date: `${ano}-${mm}-${dd}`, description, amount: menos ? -magnitude : magnitude });
  };

  let dentro = false;
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.replace(/\s+/g, " ").trim();
    if (!dentro) {
      dentro = INICIO_RE.test(linha);
      continue;
    }
    if (!linha) continue;
    const data = linha.match(DATA_RE);
    if (data) {
      aberto = { dd: data[1], mm: data[2], partes: [] };
      const comValor = data[3].match(FIM_COM_VALOR_RE);
      if (comValor) fechar(comValor[1], comValor[2], comValor[3]);
      else aberto.partes.push(data[3]);
      continue;
    }
    if (!aberto) continue;
    if (QUEBRA_RE.test(linha) || aberto.partes.length >= 3) {
      aberto = null;
      continue;
    }
    const comValor = linha.match(FIM_COM_VALOR_RE);
    if (comValor) fechar(comValor[1], comValor[2], comValor[3]);
    else aberto.partes.push(linha);
  }
  return out;
}
