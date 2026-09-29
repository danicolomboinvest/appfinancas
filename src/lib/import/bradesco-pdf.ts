import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Extrato de conta do Bradesco em PDF (o que o app "Bradesco Celular" exporta).
 *
 * Crédito e débito são colunas separadas, mas no texto do PDF viram um número só, seguido do
 * saldo. A data só aparece no PRIMEIRO lançamento do dia, e o histórico ocupa a linha de cima:
 *
 *   Data Histórico Docto. Crédito (R$) Débito (R$) Saldo (R$)
 *   26/08/2026 COD. LANC. 0 0,00 45,72                 ← saldo de abertura
 *   27/08/2026 PIX ENVIADO                             ← abre o dia
 *   DES: PADARIA EXEMPLO 27/08 1000001 19,00 26,72     ← valor e saldo depois dele
 *   PIX RECEBIDO                                       ← mesmo dia, sem data
 *   REM: FULANO 27/08 1000004 100,00 126,72
 *   Total 1.100,00 619,00 526,72
 *
 * O leitor genérico pegava o ÚLTIMO número da linha (o saldo) como valor e só lia o lançamento
 * que tinha data: 17 de 75 linhas, todas com o valor errado. Aqui o valor é o penúltimo número,
 * e o sinal sai da variação do saldo — que é a única coisa que diz se foi crédito ou débito.
 */

const CABECALHO_RE = /^Data\s+Hist[óo]rico\s+Docto\.?\s+Cr[ée]dito/i;
const DATA_RE = /^(\d{2})\/(\d{2})\/(\d{4})\s+/;
const MONEY = String.raw`-?\d{1,3}(?:\.\d{3})*,\d{2}`;
/** "... 1000001 19,00 26,72": docto (opcional), valor e saldo no fim da linha. */
const FECHA_RE = new RegExp(String.raw`^(.*?)\s*(?:\b\d{5,}\s+)?(${MONEY})\s+(${MONEY})$`);
const RODAPE_TOTAL_RE = new RegExp(String.raw`^Total(?:\s+${MONEY}){2,3}$`, "i");
const RUIDO_RE = [
  /^Bradesco Celular$/i,
  /^Data:\s*\d{2}\/\d{2}\/\d{4}/i,
  /^Nome:/i,
  /^Extrato de:/i,
  /^-- \d+ of \d+ --$/,
  /^Extrato inexistente$/i,
];
const CREDITO_RE = /^(REM:|PIX RECEBIDO|TED RECEBID|TRANSF.*RECEBID|RENTAB|CR[ÉE]DITO|DEP[ÓO]SITO)/i;

export function isBradescoStatement(texto: string): boolean {
  return texto.split(/\r?\n/).some((l) => CABECALHO_RE.test(l.trim())) && /Bradesco/i.test(texto);
}

export function parseBradescoStatement(texto: string): ParsedTransaction[] {
  const out: ParsedTransaction[] = [];
  let dentro = false;
  let data: string | null = null;
  let saldo: number | null = null;
  let pendente: string[] = [];

  for (const bruta of texto.split(/\r?\n/)) {
    let linha = bruta.replace(/\t/g, " ").replace(/\s+/g, " ").trim();
    if (!linha) continue;
    if (CABECALHO_RE.test(linha)) {
      dentro = true;
      pendente = [];
      continue;
    }
    if (!dentro || RUIDO_RE.some((re) => re.test(linha))) continue;
    // Só o rodapé de verdade ("Total 1.100,00 619,00 526,72": crédito, débito e saldo) encerra.
    // Qualquer linha começando com "Total" encerrava: "TOTAL EXPRESS" (transportadora) ou um
    // posto Total na 2ª linha do histórico cortava o resto do extrato sem nenhum aviso.
    if (RODAPE_TOTAL_RE.test(linha)) break;

    const d = linha.match(DATA_RE);
    if (d) {
      data = `${d[3]}-${d[2]}-${d[1]}`;
      linha = linha.slice(d[0].length);
      pendente = [];
    }

    const m = linha.match(FECHA_RE);
    if (!m || !data) {
      if (pendente.length < 3) pendente.push(linha);
      continue;
    }
    const valor = parseBrazilianNumber(m[2]);
    const novoSaldo = parseBrazilianNumber(m[3]);
    const partes = [...pendente, m[1]].map((p) => p.trim()).filter(Boolean);
    pendente = [];
    if (Number.isNaN(valor) || Number.isNaN(novoSaldo)) continue;

    // Saldo de abertura ("COD. LANC. 0  0,00  45,72") só serve de ponto de partida.
    if (valor === 0) {
      saldo = novoSaldo;
      continue;
    }
    let credito: boolean;
    if (saldo !== null && Math.abs(Math.abs(novoSaldo - saldo) - valor) < 0.005) {
      credito = novoSaldo > saldo;
    } else {
      credito = partes.some((p) => CREDITO_RE.test(p));
    }
    saldo = novoSaldo;
    const descricao = partes
      .join(" ")
      .replace(/\s\d{2}\/\d{2}$/, "") // "DES: PADARIA 27/08": a data do Pix repete a do lançamento
      .replace(/\s+/g, " ")
      .trim();
    out.push({ date: data, description: descricao || "Lançamento", amount: credito ? valor : -valor });
  }
  return out;
}
