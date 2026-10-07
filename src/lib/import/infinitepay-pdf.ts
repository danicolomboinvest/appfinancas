import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * "Relatório de movimentações" da conta InfinitePay (CloudWalk), em PDF.
 *
 * Cada dia é um bloco que começa no cabeçalho da tabela, e o lançamento só tem a HORA. As datas
 * dos blocos vêm todas juntas no pé da página, na mesma ordem dos blocos:
 *
 *   Data   Hora   Tipo de transação   Nome   Detalhe   Valor (R$)       ← abre o 1º bloco
 *   12:04  Pix   Pix FULANA DE TAL   Recebido   +50,00
 *   Saldo do dia   + 312,39                                           ← só no relatório completo
 *   Data   Hora   Tipo de transação   Nome   Detalhe   Valor (R$)       ← abre o 2º bloco
 *   00:28  Depósito de vendas   Vendas   Depósito InfinitePay   +48,43
 *   09:02 Fatura de cartão de                                         ← linha quebrada em duas
 *   crédito Fatura • Set 2026   Pago   --R$ 575,58
 *   01 Set, 2026                                                      ← data do 1º bloco
 *   02 Set, 2026                                                      ← data do 2º bloco
 *   -- 1 of 9 --
 *
 * O bloco que continua na página seguinte repete o cabeçalho lá e a data no pé dela. Sem data em
 * linha nenhuma, o leitor genérico não lia nada (558 linhas com valor, zero lançamentos).
 */

const MESES: Record<string, string> = {
  jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06",
  jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12",
};

const CABECALHO_RE = /^Data\s+Hora\s+Tipo de transa[çc][ãa]o\b/i;
const DATA_RE = /^(\d{2}) ([A-Za-z]{3}), (\d{4})$/;
const HORA_RE = /^\d{2}:\d{2}\b/;
/** "+50,00", "-1.000,00" e "--R$ 575,58" (pagamento de fatura) no fim da linha. */
const VALOR_RE = /\s([+-])-?\s*(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})$/;
const PAGINA_RE = /^-- \d+ of \d+ --$/;

export function isInfinitePayStatement(texto: string): boolean {
  return /infinitepay|cloudwalk/i.test(texto) && /Relat[óo]rio de movimenta[çc][õo]es/i.test(texto) &&
    texto.split(/\r?\n/).some((l) => CABECALHO_RE.test(l.trim()));
}

function paraIso(linha: string): string | null {
  const m = linha.match(DATA_RE);
  const mes = m && MESES[m[2].toLowerCase()];
  return m && mes ? `${m[3]}-${mes}-${m[1]}` : null;
}

/** "Pix · Pix FULANA · Recebido" → "Pix FULANA"; "Depósito de vendas · Vendas · Depósito InfinitePay" → os três. */
function descricao(meio: string): string {
  const partes = meio.split("\t").map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
  // Linha quebrada perde as tabulações: "Pix Pix FULANA DE TAL Recebido".
  if (partes.length < 2)
    return meio.replace(/\s+/g, " ").trim().replace(/^(\S+) \1 /, "$1 ").replace(/ (recebido|enviado|pago)$/i, "");
  const [tipo, nome, ...resto] = partes;
  const base = nome.toLowerCase().startsWith(tipo.toLowerCase()) ? nome : `${tipo} ${nome}`;
  const detalhe = resto.filter((d) => !/^(recebido|enviado|pago)$/i.test(d));
  return [base, ...detalhe].join(" · ");
}

export function parseInfinitePayStatement(texto: string): ParsedTransaction[] {
  const out: ParsedTransaction[] = [];
  let pagina: { blocos: { meio: string; valor: number }[][]; datas: string[] } = { blocos: [], datas: [] };
  let pendente: string | null = null;

  const fecharPagina = (): boolean => {
    // Bloco sem data (ou data sem bloco): o PDF saiu diferente do molde; melhor não ler nada
    // do que pôr lançamento no dia errado.
    if (pagina.blocos.length !== pagina.datas.length) return false;
    pagina.blocos.forEach((bloco, i) => {
      for (const l of bloco) out.push({ date: pagina.datas[i], description: l.meio || "Lançamento", amount: l.valor });
    });
    pagina = { blocos: [], datas: [] };
    return true;
  };

  for (const bruta of [...texto.split(/\r?\n/), "-- fim --"]) {
    const linha = bruta.trim();
    if (PAGINA_RE.test(linha) || linha === "-- fim --") {
      pendente = null;
      if (!fecharPagina()) return [];
      continue;
    }
    if (CABECALHO_RE.test(linha)) {
      pagina.blocos.push([]);
      pendente = null;
      continue;
    }
    const data = paraIso(linha);
    if (data) {
      pagina.datas.push(data);
      continue;
    }
    const bloco = pagina.blocos.at(-1);
    if (!bloco) continue;
    if (/^Saldo do dia\b/i.test(linha)) {
      pendente = null;
      continue;
    }
    // Lançamento começa na hora; nome comprido quebra e o valor vem na linha de baixo.
    if (HORA_RE.test(linha)) pendente = linha;
    else if (pendente !== null) pendente += ` ${linha}`;
    else continue;
    const m = pendente.match(VALOR_RE);
    if (!m) continue;
    const magnitude = parseBrazilianNumber(m[2]);
    const semValor = pendente.slice(0, m.index).replace(HORA_RE, "");
    pendente = null;
    if (Number.isNaN(magnitude) || magnitude === 0) continue;
    bloco.push({ meio: descricao(semValor.replace(/^\s+/, "")), valor: m[1] === "-" ? -magnitude : magnitude });
  }
  return out;
}
