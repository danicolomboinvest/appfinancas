import type { ParsedTransaction } from "./statement-parser";

/**
 * Extrato de banco que nenhum leitor próprio conhece, lido pela conta que o próprio banco faz:
 * o saldo depois de cada lançamento.
 *
 *   05/10/26 às 07:01:00                       ← data (sozinha, ou no começo da linha)
 *   Transferência enviada -R$ 1.600,00 R$ 0,00 ← nome, valor e SALDO no fim da linha
 *   03/10 Pix recebido de Fulano 803,78 2.403,78
 *
 * Cada banco desenha o extrato de um jeito (a Rico põe a hora numa linha só dela; o Santander
 * quebra o nome em duas linhas), e cada jeito novo era um extrato com zero lançamentos até
 * alguém escrever um leitor pra ele. Aqui não importa o desenho: vale toda linha que termina em
 * dois valores (o lançamento e o saldo depois dele), e a leitura só é aceita se o saldo de cada
 * linha for o saldo da linha anterior mais o lançamento, NO CENTAVO, do começo ao fim. Um único
 * degrau que não fecha e o leitor desiste — melhor nada do que dinheiro errado no app.
 *
 * De quebra o sinal sai da conta, não do desenho: se o saldo caiu, foi saída. Isso resolve
 * extrato que imprime todo valor sem sinal.
 */

const VALOR = String.raw`(?:\(\s*)?[-−]?\s?(?:R\$\s?)?[-−]?\s?\d{1,3}(?:\.\d{3})*,\d{2}(?:\s?\))?(?:\s?[CD](?![a-zà-ú])|-)?`;
const DOIS_VALORES_NO_FIM_RE = new RegExp(String.raw`^(.*?)\s*(${VALOR})\s+(${VALOR})\s*$`, "i");
const DATA_RE = /(?<![\d/])(\d{2})\/(\d{2})(?:\/(\d{4}|\d{2}))?(?![\d/])/;
/** "10 SET", "10 set 2026", "10 de Setembro de 2026" (Inter). */
const DATA_MES_RE = /(?<![\d])(\d{1,2}) (?:de )?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zç]*\.?(?: (?:de )?(\d{4}))?(?![a-zç])/i;
const MESES: Record<string, number> = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
const HORA_RE = /\b\d{2}:\d{2}(?::\d{2})?\b/g;
/** Linha que é título, rodapé ou resumo, nunca nome de lançamento. */
const NAO_E_NOME_RE = /^(data\b|descri[çc][ãa]o|hist[óo]rico|lan[çc]amentos?$|valor|saldo|extrato|p[áa]gina|-- \d+ of|ag[êe]ncia|conta\b|cliente|per[íi]odo|documento)/i;
/** Linha de saldo (saldo anterior, saldo do dia, saldo final): é conferência, não lançamento. */
const LINHA_DE_SALDO_RE = /\bsaldo\b|\bs\s+a\s+l\s+d\s+o\b/i;
const SALDO_ANTERIOR_RE = new RegExp(String.raw`saldo\s+(?:anterior|inicial)[^\n\d-]*?(${VALOR})`, "i");

interface Linha {
  date: string | null;
  nome: string;
  valor: number; // com o sinal impresso (ou sem sinal)
  temSinal: boolean;
  saldo: number;
}

