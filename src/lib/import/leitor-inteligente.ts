import { conferirLeitura } from "./conferencia";
import { pareceEstorno } from "./estorno";
import { detectDocKind } from "./detect";
import { comprasDaFaturaSaoPositivas, isFaturaSummaryLine } from "./fatura-lines";
import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Leitor de fatura que TESTA jeitos de ler e fica com o que bate com o total do documento.
 *
 * Os formatos que o app não conhecia (Smiles/BB, C6, Nubank, Bradesco, Santander, Riachuelo)
 * não eram "diferentes de tudo": cada um tropeçava numa mesma lista curta de coisas que cada
 * banco faz do seu jeito —
 *   1. a data no começo da linha ou no meio dela ("LOJA <TAB> 31/08 BR R$ 23,00");
 *   2. o menos antes do valor, depois dele ("5.607,40-", "56,89 -") ou nenhum sinal;
 *   3. o valor na mesma linha ou algumas linhas abaixo (compra em dólar, cidade quebrada);
 *   4. vários números na linha (valor original, cotação do dólar numa coluna ao lado);
 *   5. pedaços que não são gasto do mês: parcelas das PRÓXIMAS faturas, boleto, simulação;
 *   6. o ano, que não vem na linha e sai do fechamento/vencimento.
 * O leitor sabe as variações de cada item e tenta as combinações, da mais simples para a mais
 * solta. Só devolve uma leitura quando a soma FECHA com o total que a própria fatura imprime —
 * senão devolve null e o app segue como antes. Nunca troca uma leitura por um palpite.
 */

export type Opcoes = {
  /** Data em qualquer lugar da linha (a última antes do valor), não só no começo. */
  dataNoMeio: boolean;
  /** Linha com data e sem valor espera o valor em até 3 linhas curtas abaixo. */
  valorAbaixo: boolean;
  /** Numa linha com TAB, o valor é o do pedaço da data (a coluna ao lado é cotação/US$). */
  valorNoPedacoDaData: boolean;
  /** Só lê depois do primeiro cabeçalho de lançamentos ("Lançamentos", "Transações de"...). */
  soDepoisDoCabecalho: boolean;
  /** Até onde vai um bloco de "próximas faturas"/boleto: até a página virar, ou até o próximo cabeçalho. */
  blocoFuturoAtePagina: boolean;
};

const MESES: Record<string, string> = {
  jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06",
  jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12",
};

const MES = "(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)";
/** 31/08, 31/08/26, 31/08/2026, 31/08/2 (Porto Seguro corta o ano), 31 AGO, 31 ago 2026, 31 de ago. 2026. */
const DATA = String.raw`(\d{2})(?:\/(\d{2})(?:\/(\d{4}|\d{2}|\d))?|\s+(?:de\s+)?${MES}\.?(?:\s+(?:de\s+)?(\d{4}))?)`;
const DATA_INICIO_RE = new RegExp(String.raw`^(?:\d\s+)?${DATA}(?=\s|$)`, "i");
const DATA_QUALQUER_RE = new RegExp(String.raw`(?:^|\s)${DATA}(?=\s|$)`, "gi");
/** Valor com o sinal que estiver colado nele: "-R$ 10,00", "R$ -10,00", "10,00-", "10,00 -", "+ 10,00". */
const VALOR_RE = /([−-]|\+)?\s*(?:R\$\s*)?([−-])?\s*(\d{1,3}(?:\.\d{3})*,\d{2})(?![\d%])(\s?[−-](?!\s*\d))?/g;

const CABECALHO_RE =
  /^(lan[çc]amentos?\b|transa[çc][õo]es\b|detalhamento da fatura|hist[óo]rico de (despesas|lan[çc]amentos)|data\s+(descri[çc][ãa]o|hist[óo]rico|estabelecimento|loja))/i;
/** Começo de um pedaço que NÃO é gasto deste mês. */
const BLOCO_FUTURO_RE =
  /(pr[óo]xim[ao]s?\s+faturas?|parcelamentos?\s+pr[óo]xim|total\s+parcelado\s+para|ficha\s+de\s+compensa|recibo\s+do\s+pagador|formas\s+de\s+pagamento|op[çc][õo]es\s+de\s+pagamento|parcele\s+(sua|esta)\s+fatura|limites?\s+de\s+cr[ée]dito|encargos\s+financeiros)/i;
