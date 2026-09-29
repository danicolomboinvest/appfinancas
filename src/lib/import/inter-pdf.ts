import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Extrato do Banco Inter em PDF (o que o app gera em "Extrato > Exportar > PDF").
 *
 * O dia vem por extenso, numa linha própria junto com o saldo do dia, e os lançamentos daquele
 * dia vêm embaixo SEM data nenhuma:
 *
 *   Solicitado em: 27/09/2026 - 11h05
 *   Período: 27/08/2026 a 27/09/2026
 *   27 de Agosto de 2026 Saldo do dia: R$ 1.234,56       ← abre o dia (e não é movimento)
 *   Pix enviado: "Cp :00000000-PADARIA" -R$ 50,00 R$ 1.184,56
 *   Pix recebido: "Cp :00000000-FULANO" R$ 100,00 R$ 1.284,56
 *                                    ↑ valor   ↑ saldo depois do lançamento
 *
 * O leitor genérico procura uma data no começo de CADA lançamento e pega o ÚLTIMO valor da
 * linha. Aqui as duas coisas dão errado: a data por extenso não era reconhecida (nenhum
 * lançamento abria) e o último valor é o saldo, não o lançamento. Resultado: 52 linhas com
 * valor no arquivo, zero lidas.
 */

const MESES: Record<string, string> = {
  janeiro: "01", fevereiro: "02", marco: "03", abril: "04", maio: "05", junho: "06",
  julho: "07", agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12",
};

const DIA_RE = /^(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})\b/i;
/** "-R$ 50,00", "- R$ 50,00", "R$ -50,00", "R$ 100,00": o sinal pode vir antes ou depois do R$. */
const VALOR_RE = /(-\s*)?R\$\s*(-\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})(?!\d)/g;
/** No PDF de verdade, o primeiro dia vem grudado no título da coluna, na mesma linha:
 * "Valor  Saldo por transação  27 de Agosto de 2026 Saldo do dia: ...". Sem tirar o título, o
 * primeiro dia não abria e os lançamentos dele sumiam. */
const TITULO_RE = /^Valor\s+Saldo por transa[çc][ãa]o\s*/i;
const RUIDO_RE = [
  /^Solicitado em:/i,
  /^Per[íi]odo:/i,
  /^Valor\s+Saldo/i,
  /^Fale com a gente/i,
  /^SAC\b|^Ouvidoria\b|^Defici[êe]ncia de fala/i,
  /^-- \d+ of \d+ --$/,
  /^\d+\s*(?:\/|de)\s*\d+$/,
];

export function isInterStatement(texto: string): boolean {
  return /Solicitado em:\s*\d{2}\/\d{2}\/\d{4}/i.test(texto) && /Saldo do dia/i.test(texto) && DIA_RE.test(primeiroDia(texto));
}

function primeiroDia(texto: string): string {
  return texto.split(/\r?\n/).map((l) => l.replace(/\t/g, " ").trim().replace(TITULO_RE, "")).find((l) => DIA_RE.test(l)) ?? "";
}

function mesPorExtenso(nome: string): string | undefined {
  return MESES[nome.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "")];
}

export function parseInterStatement(texto: string): ParsedTransaction[] {
  const linhas = texto.split(/\r?\n/).map((l) => l.replace(/\t/g, " ").trim().replace(TITULO_RE, ""));
  const out: ParsedTransaction[] = [];
  let data: string | null = null;
  let pendente: string[] = [];

  for (const linha of linhas) {
    if (!linha) continue;

    const dia = linha.match(DIA_RE);
    const mes = dia ? mesPorExtenso(dia[2]) : undefined;
    if (dia && mes) {
      data = `${dia[3]}-${mes}-${dia[1].padStart(2, "0")}`;
      pendente = [];
      continue;
    }
    // Tudo antes do primeiro dia é cabeçalho (nome, CPF, conta, saldos do topo).
    if (!data) continue;
    if (RUIDO_RE.some((re) => re.test(linha))) {
      pendente = [];
      continue;
    }

    const valores = [...linha.matchAll(VALOR_RE)];
    if (valores.length === 0) {
      // Descrição comprida quebra a linha e o valor desce pra de baixo.
      if (pendente.length < 2) pendente.push(linha);
      continue;
    }

    // O PRIMEIRO valor é o lançamento; o segundo, quando existe, é o saldo depois dele.
    const [primeiro] = valores;
    const descricao = [...pendente, linha.slice(0, primeiro.index)].join(" ").replace(/\s+/g, " ").trim();
    pendente = [];
    if (!descricao || /^saldo\b/i.test(descricao)) continue;
    const magnitude = parseBrazilianNumber(primeiro[3]);
    if (Number.isNaN(magnitude) || magnitude === 0) continue;
    const negativo = Boolean(primeiro[1] || primeiro[2]);
    out.push({ date: data, description: descricao.replace(/:\s*$/, ""), amount: negativo ? -magnitude : magnitude });
  }

  return out;
}

/**
 * Fatura do cartão do Banco Inter em PDF.
 *
 *   Despesas da fatura
 *   CARTÃO 0000****0000
 *   Data  Movimentação  Beneficiário  Valor
 *   23 de jun. 2026 LOJA EXEMPLO (Parcela 03 de 03)   -   R$ 73,61      ← compra
 *   06 de ago. 2026 LOJA ESTORNADA                    -   + R$ 67,20    ← estorno/crédito
 *   11 de ago. 2026 PAGAMENTO ON LINE                 -   + R$ 450,00   ← pagamento da anterior
 *   Total CARTÃO 0000****0000   R$ 6,41
 *
 * O leitor genérico não reconhecia a data "23 de jun. 2026" e pegava números das tabelas de
 * parcelamento: uma fatura de R$ 4.527 saiu com 10 lançamentos somando R$ 41 mil. Aqui a compra
 * sai POSITIVA e o crédito ("+ R$") NEGATIVO; quem importa decide pelo sinal da maioria (ver
 * `comprasDaFaturaSaoPositivas`) e o pagamento sai como linha de resumo.
 */
const FATURA_LINHA_RE =
  /^(\d{1,2})\s+de\s+([a-zç]{3})[a-zç]*\.?\s+(\d{4})\s+(.+?)\s+-\s+(\+\s*)?R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})$/i;

export function isInterInvoice(texto: string): boolean {
  return /Despesas da fatura/i.test(texto) && /\bCART[ÃA]O\s+\d{4}\*{4}\d{4}/i.test(texto);
}

export function parseInterInvoice(texto: string): ParsedTransaction[] {
  const out: ParsedTransaction[] = [];
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.replace(/\t/g, " ").replace(/\s+/g, " ").trim();
    const m = linha.match(FATURA_LINHA_RE);
    if (!m) continue;
    const [, dia, mesAbrev, ano, descricao, credito, valor] = m;
    const mes = mesPorExtenso(Object.keys(MESES).find((nome) => nome.startsWith(mesAbrev.toLowerCase().replace("ç", "c"))) ?? "");
    const magnitude = parseBrazilianNumber(valor);
    if (!mes || Number.isNaN(magnitude) || magnitude === 0) continue;
    out.push({ date: `${ano}-${mes}-${dia.padStart(2, "0")}`, description: descricao.trim(), amount: credito ? -magnitude : magnitude });
  }
  return out;
}
