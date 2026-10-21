import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * "Extrato de transações" em PDF exportado por outro app de finanças (quem chega ao SPI trazendo
 * o histórico de lá). Os lançamentos vêm agrupados por dia, sem data na linha:
 *
 *   Saldo no dia 30/09/26 R$ 1.000,00
 *   01/10/2026, Quinta-feira
 *   Unha (4 / 4) Salão de Beleza Pessoal -45,00       ← descrição, categoria, conta, valor
 *   Saldo do dia R$ 955,00
 *   07/10/2026, Quarta-feira
 *   Colar + Anel Sem Categoria Pessoal -120,00
 *   Adiantamento Sem Categoria Pessoal +3.000,00
 *   Saldo do dia R$ 3.835,00
 *   21 de Outubro de 2026                              ← rodapé de cada página
 *   Extrato de transações De 01/10/26 até 31/10/26
 *   Página 1
 *
 * O leitor genérico só via a primeira linha de cada dia (a que vem colada na data): em 21/10/2026
 * um extrato assim leu 10 de 24 lançamentos, três vezes seguidas.
 */

const DIA_RE = /^(\d{2})\/(\d{2})\/(\d{4}),\s*(?:segunda|ter[çc]a|quarta|quinta|sexta)(?:-feira)?$|^(\d{2})\/(\d{2})\/(\d{4}),\s*(?:s[áa]bado|domingo)$/i;
const LANC_RE = /^(.+?)\s+([+-])\s?(\d{1,3}(?:\.\d{3})*,\d{2})$/;
const RODAPE_RE = /^(?:\d{1,2} de [A-Za-zçÇ]+ de \d{4}|Extrato de transa[çc][õo]es\b.*|P[áa]gina \d+|--\s*\d+ of \d+\s*--|Saldo (?:do|no) dia\b.*)$/i;

function linhas(texto: string): string[] {
  return texto.split(/\r?\n/).map((l) => l.replace(/\t/g, " ").replace(/\s+/g, " ").trim());
}

export function isExtratoDeAppPdf(texto: string): boolean {
  const ls = linhas(texto);
  return (
    /Extrato de transa[çc][õo]es\s+De \d{2}\/\d{2}\/\d{2,4} at[ée] \d{2}\/\d{2}\/\d{2,4}/i.test(texto) &&
    ls.some((l) => /^Saldo do dia R\$/i.test(l)) &&
    ls.some((l) => DIA_RE.test(l))
  );
}

export function parseExtratoDeAppPdf(texto: string): ParsedTransaction[] {
  const out: ParsedTransaction[] = [];
  let data: string | null = null;
  for (const linha of linhas(texto)) {
    if (!linha) continue;
    const dia = linha.match(DIA_RE);
    if (dia) {
      const [d, m, a] = dia[1] ? [dia[1], dia[2], dia[3]] : [dia[4], dia[5], dia[6]];
      data = `${a}-${m}-${d}`;
      continue;
    }
    if (!data || RODAPE_RE.test(linha)) continue;
    const lanc = linha.match(LANC_RE);
    if (!lanc) continue;
    const magnitude = parseBrazilianNumber(lanc[3]);
    if (Number.isNaN(magnitude) || magnitude === 0) continue;
    out.push({ date: data, description: lanc[1], amount: lanc[2] === "-" ? -magnitude : magnitude });
  }
  return limparDescricoes(out);
}

/** A categoria "Sem Categoria" e o nome da conta (a mesma palavra no fim de toda linha) são do
 * outro app, não do lançamento: saem da descrição para o SPI categorizar pelo nome. */
function limparDescricoes(txns: ParsedTransaction[]): ParsedTransaction[] {
  const finais = new Set(txns.map((t) => t.description.split(" ").at(-1)));
  const conta = txns.length >= 3 && finais.size === 1 ? [...finais][0] : null;
  return txns.map((t) => {
    let desc = t.description;
    if (conta && desc.split(" ").length > 1) desc = desc.slice(0, -(conta!.length + 1));
    desc = desc.replace(/\s+Sem Categoria$/i, "").trim();
    return { ...t, description: desc || t.description };
  });
}