function numero(token: string): { n: number; negativo: boolean } {
  const t = token.replace(/\s/g, "");
  const negativo = /^\(|[-−]|D$/i.test(t.replace(/^R\$/, "")) && !/C$/i.test(t);
  const m = t.match(/\d{1,3}(?:\.\d{3})*,\d{2}/);
  const n = m ? Number(m[0].replace(/\./g, "").replace(",", ".")) : NaN;
  return { n, negativo };
}

const centavos = (n: number) => Math.round(n * 100);

function anoDoTexto(texto: string, refYear?: number): number {
  const anos = new Map<number, number>();
  for (const m of texto.matchAll(/(?<![\d/])\d{2}\/\d{2}\/(\d{4})(?!\d)/g)) anos.set(Number(m[1]), (anos.get(Number(m[1])) ?? 0) + 1);
  const maisComum = [...anos.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return maisComum ?? refYear ?? new Date().getFullYear();
}

function lerData(trecho: string, ano: number): string | null {
  const m = trecho.match(DATA_RE);
  if (m) {
    const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : ano;
    const mes = Number(m[2]);
    const dia = Number(m[1]);
    if (mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31) return `${y}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  }
  const n = trecho.match(DATA_MES_RE);
  if (n) {
    const mes = MESES[n[2].slice(0, 3).toLowerCase()];
    const y = n[3] ? Number(n[3]) : ano;
    return `${y}-${String(mes).padStart(2, "0")}-${n[1].padStart(2, "0")}`;
  }
  return null;
}

const semDataNemHora = (s: string) =>
  s.replace(DATA_RE, " ").replace(DATA_MES_RE, " ").replace(HORA_RE, " ").replace(/\bàs\b/gi, " ").replace(/\s+/g, " ").trim();

export function lerExtratoPeloSaldo(texto: string, refYear?: number): ParsedTransaction[] | null {
  const ano = anoDoTexto(texto, refYear);
  const linhas: Linha[] = [];
  let dataAtual: string | null = null;
  let antes: string[] = []; // linhas soltas desde o último lançamento: pedaços do nome

  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.replace(/\t/g, " ").replace(/\s+/g, " ").trim();
    if (!linha) continue;
    const m = linha.match(DOIS_VALORES_NO_FIM_RE);
    const data = lerData(linha, ano);
    if (!m) {
      if (data) {
        dataAtual = data;
        antes = [];
      }
      const resto = semDataNemHora(linha);
      if (resto && !NAO_E_NOME_RE.test(resto) && !/\d{1,3}(?:\.\d{3})*,\d{2}/.test(resto)) antes = [...antes, resto].slice(-2);
      else if (!data) antes = [];
      continue;
    }
    if (data) dataAtual = data;
    const proprio = semDataNemHora(m[1]);
    if (LINHA_DE_SALDO_RE.test(proprio) && !antes.length) {
      antes = [];
      continue;
    }
    const v = numero(m[2]);
    const s = numero(m[3]);
    if (!Number.isFinite(v.n) || !Number.isFinite(s.n) || v.n === 0) {
      antes = [];
      continue;
    }
    const nome = [...antes, proprio].filter(Boolean).join(" ").trim() || "Lançamento";
    linhas.push({ date: dataAtual, nome, valor: v.negativo ? -v.n : v.n, temSinal: /[-−(]|\bD$|C$/i.test(m[2].trim()), saldo: s.negativo ? -s.n : s.n });
    antes = [];
  }

  if (linhas.length < 2 || linhas.some((l) => !l.date)) return null;
  // Linha de saldo com nome (ex.: "SALDO DO DIA" depois de lançamentos) estraga a corrente.
  const lanc = linhas.filter((l) => !LINHA_DE_SALDO_RE.test(l.nome));
  if (lanc.length < 2) return null;

  const ordem = ["crescente", "decrescente"] as const;
  for (const sentido of ordem) {
    const lista = sentido === "crescente" ? lanc : [...lanc].reverse();
    // lista em ordem do tempo: saldo[i] = saldo[i-1] + valor[i]
    const sinais: number[] = [];
    let fecha = true;
    for (let i = 1; i < lista.length; i++) {
      const d = centavos(lista[i].saldo) - centavos(lista[i - 1].saldo);
      const v = centavos(Math.abs(lista[i].valor));
      if (Math.abs(d) !== v) {
        fecha = false;
        break;
      }
      // Sinal impresso que contradiz o saldo: não é a coluna que a gente acha que é.
      if (lista[i].temSinal && Math.sign(lista[i].valor) !== Math.sign(d)) {
        fecha = false;
        break;
      }
      sinais[i] = Math.sign(d);
    }
    if (!fecha) continue;
    // O primeiro lançamento no tempo não tem saldo antes dele no arquivo: o sinal vem do
    // "Saldo anterior" impresso, do sinal impresso, ou de começar do zero. Sem nenhum, desiste.
    const primeiro = lista[0];
    const anterior = texto.match(SALDO_ANTERIOR_RE);
    const saldoAnterior = anterior ? numero(anterior[1]) : null;
    const v0 = centavos(Math.abs(primeiro.valor));
    if (saldoAnterior && Number.isFinite(saldoAnterior.n)) {
      const d0 = centavos(primeiro.saldo) - centavos(saldoAnterior.negativo ? -saldoAnterior.n : saldoAnterior.n);
      if (Math.abs(d0) !== v0) return null;
      if (primeiro.temSinal && Math.sign(primeiro.valor) !== Math.sign(d0)) return null;
      sinais[0] = Math.sign(d0);
    } else if (primeiro.temSinal) {
      sinais[0] = Math.sign(primeiro.valor);
    } else if (centavos(primeiro.saldo) === v0) {
      sinais[0] = 1;
    } else {
      return null;
    }
    const out = lista.map((l, i) => ({ date: l.date as string, description: l.nome, amount: sinais[i] * Math.abs(l.valor) }));
    return sentido === "crescente" ? out : out.reverse();
  }
  return null;
}
