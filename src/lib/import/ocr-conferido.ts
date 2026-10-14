import { veioDeImagem } from "./ocr-marca";
import { isNubankStatement, parseNubankStatement } from "./nubank-pdf";
import { isItauStatement, parseItauStatement } from "./itau-extrato-pdf";
import type { ParsedTransaction } from "./statement-parser";

/**
 * Leitores de texto que veio de LEITURA POR IMAGEM (OCR) e que se conferem sozinhos pelos totais
 * impressos no próprio extrato. O OCR troca um dígito de vez em quando; número trocado vira
 * dinheiro errado no app. Por isso: ou cada dia fecha no centavo com o total do banco, ou não sai
 * NADA (melhor pedir outro arquivo do que gravar o que não fecha).
 *
 * Chegam aqui os PDFs com o texto "embaralhado" pela fonte (pdf-quality.ts, textoEmbaralhado) e os
 * escaneados. Casos de 13/10/2026: um extrato do Nubank e um do Itaú, os dois perfeitos na tela.
 */

const centavos = (n: number): number => Math.round(n * 100);
const dinheiro = (s: string): number => Number(s.replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
const DINHEIRO = String.raw`\d{1,3}(?:[.,]\d{3})*,\d{2}`;

// ---------------------------------------------------------------------------------------------
// Nubank: cada dia traz "Total de entradas + X" e "Total de saídas - Y".

const MESES = "JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ";

/** O texto do OCR no formato do texto do PDF: "O2OUT2026  Totalde entradas" → "02 OUT 2026 Total de entradas". */
export function normalizarNubankOcr(texto: string): string {
  return texto
    .split(/\r?\n/)
    .map((l) =>
      l
        .replace(new RegExp(String.raw`^([O0-9])([O0-9])\s*(${MESES})\s*(\d{4})`), (_, a: string, b: string, m: string, y: string) =>
          `${a.replace("O", "0")}${b.replace("O", "0")} ${m} ${y}`,
        )
        .replace(/Total\s*de\s*(entradas|sa[ií]das)/gi, (_, t: string) => `Total de ${t.toLowerCase()}`)
        // "+4,625,00" (vírgula no lugar do ponto do milhar) e "+ 4.415,00".
        .replace(/([+-])\s*(\d{1,3}),(\d{3}),(\d{2})\b/g, "$1 $2.$3,$4")
        .replace(/[ \t]{2,}/g, " ")
        .trim(),
    )
    .join("\n");
}

function totaisDoNubank(texto: string): Map<string, { entradas: number | null; saidas: number | null }> {
  const meses: Record<string, string> = { JAN: "01", FEV: "02", MAR: "03", ABR: "04", MAI: "05", JUN: "06", JUL: "07", AGO: "08", SET: "09", OUT: "10", NOV: "11", DEZ: "12" };
  const dias = new Map<string, { entradas: number | null; saidas: number | null }>();
  let dia: string | null = null;
  const totalRe = new RegExp(String.raw`Total de (entradas|sa[ií]das)\s*([+-])\s*(${DINHEIRO})\s*$`);
  for (const l of texto.split("\n")) {
    const d = l.match(new RegExp(String.raw`^(\d{2}) (${MESES}) (\d{4})\b`));
    if (d) {
      dia = `${d[3]}-${meses[d[2]]}-${d[1]}`;
      if (!dias.has(dia)) dias.set(dia, { entradas: null, saidas: null });
    }
    const t = l.match(totalRe);
    if (t && dia) {
      const alvo = dias.get(dia)!;
      if (t[1] === "entradas") alvo.entradas = dinheiro(t[3]);
      else alvo.saidas = dinheiro(t[3]);
    }
  }
  return dias;
}

export function isNubankOcrStatement(texto: string): boolean {
  return veioDeImagem(texto) && isNubankStatement(normalizarNubankOcr(texto));
}

export function parseNubankOcrStatement(texto: string): ParsedTransaction[] {
  const normal = normalizarNubankOcr(texto);
  const txns = parseNubankStatement(normal);
  const totais = totaisDoNubank(normal);
  if (txns.length === 0 || totais.size === 0) return [];
  const somas = new Map<string, { entradas: number; saidas: number }>();
  for (const t of txns) {
    const s = somas.get(t.date) ?? { entradas: 0, saidas: 0 };
    if (t.amount > 0) s.entradas += t.amount;
    else s.saidas += -t.amount;
    somas.set(t.date, s);
  }
  // Todo dia lido precisa ter total impresso, e todo total impresso precisa fechar.
  for (const dia of somas.keys()) if (!totais.has(dia)) return [];
  for (const [dia, total] of totais) {
    const s = somas.get(dia) ?? { entradas: 0, saidas: 0 };
    if (centavos(s.entradas) !== centavos(total.entradas ?? 0)) return [];
    if (centavos(s.saidas) !== centavos(total.saidas ?? 0)) return [];
  }
  return txns;
}

// ---------------------------------------------------------------------------------------------
// Itaú: cada dia termina com "SALDO DO DIA"; a variação de um saldo pro outro é a soma do dia.

/** OCR do Itaú: "PIXTRANSF" e espaços largos; a linha em si já vem como o leitor espera. */
function normalizarItauOcr(texto: string): string {
  return texto
    .split(/\r?\n/)
    .map((l) => l.replace(/[ \t]{2,}/g, "  ").trim())
    .join("\n");
}

function saldosDoDia(texto: string): { date: string; saldo: number; ordem: number }[] {
  const out: { date: string; saldo: number; ordem: number }[] = [];
  const re = new RegExp(String.raw`^(\d{2})\/(\d{2})\/(\d{4})\s+SALDO\s+(?:DO\s+DIA|ANTERIOR)\s+(-?${DINHEIRO})\s*$`, "i");
  texto.split("\n").forEach((l, ordem) => {
    const m = l.match(re);
    if (m) out.push({ date: `${m[3]}-${m[2]}-${m[1]}`, saldo: dinheiro(m[4].replace(/^-/, "")) * (m[4].startsWith("-") ? -1 : 1), ordem });
  });
  return out;
}

export function isItauOcrStatement(texto: string): boolean {
  return veioDeImagem(texto) && isItauStatement(normalizarItauOcr(texto));
}

export function parseItauOcrStatement(texto: string): ParsedTransaction[] {
  const normal = normalizarItauOcr(texto);
  const txns = parseItauStatement(normal);
  const saldos = saldosDoDia(normal);
  if (txns.length === 0 || saldos.length < 2) return [];
  // Linha com data e sem valor (o OCR perdeu o número): não dá pra conferir, não sai nada.
  const comData = normal.split("\n").filter((l) => /^\d{2}\/\d{2}\/\d{4}\s/.test(l) && !/SALDO/i.test(l));
  if (comData.length !== txns.length) return [];

  const porDia = new Map<string, number>();
  for (const t of txns) porDia.set(t.date, (porDia.get(t.date) ?? 0) + t.amount);
  const ordenados = [...new Map(saldos.map((s) => [s.date, s])).values()].sort((a, b) => a.date.localeCompare(b.date));
  // Cada par de saldos seguidos: a soma dos dias entre eles fecha no centavo. A exceção é o dia
  // em que o extrato foi emitido: o saldo dele ainda é do meio do dia e já conta o rendimento da
  // aplicação automática que só vira lançamento à noite (visto em 13/10/2026: R$ 0,02 a mais no
  // saldo, no texto do PDF e no OCR). Ali vale uma folga de até 5 centavos, só pra mais.
  const emitido = normal.match(/emitido em:?\s*(\d{2})\/(\d{2})\/(\d{4})/i);
  const diaDaEmissao = emitido ? `${emitido[3]}-${emitido[2]}-${emitido[1]}` : null;
  for (let i = 1; i < ordenados.length; i++) {
    const de = ordenados[i - 1].date;
    const ate = ordenados[i].date;
    let soma = 0;
    for (const [dia, v] of porDia) if (dia > de && dia <= ate) soma += v;
    const sobra = centavos(ordenados[i].saldo - ordenados[i - 1].saldo) - centavos(soma);
    const folga = ate === diaDaEmissao ? 5 : 0;
    if (sobra < 0 || sobra > folga) return [];
  }
  // Nada depois do último saldo; o primeiro dia (sem saldo antes) só entra porque todos os outros
  // dias do mesmo arquivo fecharam no centavo, o que mostra que a leitura deste arquivo está boa.
  const ultimo = ordenados[ordenados.length - 1].date;
  if ([...porDia.keys()].some((d) => d > ultimo)) return [];
  if (ordenados.length < 3) return [];
  return txns;
}
