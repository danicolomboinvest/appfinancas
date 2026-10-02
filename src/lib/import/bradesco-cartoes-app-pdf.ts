import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Fatura (aberta ou fechada) baixada do "Aplicativo Bradesco Cartões" em PDF.
 *
 *   Aplicativo Bradesco Cartões
 *   Data: 02/10/2026 - 09:00
 *   Situação do Extrato: EM ABERTO
 *   Data Histórico Moeda de origem US$ Cotação US$ R$
 *   25/09 PADARIA EXEMPLO BRL 24,99 0,00 R$ 0,00 24,99     ← valor original, US$, cotação, R$
 *   22/09 FARMACIA 1/3 BRL 99,36 0,00 R$ 0,00 33,12        ← parcelada: cobrado é o último
 *   24/09 LOJA COM NOME COMPRIDO BRL                        ← os números descem pra linha
 *   119,90 0,00 R$ 0,00 119,90                                 de baixo
 *   21/09 PAGTO ANTECIPADO PIX BRL -7.353,58 0,00 R$ 0,00 -7.353,58
 *   20/09 SALDO ANTERIOR BRL 0,00 0,00 R$ 0,00 7.353,58
 *   . Total da Fatura em Real . . . R$ 6.734,42
 *
 * Tem "Extrato" no cabeçalho, então o app achava que era extrato de conta: as compras viravam
 * saída de dinheiro e o pagamento antecipado de R$ 7.353,58 entrava como mais um gasto.
 */

const INICIO_RE = /^(\d{2})\/(\d{2})\s+(.+)$/;
const BRL_RE = /^(.*?)\s*\bBRL\b\s*(.*)$/;
const VALORES_RE = /^(-?\d{1,3}(?:\.\d{3})*,\d{2})\s+-?\d{1,3}(?:\.\d{3})*,\d{2}\s+R\$\s*-?\d{1,3}(?:\.\d{3})*,\d{2}\s+(-?\d{1,3}(?:\.\d{3})*,\d{2})$/;
const DATA_RE = /^Data:\s*\d{2}\/(\d{2})\/(\d{4})/m;

export function isBradescoCartoesApp(texto: string): boolean {
  return /Aplicativo Bradesco Cart[õo]es/i.test(texto) && /Total da Fatura em Real/i.test(texto);
}

export function parseBradescoCartoesApp(texto: string, refYear: number = new Date().getFullYear()): ParsedTransaction[] {
  const data = texto.match(DATA_RE);
  const mesRef = data ? Number(data[1]) : null;
  const anoRef = data ? Number(data[2]) : refYear;
  const out: ParsedTransaction[] = [];
  // A descrição pode quebrar em várias linhas ("CASA EXEMPLO 1" / "/4" / "BRL"): junta até o "BRL".
  let pendente: { date: string; partes: string[]; brl: boolean } | null = null;

  const lancar = (valores: string): boolean => {
    const m = valores.match(VALORES_RE);
    if (!m || !pendente) return false;
    const descricao = pendente.partes.join(" ").replace(/(\d) \/(\d)/g, "$1/$2").replace(/\s+/g, " ").trim();
    if (!/^SALDO ANTERIOR$/i.test(descricao)) {
      const valor = parseBrazilianNumber(m[2]);
      // Compra sem sinal (positiva, como nos outros leitores de fatura); pagamento e crédito com "-".
      if (valor) out.push({ date: pendente.date, description: descricao || "Lançamento", amount: valor });
    }
    pendente = null;
    return true;
  };

  // Do "BRL" em diante: os números, na mesma linha ou na de baixo.
  const aposBrl = (linha: string) => {
    const b = linha.match(BRL_RE);
    if (!b || !pendente) return false;
    if (b[1]) pendente.partes.push(b[1]);
    pendente.brl = true;
    if (b[2]) lancar(b[2]);
    return true;
  };

  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.replace(/\s+/g, " ").trim();
    if (!linha) continue;
    if (/Total da Fatura em Real/i.test(linha)) break;
    const inicio = linha.match(INICIO_RE);
    if (inicio) {
      const [, dd, mm, resto] = inicio;
      const ano = mesRef !== null && Number(mm) > mesRef ? anoRef - 1 : anoRef;
      pendente = { date: `${ano}-${mm}-${dd}`, partes: [], brl: false };
      if (!aposBrl(resto)) pendente.partes.push(resto);
      continue;
    }
    if (!pendente) continue;
    if (pendente.brl) {
      if (!lancar(linha)) pendente = null;
    } else if (!aposBrl(linha)) {
      if (pendente.partes.length < 3) pendente.partes.push(linha);
      else pendente = null;
    }
  }
  return out;
}
