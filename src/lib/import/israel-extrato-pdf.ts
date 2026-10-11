import type { ParsedTransaction } from "./statement-parser";

/**
 * Extrato de conta de banco de Israel em PDF, versão em inglês ("Account statement"), em shekel:
 *
 *   Date Transaction Type Credit Debit Cumulative Balance
 *   09.10.2026 dir tran of salary 11,701.00 ₪ 12,735.27 ₪
 *   01.10.2026 direct trans fee 9.90 ₪ 1,034.27₪
 *
 * As colunas de crédito e débito saem do PDF coladas numa só: a linha traz um valor e o saldo, sem
 * dizer de que lado o valor estava. Quem diz é o saldo: a lista vem do mais novo pro mais antigo,
 * então o lançamento é o saldo da linha menos o saldo da linha de baixo. Ponto decimal, vírgula de
 * milhar ("11,701.00"). Uma cliente subiu 3 meses (32 linhas com valor) e viu zero lançamentos.
 */

const LINHA_RE = /^(\d{2})\.(\d{2})\.(\d{4})\s+(.+?)\s+(\d{1,3}(?:,\d{3})*\.\d{2})\s*₪\s+(-?\d{1,3}(?:,\d{3})*\.\d{2})\s*₪\s*$/;
/** Só pra linha mais antiga, que não tem saldo embaixo pra comparar. */
const CREDITO_RE = /salary|dep(osit)?\b|interest|refund/i;

export function isIsraelBankStatement(texto: string): boolean {
  return /cumulative\s+balance/i.test(texto) && texto.includes("₪") && /account\s+statement/i.test(texto);
}

function numero(bruto: string): number {
  return Number(bruto.replace(/,/g, ""));
}

export function parseIsraelBankStatement(texto: string): ParsedTransaction[] {
  const linhas: { date: string; description: string; valor: number; saldo: number }[] = [];
  for (const bruta of texto.split(/\r?\n/)) {
    const m = bruta.trim().match(LINHA_RE);
    if (!m) continue;
    const valor = numero(m[5]);
    if (!(valor > 0)) continue;
    linhas.push({ date: `${m[3]}-${m[2]}-${m[1]}`, description: m[4].trim(), valor, saldo: numero(m[6]) });
  }
  return linhas.map((l, i) => {
    const anterior = linhas[i + 1];
    let sinal: number;
    if (anterior) {
      const diferenca = Math.round((l.saldo - anterior.saldo) * 100) / 100;
      sinal = diferenca < 0 ? -1 : 1;
    } else {
      sinal = CREDITO_RE.test(l.description) ? 1 : -1;
    }
    return { date: l.date, description: l.description || "Lançamento", amount: sinal * l.valor };
  });
}
