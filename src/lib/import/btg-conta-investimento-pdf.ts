import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * "Extrato da Conta Investimento" do BTG/EQI em PDF: posição e movimentação dos fundos e, no fim,
 * o quadro da conta corrente, que é o único com entrada e saída de dinheiro de verdade:
 *
 *   Conta corrente - Movimentação
 *   Data   Descrição                                   Movimentação R$   Saldo conta investimentos R$
 *   01/09/26 Saldo Anterior                              -
 *   04/09/26 TAXA DE CONSULTORIA - 8/2026 - EMPRESA      -20,26            -20,26
 *   04/09/26 RESGATE DE COTAS NO FUNDO - FUNDO EXEMPLO   100,00            79,74
 *   30/09/26 Saldo Final + Rendimento Provisionado ...   -                 81,57
 *
 * O leitor genérico pegava as linhas dos FUNDOS ("04/09/26 RESGATE REF. APLIC. 15/09/2025 …"),
 * com a data da aplicação antiga e o sinal trocado, e deixava a conta corrente de fora. O PDF
 * perde a ligadura "ta" ("Cont corrente", "Dat"), então os títulos aceitam as duas formas.
 *
 * Só vale se o saldo de cada linha for o anterior mais o lançamento, no centavo: um degrau que
 * não fecha e o leitor desiste (melhor nada do que dinheiro errado).
 */

const SECAO_RE = /^Conta?\s+corrente\s*-\s*Movimenta[çc][ãa]o\b/i;
const OUTRA_SECAO_RE = /\s-\s(?:Posi[çc][ãa]o|Movimenta[çc][ãa]o|Rentabilidade)\b|^Total de\b/i;
const VALOR = String.raw`-?\d{1,3}(?:\.\d{3})*,\d{2}`;
const LANC_RE = new RegExp(String.raw`^(\d{2})\/(\d{2})\/(\d{2}|\d{4})\s+(.+?)\s+(${VALOR})\s+(${VALOR})$`);
/** "01/09/26 Saldo Anterior -": o "-" é saldo zero. */
const SALDO_ANTERIOR_RE = new RegExp(String.raw`^\d{2}\/\d{2}\/\d{2,4}\s+Saldo Anterior\s+(-|${VALOR})$`, "i");

export function isBtgContaInvestimento(texto: string): boolean {
  return /Extrato d[ae]?\s+Conta?\s+Investimento/i.test(texto) && texto.split(/\r?\n/).some((l) => SECAO_RE.test(l.trim()));
}

export function parseBtgContaInvestimento(texto: string): ParsedTransaction[] {
  const out: ParsedTransaction[] = [];
  let dentro = false;
  let saldo: number | null = null;
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.replace(/\t/g, " ").replace(/\s+/g, " ").trim();
    if (SECAO_RE.test(linha)) {
      dentro = true;
      continue;
    }
    if (!dentro) continue;
    if (OUTRA_SECAO_RE.test(linha)) {
      dentro = false;
      continue;
    }
    const anterior = linha.match(SALDO_ANTERIOR_RE);
    if (anterior) {
      saldo = anterior[1] === "-" ? 0 : parseBrazilianNumber(anterior[1]);
      continue;
    }
    const m = linha.match(LANC_RE);
    if (!m || /^saldo\b/i.test(m[4])) continue;
    const valor = parseBrazilianNumber(m[5]);
    const saldoDaLinha = parseBrazilianNumber(m[6]);
    if (Number.isNaN(valor) || Number.isNaN(saldoDaLinha) || valor === 0) continue;
    if (saldo !== null && Math.round((saldo + valor) * 100) !== Math.round(saldoDaLinha * 100)) return [];
    saldo = saldoDaLinha;
    const ano = m[3].length === 2 ? `20${m[3]}` : m[3];
    // "009204292 - TAXA DE CONSULTORIA": o número da própria conta na frente não ajuda a reconhecer.
    out.push({ date: `${ano}-${m[2]}-${m[1]}`, description: m[4].replace(/^\d{6,}\s*-\s*/, ""), amount: valor });
  }
  return out;
}