const IOF_SEM_DATA_RE = /^(repasse\s+de\s+)?iof\b/i;
const VIRA_PAGINA_RE = /^(--\s*\d+\s+of\s+\d+\s*--|p[áa]gina\s+\d+)/i;
/** Linha que é resumo/total/tabela, nunca um lançamento. */
const NAO_LANCAMENTO_RE =
  /\b(saldo\s+(anterior|atual|desta|final|devedor|em\s+aberto|total|restante|parcelado|do\s+dia)|total\b|subtotal|limite\s+(total|dispon|utiliz|de\s+(saque|cr[ée]dito|compra)|[úu]nico)|resumo|fatura\s+anterior|pagamento\s+m[íi]nimo|vencimento|melhor\s+(dia|data)|juros\s+(rotativo|de\s+mora|m[áa]ximo)|cet\b)/i;

const FECHAMENTO_RES: RegExp[] = [
  /fechad[ao]\s+em[\s\S]{0,120}?\d{2}\/(\d{2})\/(\d{4}|\d{2})\b/i,
  /fechamento\s+(?:desta\s+fatura\s+)?em\s+\d{2}\/(\d{2})\/(\d{4}|\d{2})\b/i,
  /emiss[ãa]o\s+e\s+envio\s+\d{2}\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s+(\d{4})/i,
  /vencimento[\s\S]{0,40}?\d{2}\/(\d{2})\/(\d{4})\b/i,
];

/** Mês/ano de referência da fatura: compra de mês DEPOIS dele é do ano anterior. */
export function referencia(texto: string, refYear: number): { mes: number | null; ano: number } {
  for (const re of FECHAMENTO_RES) {
    const m = texto.match(re);
    if (!m) continue;
    const mes = /^\d+$/.test(m[1]) ? Number(m[1]) : Number(MESES[m[1].toLowerCase()]);
    const ano = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
    return { mes, ano };
  }
  return { mes: null, ano: refYear };
}

type Data = { dd: string; mm: string; ano: number | null; inicio: number; fim: number };

function lerData(m: RegExpMatchArray, deslocamento: number): Data | null {
  const [, dd, mmNum, anoNum, mesNome, anoExtenso] = m;
  const mm = mmNum ?? MESES[(mesNome ?? "").toLowerCase()];
  if (!mm || Number(dd) < 1 || Number(dd) > 31 || Number(mm) < 1 || Number(mm) > 12) return null;
  const anoTxt = anoNum ?? anoExtenso;
  // Ano de um dígito só é ano cortado: vale o do fechamento.
  const ano = anoTxt && anoTxt.length > 1 ? (anoTxt.length === 2 ? 2000 + Number(anoTxt) : Number(anoTxt)) : null;
  return { dd, mm, ano, inicio: deslocamento + (m.index ?? 0), fim: deslocamento + (m.index ?? 0) + m[0].length };
}

type Valor = { magnitude: number; credito: boolean; inicio: number; fim: number };

function valores(trecho: string, deslocamento: number): Valor[] {
  const out: Valor[] = [];
  for (const m of trecho.matchAll(VALOR_RE)) {
    const [inteiro, antes, dentro, numero, depois] = m;
    const magnitude = parseBrazilianNumber(numero);
    if (Number.isNaN(magnitude)) continue;
    const credito = antes === "-" || antes === "−" || !!dentro || !!depois;
    const inicio = deslocamento + (m.index ?? 0);
    out.push({ magnitude, credito, inicio, fim: inicio + inteiro.length });
  }
  return out;
}

