import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Extrato de conta PJ em PDF com duas colunas de valor, "Entrada" e "Saída" (conta aberta pela
 * Contabilizei, Banco 301). O topo traz os totais e cada lançamento vem quebrado em linhas:
 *
 *   Total de entradas R$ 6.855,00    Total de saídas R$ 3.980,57
 *   15/09/2026
 *   Pessoa
 *   Jurídica
 *   PIX   CLINICA EXEMPLO SERVIC   R$ 6.825,00 -      ← entrada: o valor está na 1ª coluna
 *   21/09/2026
 *   Pessoa
 *   Jurídica
 *   PIX
 *   AGENCIA EXEMPLO TURISMO S.A
 *   JUDICIAL
 *   - R$ 623,76                                        ← saída: o valor está na 2ª coluna
 *
 * O leitor genérico lia todo "-" da coluna vazia como sinal de menos (entrada virava gasto) e
 * perdia o lançamento cujo nome quebra em várias linhas. Este leitor só vale se a soma das
 * entradas e a das saídas fecharem no centavo com os dois totais impressos no topo; senão devolve
 * vazio e o resto da leitura segue como antes.
 */

const DATA_RE = /^(\d{2})\/(\d{2})\/(\d{4})\b\s*(.*)$/;
const CELULA = String.raw`(-|R\$\s*\d{1,3}(?:\.\d{3})*,\d{2})`;
const VALORES_RE = new RegExp(String.raw`\s*${CELULA}\s+${CELULA}\s*$`);
const TOTAL_ENTRADAS_RE = /Total de entradas\s+R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i;
const TOTAL_SAIDAS_RE = /Total de sa[ií]das\s+R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i;

export function isContaEntradaSaidaPdf(texto: string): boolean {
  return (
    TOTAL_ENTRADAS_RE.test(texto) &&
    TOTAL_SAIDAS_RE.test(texto) &&
    /Entrada\s+Sa[ií]da/i.test(texto) &&
    /Saldo do dia/i.test(texto) &&
    /Movimenta[çc][õo]es/i.test(texto)
  );
}

function centavos(n: number): number {
  return Math.round(n * 100);
}

export function parseContaEntradaSaidaPdf(texto: string): ParsedTransaction[] {
  const totalEntradas = parseBrazilianNumber(texto.match(TOTAL_ENTRADAS_RE)?.[1] ?? "");
  const totalSaidas = parseBrazilianNumber(texto.match(TOTAL_SAIDAS_RE)?.[1] ?? "");
  if (Number.isNaN(totalEntradas) || Number.isNaN(totalSaidas)) return [];

  const linhas = texto.split(/\r?\n/).map((l) => l.replace(/\t/g, " ").replace(/\s+/g, " ").trim());
  const inicio = linhas.findIndex((l) => /^Data\b.*\bEntrada\b.*\bSa[ií]da\b/i.test(l));
  if (inicio < 0) return [];

  // Cada lançamento: a data e as linhas até a linha dos dois valores.
  const out: ParsedTransaction[] = [];
  let data: string | null = null;
  let pedacos: string[] = [];
  for (let i = inicio + 1; i < linhas.length; i++) {
    let linha = linhas[i];
    if (!linha) continue;
    if (/^Extrato gerado\b/i.test(linha)) break;
    if (/^Saldo do dia\b/i.test(linha)) {
      // O saldo pode vir em linhas soltas ("-" e depois "R$ 2.641,49"): descarta também.
      while (i + 1 < linhas.length && /^(-|-?R\$\s*[\d.]+,\d{2})$/.test(linhas[i + 1]) && !/R\$.*R\$/.test(linha)) i++;
      continue;
    }
    const nova = linha.match(DATA_RE);
    if (nova) {
      data = `${nova[3]}-${nova[2]}-${nova[1]}`;
      pedacos = [];
      linha = nova[4];
    }
    if (!data) continue;
    const v = linha.match(VALORES_RE);
    if (v) {
      const resto = linha.slice(0, v.index).trim();
      if (resto) pedacos.push(resto);
      const entrada = v[1] !== "-";
      const valor = parseBrazilianNumber(entrada ? v[1] : v[2]);
      if (!Number.isNaN(valor) && valor !== 0 && (entrada || v[2] !== "-")) {
        const descricao = pedacos.join(" ").replace(/\s+/g, " ").trim();
        out.push({ date: data, description: descricao, amount: entrada ? valor : -valor });
      }
      data = null;
      pedacos = [];
      continue;
    }
    if (linha) pedacos.push(linha);
  }

  const somaEntradas = out.filter((t) => t.amount > 0).reduce((s, t) => s + centavos(t.amount), 0);
  const somaSaidas = out.filter((t) => t.amount < 0).reduce((s, t) => s - centavos(t.amount), 0);
  if (somaEntradas !== centavos(totalEntradas) || somaSaidas !== centavos(totalSaidas)) return [];
  return out;
}
