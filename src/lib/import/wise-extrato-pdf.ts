import { parseAmountFlexible, type ParsedTransaction } from "./statement-parser";

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
  // português
  janeiro: "01", fevereiro: "02", março: "03", marco: "03", abril: "04", maio: "05", junho: "06",
  julho: "07", agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12",
  // inglês
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06", july: "07",
  august: "08", september: "09", october: "10", november: "11", december: "12",
  // espanhol
  enero: "01", febrero: "02", mayo: "05", junio: "06", julio: "07", septiembre: "09", setiembre: "09",
  octubre: "10", noviembre: "11", diciembre: "12",
  // italiano
  gennaio: "01", febbraio: "02", aprile: "04", maggio: "05", giugno: "06", luglio: "07", settembre: "09",
  ottobre: "10", dicembre: "12",
  // alemão
  januar: "01", februar: "02", märz: "03", maerz: "03", juni: "06", juli: "07", oktober: "10", dezember: "12",
  // francês
  janvier: "01", février: "02", fevrier: "02", mars: "03", avril: "04", mai: "05", juin: "06",
  juillet: "07", août: "08", aout: "08", octobre: "10", décembre: "12", decembre: "12",
};
/** Valor de dinheiro como a Wise escreve: "1.234,56" (português, espanhol, italiano, alemão) ou "1,234.56" (inglês). */
const VALOR = String.raw`-?\d{1,3}(?:[.,]\d{3})*[.,]\d{2}`;
const FIM_RE = new RegExp(String.raw`^(.*?)\s*(${VALOR})\s+(${VALOR})$`);
const DATA_RE = /^(\d{1,2})\.?(?: de)? ([a-zçãéíóúäü]+),?(?: de)? (\d{4}) \|/i;
const CARTAO_RE =
  /^(?:Transa[çc][ãa]o por cart[ãa]o|Card transaction|Transacci[óo]n con tarjeta|Transazione con carta|Kartentransaktion|Transaction par carte)\s+(?:de|of|von)\s+[\d.,]+ [A-Z]{3}\s+(?:emitida por|issued by|emessa da|ausgestellt von|[ée]mise par)\s*/i;
const CONVERSAO_RE = /^([\d.,]+) ([A-Z]{3}) (?:convertidos? (?:para|a)|converted to|convertiti in|umgewandelt in|convertis en)\s+([\d.,]+) ([A-Z]{3})\b/i;
/** O cabeçalho da tabela: "Descrição Entrada Saída Valor", "Description Incoming Outgoing Amount"... */
const CABECALHO_TABELA_RE = /^(?:Descri[çc][ãa]o|Description|Descripci[óo]n|Descrizione|Beschreibung)\s+\S+\s+\S+\s+\S+$/i;
const TITULO_EXTRATO_RE = /(?:Extrato em|Statement in|Extracto en|Estratto conto in|Kontoauszug in|Relev[ée] en)\s+[A-Z]{3}\b|\b[A-Z]{3} statement\b/i;

export function isWiseStatement(texto: string): boolean {
  return (
    /\bWise Payments\b/i.test(texto) &&
    TITULO_EXTRATO_RE.test(texto) &&
    texto.split(/\r?\n/).some((l) => CABECALHO_TABELA_RE.test(l.replace(/\s+/g, " ").trim()))
  );
}

const numero = (s: string) => parseAmountFlexible(s);

export function parseWiseStatement(texto: string): ParsedTransaction[] {
  const linhas = texto.split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim());
  const inicio = linhas.findIndex((l) => CABECALHO_TABELA_RE.test(l));
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

const SALDO_FINAL_RE = new RegExp(String.raw`^[A-Z]{3} (?:em|on|el|il|am|le) .+? (${VALOR}) [A-Z]{3}$`);

/**
 * Os dois saldos que o próprio extrato imprime: o final no alto ("EUR em 13 de outubro de 2026
 * 94,94 EUR") e o inicial, que é o saldo da linha mais antiga menos o valor dela. As linhas lidas
 * têm que somar a diferença, no centavo; é a conferência que diz que nenhuma ficou de fora.
 */
export function saldosDoExtratoWise(texto: string): { inicial: number; final: number } | null {
  const linhas = texto.split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim());
  const inicio = linhas.findIndex((l) => CABECALHO_TABELA_RE.test(l));
  if (inicio < 0) return null;
  const final = linhas.slice(0, inicio).map((l) => l.match(SALDO_FINAL_RE)).find(Boolean);
  let ultima: RegExpMatchArray | null = null;
  for (const l of linhas.slice(inicio + 1)) {
    if (/^A Wise Payments Limited/i.test(l)) break;
    if (DATA_RE.test(l)) continue;
    const m = l.match(FIM_RE);
    if (m) ultima = m;
  }
  if (!final || !ultima) return null;
  const centavos = (n: number) => Math.round(n * 100) / 100;
  return { final: numero(final[1]), inicial: centavos(numero(ultima[3]) - numero(ultima[2])) };
}