/** Descrição com cara de loja: tem letra, e sobra pouco número solto. */
function limparDescricao(texto: string): string {
  return texto
    .replace(/\t/g, " ")
    .replace(/^\s*•+\s*\d{4}\s+/, "") // final do cartão ("•••• 1234")
    .replace(/(\s+[\d.,]+)+\s*$/, "") // números soltos no fim (US$, cotação, valor original)
    .replace(/\s+(BR|R\$|[+-])$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function lerComOpcoes(texto: string, op: Opcoes, ref: { mes: number | null; ano: number }): ParsedTransaction[] {
  const linhas = texto.split(/\r?\n/);
  const inicioCabecalho = op.soDepoisDoCabecalho ? linhas.findIndex((l) => CABECALHO_RE.test(l.trim())) : -1;

  const out: ParsedTransaction[] = [];
  const lancar = (data: Data, descricao: string, valor: Valor) => {
    if (valor.magnitude === 0) return;
    const desc = limparDescricao(descricao);
    // Tem que ter cara de nome (letra, ou o "*" de "99*"); só número é boleto/código.
    if (!/[a-zà-ú*]/i.test(desc) || NAO_LANCAMENTO_RE.test(desc)) return;
    // Sem sinal nenhum, o estorno só se reconhece pelo nome (C6: "Estorno Tarifa 98,00").
    const ano = data.ano ?? (ref.mes !== null && Number(data.mm) > ref.mes ? ref.ano - 1 : ref.ano);
    out.push({ date: `${ano}-${data.mm}-${data.dd}`, description: desc, amount: valor.credito || pareceEstorno(desc) ? -valor.magnitude : valor.magnitude });
  };

  let noFuturo = false;
  let aberto: { data: Data; partes: string[]; espera: number } | null = null;
  let ultimaData: Data | null = null;
  for (let i = inicioCabecalho + 1; i < linhas.length; i++) {
    const bruta = linhas[i].replace(/ +/g, " ").trim();
    if (!bruta) continue;

    if (noFuturo) {
      if (op.blocoFuturoAtePagina ? VIRA_PAGINA_RE.test(bruta) : CABECALHO_RE.test(bruta)) noFuturo = false;
      continue;
    }
    if (BLOCO_FUTURO_RE.test(bruta) && !DATA_INICIO_RE.test(bruta)) {
      noFuturo = true;
      aberto = null;
      continue;
    }
    if (/%/.test(bruta)) continue;

    // Onde está a data desta linha?
    let data: Data | null = null;
    const noInicio = bruta.match(DATA_INICIO_RE);
    if (noInicio) data = lerData(noInicio, 0);
    if (!data && op.dataNoMeio) {
      // A última data antes do primeiro valor ("PARC 01/08" antes dela é parcela, não data).
      const primeiroValor = valores(bruta, 0)[0];
      const limite = primeiroValor ? primeiroValor.inicio : bruta.length;
      for (const m of bruta.slice(0, limite).matchAll(DATA_QUALQUER_RE)) data = lerData(m, 0) ?? data;
    }

    if (data) {
      ultimaData = data;
      // Pedaço onde procurar o valor: a linha toda, ou só a coluna (entre TABs) da data.
      let trecho = bruta.slice(data.fim);
      let desloc = data.fim;
      if (op.valorNoPedacoDaData && trecho.includes("\t")) {
        const pedacos = trecho.split("\t");
        const idx = pedacos.findIndex((p) => valores(p, 0).length > 0);
        if (idx >= 0) {
          desloc += pedacos.slice(0, idx).reduce((s, p) => s + p.length + 1, 0);
          trecho = pedacos[idx];
        }
      }
      const vs = valores(trecho, desloc);
      if (vs.length > 0) {
        const valor = vs[vs.length - 1];
        const antesDaData = bruta.slice(0, data.inicio).replace(/^\d\s+/, "");
        const descricao = `${antesDaData} ${bruta.slice(data.fim, valor.inicio)}`;
        lancar(data, descricao, valor);
        aberto = null;
      } else if (op.valorAbaixo) {
        aberto = { data, partes: [bruta.slice(0, data.inicio), bruta.slice(data.fim)], espera: 6 };
      }
      continue;
    }

    if (!aberto) {
      // IOF cobrado numa linha sem data ("Repasse de IOF em R$ 62,87", Itaú): vai com a data
      // do último lançamento.
      const vs = IOF_SEM_DATA_RE.test(bruta) ? valores(bruta, 0) : [];
      if (vs.length === 1 && ultimaData) lancar(ultimaData, bruta.slice(0, vs[0].inicio).replace(/\s+em$/i, ""), vs[0]);
      continue;
    }
    aberto.espera -= 1;
    if (aberto.espera <= 0) {
      aberto = null;
      continue;
    }
    const vs = valores(bruta, 0);
    if (vs.length === 0) {
      // Pedaço quebrado da descrição é curto ("DA", "*LOJA02/02"); frase é outra coisa.
      if (bruta.split(/\s+/).length > 3 || NAO_LANCAMENTO_RE.test(bruta)) aberto = null;
      else aberto.partes.push(bruta);
      continue;
    }
    // Linha de valor tem que ser CURTA ("R$ 58,94", "Franca 79,89"); frase longa com valor
    // ("Total a pagar: R$ 294,70 (valor da transação de ...") é explicação: pula e segue esperando.
    if (vs.length > 1) continue;
    const valor = vs[0];
    const resto = (bruta.slice(0, valor.inicio) + " " + bruta.slice(valor.fim)).trim();
    // "R$ 12,06 de juros)." é pedaço de frase, não a linha do valor.
    if (resto.split(/\s+/).filter(Boolean).length > 2 || /[()]|\b(de|do|da|em|com|juros|iof)\b/.test(resto)) continue;
    if (NAO_LANCAMENTO_RE.test(resto)) {
      aberto = null;
      continue;
    }
    lancar(aberto.data, `${aberto.partes.join(" ")} ${resto}`, valor);
    aberto = null;
  }
  return out;
}

/** Da mais presa para a mais solta: a primeira que fechar é a mais provável de estar certa. */
export const COMBINACOES: Opcoes[] = [];
for (const soDepoisDoCabecalho of [true, false])
  for (const dataNoMeio of [false, true])
    for (const valorAbaixo of [false, true])
      for (const valorNoPedacoDaData of [false, true])
        for (const blocoFuturoAtePagina of [false, true])
          COMBINACOES.push({ soDepoisDoCabecalho, dataNoMeio, valorAbaixo, valorNoPedacoDaData, blocoFuturoAtePagina });

/**
 * Mais exigente que o alarme do dia a dia (que aceita 0,5%): aqui o leitor ESCOLHE entre
 * várias leituras, e com folga de R$ 40 uma leitura que pegou a cotação do dólar no lugar da
 * compra "fechava" do mesmo jeito. E uma linha só não vale: era o próprio total da fatura lido
 * como compra (Inter), "fechando" consigo mesmo.
 */
function fechaNoCentavo(texto: string, txns: ParsedTransaction[]): boolean {
  const lancamentos = txns.filter((t) => !isFaturaSummaryLine(t));
  if (lancamentos.length < 2) return false;
  const c = conferirLeitura(texto, "fatura", lancamentos);
  return c.status === "fechou" && Math.abs(c.lido - c.esperado) <= 0.1;
}

export function fechaComoFatura(texto: string, txns: ParsedTransaction[]): ReturnType<typeof conferirLeitura>["status"] {
  return conferirLeitura(texto, "fatura", txns.filter((t) => !isFaturaSummaryLine(t))).status;
}

/**
 * Lê uma fatura de formato desconhecido testando as combinações. Devolve a leitura só se ela
 * fechar com o total impresso; null quando não é fatura, não tem total ou nada fechou.
 */
export function lerFaturaTestando(texto: string, refYear: number = new Date().getFullYear()): ParsedTransaction[] | null {
  if (detectDocKind(texto).kind !== "fatura") return null;
  const ref = referencia(texto, refYear);
  for (const op of COMBINACOES) {
    const txns = lerComOpcoes(texto, op, ref);
    if (!fechaNoCentavo(texto, txns)) continue;
    // Inter põe um "-" de coluna antes de TODA compra: a maioria do sinal é a compra, e ela sai
    // positiva como nos leitores de cada banco.
    return comprasDaFaturaSaoPositivas(txns) ? txns : txns.map((t) => ({ ...t, amount: -t.amount }));
  }
  return null;
}
