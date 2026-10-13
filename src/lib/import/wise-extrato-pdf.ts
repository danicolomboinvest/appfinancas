import type { ParsedTransaction } from "./statement-parser";

/**
 * Extrato da conta Wise em PDF (moeda da conta no título: "Extrato em EUR"):
 *
 *   Transação por cartão de 3,40 EUR emitida por Ottimo Cafe ST. JULIANS -3,40 153,77
 *   13 de outubro de 2026 | Cartão terminado em 6675 | Fulana de Tal | Transação: CARD-4463860152
 *   500,00 BRL convertidos para 86,29 EUR 86,29 157,17
 *   12 de outubro de 2026 | Transação: BALANCE-6265180947
 *
 * A descrição vem ANTES (às vezes em 2 ou 3 linhas, com a cidade embaixo), o valor com sinal e o
 * saldo fecham a última linha dela, e a data só aparece na linha de baixo. Saída já vem com "-".
 * A lista é do mais novo pro mais antigo: o saldo da linha menos o valor dela é o saldo da linha
 * de baixo, e é isso que o teste confere. Uma cliente subiu o extrato de EUR e viu "27 linhas
 * com valor, nenhum lançamento".
 */

const MESES: Record<string, string> = {
  janeiro: "01", fevereiro: "02", março: "03", marco: "03", abril: "04", maio: "05", junho: "06",
  julho: "07", agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12",
};
const VALOR = String.raw`-?\d{1,3}(?:\.\d{3})*,\d{2}`;
const FIM_RE = new RegExp(String.raw`^(.*?)\s*(${VALOR})\s+(${VALOR})$`);
const DATA_RE = /^(\d{1,2}) de ([a-zç]+) de (\d{4}) \|/i;
const CARTAO_RE = /^Transa[çc][ãa]o por cart[ãa]o de [\d.,]+ [A-Z]{3} emitida por\s*/i;
const CONVERSAO_RE = /^([\d.,]+) ([A-Z]{3}) convertidos para ([\d.,]+) ([A-Z]{3})\b/i;

export function isWiseStatement(texto: string): boolean {
  return /\bWise Payments\b/i.test(texto) && /Extrato em [A-Z]{3}\b/.test(texto) && /Descri[çc][ãa]o\s+Entrada\s+Sa[íi]da\s+Valor/i.test(texto);
}

const numero = (s: string) => Number(s.replace(/\./g, "").replace(",", "."));

export function parseWiseStatement(texto: string): ParsedTransaction[] {
  const linhas = texto.split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim());
  const inicio = linhas.findIndex((l) => /^Descri[çc][ãa]o Entrada Sa[íi]da Valor$/i.test(l));
  const out: ParsedTransaction[] = [];
  let pendente: string[] = [];
  let atual: { descricao: string; valor: number } | null = null;
  for (const l of linhas.slice(inicio + 1)) {
    if (!l || /^-- \d+ of \d+ --$/.test(l) || /^ref:/i.test(l)) continue;
    if (/^A Wise Payments Limited/i.test(l)) break;
    const dia = atual ? l.match(DATA_RE) : null;
    if (atual && dia) {
      const mes = MESES[dia[2].toLowerCase()];
      if (mes) out.push({ date: `${dia[3]}-${mes}-${dia[1].padStart(2, "0")}`, description: atual.descricao, amount: atual.valor });
      atual = null;
      continue;
    }
    const fim = l.match(FIM_RE);
    if (fim) {
      const texto = [...pendente, fim[1]].join(" ").trim();
      const conv = texto.match(CONVERSAO_RE);
      const descricao = conv
        ? `Conversão de moeda (${conv[1]} ${conv[2]} para ${conv[3]} ${conv[4]})`
        : texto.replace(CARTAO_RE, "").trim() || "Lançamento";
      atual = { descricao, valor: numero(fim[2]) };
      pendente = [];
      continue;
    }
    pendente.push(l);
  }
  return out;
}
