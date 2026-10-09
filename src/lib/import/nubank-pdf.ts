import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Extrato em PDF do Nubank (conta PF e PJ), o banco mais comum entre quem usa o app.
 *
 * O texto do PDF vem assim:
 *
 *   04 MAI 2026 Total de saídas - 6.500,00        ← dia + bloco (o sinal vem daqui)
 *   Transferência enviada pelo Pix Fulano - •••.370.228-•• - NU
 *   PAGAMENTOS - IP (0260) Agência: 1 Conta:      ← descrição continua por 1 a 4 linhas
 *   5176991-9
 *   6.500,00                                       ← valor sozinho fecha o lançamento
 *   Saldo do dia 2.830,10
 *   08 MAI 2026 Total de saídas - 321,00
 *   Pagamento de boleto efetuado TM CONTABIL 321,00 ← ou o valor no fim da própria linha
 *
 * Um dia com entradas E saídas traz "Total de entradas + X" no cabeçalho do dia e depois uma
 * linha só "Total de saídas - Y" no meio. O parser genérico exigia data e valor na mesma
 * linha, e por isso lia zero lançamentos deste extrato.
 */
const MONTHS: Record<string, string> = {
  JAN: "01", FEV: "02", MAR: "03", ABR: "04", MAI: "05", JUN: "06",
  JUL: "07", AGO: "08", SET: "09", OUT: "10", NOV: "11", DEZ: "12",
};

const DAY_RE = /^(\d{2}) (JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ) (\d{4})(?:\s+Total de (entradas|sa[ií]das)\s+[+-]\s*[\d.]+,\d{2})?\s*$/;
const BLOCK_RE = /^Total de (entradas|sa[ií]das)\s+[+-]\s*[\d.]+,\d{2}\s*$/;
const AMOUNT_ONLY_RE = /^(\d{1,3}(?:\.\d{3})*,\d{2})$/;
const AMOUNT_TAIL_RE = /^(.*\S)\s+(\d{1,3}(?:\.\d{3})*,\d{2})$/;
const NOISE_RE = [
  /^-- \d+ of \d+ --$/,
  /^\d+ de \d+$/,
  /^Saldo do dia\b/,
  /^Extrato gerado dia/,
  /^Tem alguma dúvida\?/,
  /^metropolitanas\)/,
  /^Caso a solução fornecida/,
  /^disponíveis em nubank/,
  /CNPJ\s+Agência\s+Conta/,
  /VALORES EM R\$/,
];

/**
 * O extrato da conta PESSOA FÍSICA não traz "Saldo do dia" — só a conta PJ traz. Enquanto essa
 * linha era obrigatória aqui, o extrato PF caía no leitor genérico, que lia zero lançamentos:
 * uma cliente tentou quatro vezes seguidas, nas duas telas, e desistiu do PDF. O que identifica
 * o extrato do Nubank é a seção "Movimentações" com os blocos "Total de entradas/saídas" e as
 * datas em "DD MES AAAA" — e, se mesmo assim não sair nada, o leitor genérico continua atrás.
 */
export function isNubankStatement(text: string): boolean {
  return (
    /^\s*Movimenta[çc][õo]es\s*$/m.test(text) &&
    /Total de (entradas|sa[ií]das)/.test(text) &&
    /\b\d{2} (JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ) \d{4}\b/.test(text)
  );
}

/**
 * A descrição útil termina antes do CPF/CNPJ mascarado e dos dados bancários do outro lado
 * ("Fulano - •••.370.228-•• - NU PAGAMENTOS - IP (0260) Agência: 1 Conta: 5176991-9" → "Fulano").
 */
function cleanDescription(parts: string[]): string {
  const joined = parts.join(" ").replace(/\s+/g, " ").trim();
  const cut = joined.search(/\s+-\s+(•{3}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
  const base = cut > -1 ? joined.slice(0, cut) : joined;
  return base.replace(/\s+(Agência|Conta):.*$/i, "").trim() || "Lançamento";
}

/** Linha do período no cabeçalho de toda página: "01 DE JANEIRO DE 2026 31 DE JANEIRO DE 2026". */
const PERIODO_RE = /\d{2} DE [A-ZÇ]+ DE \d{4}\s+\d{2} DE [A-ZÇ]+ DE \d{4}/;

export function parseNubankStatement(text: string): ParsedTransaction[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  // Vários extratos mensais juntados num PDF só (ilovepdf & cia): cada mês tem o próprio
  // cabeçalho com período e resumo ("Saldo inicial", "+6.865,33"...). Lido como um extrato só,
  // o resumo do 2º mês em diante virava lançamento e o sinal se perdia (09/10/2026: 9 meses,
  // R$ 24 mil de saídas sumidos). Lê mês a mês, cortando onde o período muda.
  const cortes: number[] = [];
  let periodo = "";
  lines.forEach((l, i) => {
    const m = l.match(PERIODO_RE);
    if (m && m[0] !== periodo) {
      cortes.push(i);
      periodo = m[0];
    }
  });
  if (cortes.length < 2) return parseUmMes(lines, new Set());
  // O nome/CPF/conta que abrem cada página só aparecem antes do 1º período: vale pra todos.
  const topo = new Set(lines.slice(0, cortes[0]).filter(Boolean));
  return cortes.flatMap((ini, k) => parseUmMes(lines.slice(ini, cortes[k + 1] ?? lines.length), topo));
}

function parseUmMes(lines: string[], ruidoExtra: Set<string>): ParsedTransaction[] {
  const start = lines.findIndex((l) => l === "Movimentações");
  if (start === -1) return [];

  // O cabeçalho da página (nome da empresa, conta) repete em toda página e pode cair no
  // meio de uma descrição que atravessou a quebra. Tudo que vem antes de "Movimentações"
  // e não é a linha do período vira lixo conhecido.
  const header = new Set(lines.slice(0, start).filter((l) => l && !/^(R\$\s*)?[+-]?[\d.]+,\d{2}$/.test(l)));
  const isNoise = (l: string) => header.has(l) || ruidoExtra.has(l) || NOISE_RE.some((re) => re.test(l));

  const out: ParsedTransaction[] = [];
  let date = "";
  let sign = -1;
  let pending: string[] = [];

  const close = (rawAmount: string) => {
    const magnitude = Math.abs(parseBrazilianNumber(rawAmount));
    if (!date || Number.isNaN(magnitude) || magnitude === 0) {
      pending = [];
      return;
    }
    out.push({ date, description: cleanDescription(pending), amount: sign * magnitude });
    pending = [];
  };

  for (const line of lines.slice(start + 1)) {
    if (!line || isNoise(line)) continue;
    const day = line.match(DAY_RE);
    if (day) {
      pending = [];
      date = `${day[3]}-${MONTHS[day[2]]}-${day[1]}`;
      if (day[4]) sign = day[4] === "entradas" ? 1 : -1;
      continue;
    }
    const block = line.match(BLOCK_RE);
    if (block) {
      pending = [];
      sign = block[1] === "entradas" ? 1 : -1;
      continue;
    }
    const only = line.match(AMOUNT_ONLY_RE);
    if (only) {
      if (pending.length > 0) close(only[1]);
      continue;
    }
    const tail = line.match(AMOUNT_TAIL_RE);
    if (tail) {
      pending.push(tail[1]);
      close(tail[2]);
      continue;
    }
    pending.push(line);
  }
  return out;
}
