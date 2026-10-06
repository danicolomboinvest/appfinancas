import { veioDeImagem } from "./ocr-marca";
import type { ParsedTransaction } from "./statement-parser";

/**
 * "Extrato por período" da Caixa (internet banking) impresso como IMAGEM, lido por OCR.
 *
 *   SALDO ANTERIOR                          R$ 1.999,85 D
 *   30/09/2026 - 08:03:14  300803  DEB PIX QR COD DIN  Lava Jato  **437.223/0**  18,00 D  1.241,70 D
 *   27/09/2026 - 08:54:06  270854  PIX RECEBIDO DADOS CONTA  Fulana  ***.694.506  3.700,00 C  1.191,10 D
 *
 * O arquivo vem do mais novo pro mais antigo; cada linha traz o valor e o SALDO depois dela
 * (C = crédito, D = devedor). O OCR erra um dígito de vez em quando ("18,00" vira "1800", "101,36"
 * vira "101,86"), e um número trocado seria dinheiro errado no app. Por isso o valor de cada
 * lançamento é CONFERIDO pela diferença entre saldos consecutivos:
 *   - valor lido == variação do saldo → certo;
 *   - valor ilegível ou com 1 dígito trocado → vale a variação do saldo (e o sinal tem que bater
 *     com o C/D da linha);
 *   - qualquer outra divergência (linha perdida pelo OCR, dois números errados) → NENHUM
 *     lançamento é devolvido. Melhor pedir outro arquivo do que gravar número que não fecha.
 */

const MONEY = String.raw`\d{1,3}(?:\.\d{3})*,\d{2}`;
/** Valor como o OCR entrega: às vezes sem a vírgula ("1800" é 18,00, "4.97287" é 4.972,87). */
const LAX = String.raw`\d[\d.]*,?\d{2}`;
const LINHA_RE = new RegExp(
  String.raw`^(\d{2})\/(\d{2})\/(\d{4})\s*[-–—]\s*[\d:]{5,8}\s+(?:\d{5,7}\s+)?(.*?)\s*(${LAX})\s*([CD])\s+(${LAX})\s*([CD])\s*$`,
);
const SALDO_ANTERIOR_RE = new RegExp(String.raw`SALDO\s+ANTERIOR\s+R?\$?\s*(${MONEY})\s*([CD])`, "i");

export function isCaixaOcrStatement(texto: string): boolean {
  return veioDeImagem(texto) && /Extrato\s+por\s+per[ií]odo/i.test(texto) && SALDO_ANTERIOR_RE.test(texto);
}

const num = (s: string): number => {
  const limpo = s.replace(/\./g, "");
  return Number(/,/.test(limpo) ? limpo.replace(",", ".") : `${limpo.slice(0, -2)}.${limpo.slice(-2)}`);
};
/** Saldo com sinal: crédito positivo, devedor negativo. */
const comSinal = (valor: number, letra: string): number => (letra === "C" ? valor : -valor);
const centavos = (n: number): number => Math.round(n * 100);

type Linha = { date: string; descricao: string; valorTxt: string; valorLido: number | null; letra: string; saldo: number };

/** Descrição limpa: tira o ruído do OCR (máscaras de CPF, "**", símbolos soltos). */
function limparDescricao(bruto: string): string {
  return bruto
    .split(/\s{2,}|\t/)
    .map((p) => p.trim())
    .filter((p) => p && !/[*]/.test(p) && !/^[\W\d]+$/.test(p))
    .slice(0, 2)
    .join(" · ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Um dígito diferente (ou nenhum) entre o valor lido e a variação do saldo. */
function quaseIgual(lido: string, esperado: string): boolean {
  const a = lido.replace(/\D/g, "");
  const b = esperado.replace(/\D/g, "");
  if (a === b) return true;
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) dif++;
  return dif <= 1;
}

export function parseCaixaOcrStatement(texto: string): ParsedTransaction[] {
  const sa = texto.match(SALDO_ANTERIOR_RE);
  if (!sa) return [];
  const saldoInicial = comSinal(num(sa[1]), sa[2]);

  const linhas: Linha[] = [];
  for (const bruta of texto.split(/\r?\n/)) {
    const m = bruta.replace(/[\t ]+/g, (s) => (s.length > 1 || s === "\t" ? "  " : " ")).trim().match(LINHA_RE);
    if (!m) continue;
    const [, dd, mm, aaaa, meio, valorTxt, letraValor, saldoTxt, letraSaldo] = m;
    // "SALDO DIA" (00:00:00) é o fechamento do dia, fora da ordem do tempo: não entra na conta.
    if (/SALDO\s*DIA/i.test(meio)) continue;
    const valorLido = num(valorTxt);
    linhas.push({
      date: `${aaaa}-${mm}-${dd}`,
      descricao: limparDescricao(meio),
      valorTxt,
      valorLido: comSinal(valorLido, letraValor),
      letra: letraValor,
      saldo: comSinal(num(saldoTxt), letraSaldo),
    });
  }
  if (linhas.length === 0) return [];

  // O extrato vem do mais novo pro mais antigo; a ordem de conferência é a do tempo.
  const cronologico = linhas[0].date > linhas[linhas.length - 1].date ? [...linhas].reverse() : linhas;

  // 1. Variação do saldo de cada linha, em ordem do tempo.
  let anterior = saldoInicial;
  const deltas = cronologico.map((l) => {
    const d = l.saldo - anterior;
    anterior = l.saldo;
    return d;
  });

  // 2. Cada linha: o valor lido bate com a variação?
  const erros = cronologico.map((l, i) => (l.valorLido === null ? null : deltas[i] - l.valorLido));
  // Saldo lido errado numa linha: a variação sai errada nela E com o sinal contrário na linha
  // seguinte. As duas ficam com o valor lido (que bate com o C/D da linha).
  const saldoErrado = new Set<number>();
  for (let i = 0; i + 1 < erros.length; i++) {
    const a = erros[i];
    const b = erros[i + 1];
    if (a !== null && b !== null && centavos(a) !== 0 && centavos(a + b) === 0) {
      saldoErrado.add(i);
      saldoErrado.add(i + 1);
    }
  }

  const out: ParsedTransaction[] = [];
  for (let i = 0; i < cronologico.length; i++) {
    const l = cronologico[i];
    const delta = deltas[i];
    let valor: number;
    if (l.valorLido !== null && (centavos(delta) === centavos(l.valorLido) || saldoErrado.has(i))) {
      valor = l.valorLido;
    } else {
      const esperado = Math.abs(delta).toFixed(2).replace(".", ",");
      const sinalCerto = delta !== 0 && comSinal(1, l.letra) === Math.sign(delta);
      if (!sinalCerto || !quaseIgual(l.valorTxt, esperado)) return [];
      valor = delta;
    }
    if (centavos(valor) === 0) continue;
    out.push({ date: l.date, description: l.descricao || "Lançamento", amount: centavos(valor) / 100 });
  }
  return out;
}
