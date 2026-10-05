import { conferirLeitura } from "./conferencia";
import { pareceEstorno } from "./estorno";
import { detectDocKind } from "./detect";
import { comprasDaFaturaSaoPositivas, isFaturaSummaryLine } from "./fatura-lines";
import { remendarNumeros, semParcelaSeguinte } from "./numeros-quebrados";
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
 *   6. o ano, que não vem na linha e sai do fechamento/vencimento;
 *   7. o PDF que sai com espaço no meio dos números ("2.30 9,02") e duas colunas de compras na
 *      mesma linha (Itaú);
 *   8. a parcela da PRÓXIMA fatura repetida no meio das compras do mês, sem título nenhum.
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
  /** Até onde vai um bloco de "próximas faturas"/boleto/limites: o próximo cabeçalho, a página
   * virar, ou a próxima linha que começa com data e tem valor. */
  fimDoBlocoFuturo: "cabecalho" | "pagina" | "data";
  /** Remenda número e data com espaço perdido no meio ("53 ,90" → "53,90", "04/ 08" → "04/08"). */
  remendado: boolean;
  /** Duas (ou mais) compras na mesma linha, uma por coluna do PDF. */
  variasPorLinha: boolean;
  /** Tira a parcela seguinte de uma compra que aparece duas vezes (mesma data, mesmo valor):
   * "mesmaLoja" exige a mesma descrição; "qualquer" aceita a compra escrita de outro jeito. */
  semParcelaSeguinte: false | "mesmaLoja" | "qualquer";
  /** Linha ao contrário: VALOR, descrição e a data no fim ("R$ 107,79 <TAB> Extra Farma (5/5) <TAB> 24 Abr", BTG). */
  valorAntesDaData: boolean;
};

const MESES: Record<string, string> = {
  jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06",
  jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12",
};

const MES = "(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)";
/** 31/08, 31/08/26, 31/08/2026, 31/08/2 (Porto Seguro corta o ano), 31 AGO, 31 ago 2026, 31 de ago. 2026,
 * 19/set (Sicredi) — com a hora logo depois, quando vem ("19/set 08:34"). */
const DATA = String.raw`(\d{2})(?:\/(\d{2})(?:\/(\d{4}|\d{2}|\d))?|\/${MES}|\s+(?:de\s+)?${MES}\.?(?:\s+(?:de\s+)?(\d{4}))?)(?:\s+\d{2}:\d{2})?`;
const DATA_INICIO_RE = new RegExp(String.raw`^(?:\d\s+)?${DATA}(?=\s|$)`, "i");
const DATA_QUALQUER_RE = new RegExp(String.raw`(?:^|\s)${DATA}(?=\s|$)`, "gi");
/** Valor com o sinal que estiver colado nele: "-R$ 10,00", "R$ -10,00", "10,00-", "10,00 -", "+ 10,00". */
const VALOR_RE = /([−-]|\+)?\s*(?:R\$\s*)?([−-])?\s*(\d{1,3}(?:\.\d{3})*,\d{2})(?![\d%])(\s?[−-](?!\s*\d))?/g;

const CABECALHO_RE =
  /^(lan[çc]amentos?\b|transa[çc][õo]es\b|detalhamento da fatura|detalhes de consumo|movimenta[çc][õo]es\b|hist[óo]rico de (despesas|lan[çc]amentos|transa[çc][õo]es)|data\s+(descri[çc][ãa]o|hist[óo]rico|estabelecimento|loja|movimenta))/i;
/** Começo de um pedaço que NÃO é gasto deste mês. */
const BLOCO_FUTURO_RE =
  /(pr[óo]xim[ao]s?\s+faturas?|parcelamentos?\s+pr[óo]xim|total\s+parcelado\s+para|ficha\s+de\s+compensa|recibo\s+do\s+pagador|formas\s+de\s+pagamento|op[çc][õo]es\s+de\s+pagamento|parcele\s+(sua|esta)\s+fatura|limites?\s+de\s+cr[ée]dito|encargos\s+financeiros)/i;
const REPASSE_IOF_RE = /repasse\s+de\s+iof\s+em\s+R\$\s*\d{1,3}(?:\.\d{3})*,\d{2}/gi;
const IOF_SEM_DATA_RE = /^(repasse\s+de\s+)?iof\b/i;
const VIRA_PAGINA_RE = /^(--\s*\d+\s+of\s+\d+\s*--|p[áa]gina\s+\d+)/i;
/** Linha que é resumo/total/tabela, nunca um lançamento. */
const NAO_LANCAMENTO_RE =
  /\b(saldo\s+(anterior|atual|desta|final|devedor|em\s+aberto|total|restante|parcelado|do\s+dia)|total\b|subtotal|limite\s+(total|dispon|utiliz|de\s+(saque|cr[ée]dito|compra)|[úu]nico)|resumo|fatura\s+anterior|pagamento\s+m[íi]nimo|vencimento|melhor\s+(dia|data)|juros\s+(rotativo|m[áa]ximo)|cet\b)/i;
/**
 * Crédito que a fatura escreve SEM sinal nenhum: "Crédito concedido R$ 19,90" (Mercado Pago),
 * "Ajuste a crédito". Pelo número não dá pra saber; pela palavra dá.
 */
const CREDITO_SEM_SINAL_RE = /\b(cr[ée]dito\s+(concedido|de\s+confian[çc]a|de\s+parcelamento)|ajuste\s+a\s+cr[ée]dito|desconto\s+de\s+antecipa)/i;
/** Linha de câmbio de compra no exterior: tem número, mas não é o valor da compra. */
const LINHA_DE_CAMBIO_RE = /c[âa]mbio|cota[çc][ãa]o|convers[ãa]o|\bpeso\b|d[óo]lar|\beuro\b|US\$\s*\d/i;
/** O que pode sobrar numa linha que é SÓ de valores ("119,90 0,00 R$ 0,00 119,90"). */
const SO_VALORES_RE = /^(?:R\$|US\$|BRL|USD|[+−-]|\s)*$/i;

const FECHAMENTO_RES: RegExp[] = [
  /fechad[ao]\s+em[\s\S]{0,120}?\d{2}\/(\d{2})\/(\d{4}|\d{2})\b/i,
  /fechamento\s+(?:desta\s+fatura\s+)?em\s+\d{2}\/(\d{2})\/(\d{4}|\d{2})\b/i,
  /emiss[ãa]o\s+e\s+envio\s+\d{2}\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s+(\d{4})/i,
  /vencimento[\s\S]{0,40}?\d{2}\/(\d{2})\/(\d{4})\b/i,
  // "fatura de Setembro de 2026" (BTG): sem data de fechamento escrita por inteiro.
  /fatura\s+de\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zç]*\s+de\s+(\d{4})/i,
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

type Data = { dd: string; mm: string; ano: number | null; inicio: number; fim: number; mesPorExtenso: boolean };

function lerData(m: RegExpMatchArray, deslocamento: number): Data | null {
  const [, dd, mmNum, anoNum, mesBarra, mesNome, anoExtenso] = m;
  const mm = mmNum ?? MESES[(mesBarra ?? mesNome ?? "").toLowerCase()];
  if (!mm || Number(dd) < 1 || Number(dd) > 31 || Number(mm) < 1 || Number(mm) > 12) return null;
  const anoTxt = anoNum ?? anoExtenso;
  // Ano de um dígito só é ano cortado: vale o do fechamento.
  const ano = anoTxt && anoTxt.length > 1 ? (anoTxt.length === 2 ? 2000 + Number(anoTxt) : Number(anoTxt)) : null;
  return { dd, mm, ano, inicio: deslocamento + (m.index ?? 0), fim: deslocamento + (m.index ?? 0) + m[0].length, mesPorExtenso: !mmNum };
}

type Valor = { magnitude: number; credito: boolean; mais: boolean; inicio: number; fim: number };

function valores(trecho: string, deslocamento: number): Valor[] {
  const out: Valor[] = [];
  for (const m of trecho.matchAll(VALOR_RE)) {
    const [inteiro, antes, dentro, numero, depois] = m;
    const magnitude = parseBrazilianNumber(numero);
    if (Number.isNaN(magnitude)) continue;
    // "- <TAB> R$ 23,12" (Inter): o traço é a coluna "Beneficiário" vazia, não sinal de menos.
    const tracoDeColuna = (antes === "-" || antes === "−") && /^[−-]\s*\t/.test(inteiro);
    const credito = ((antes === "-" || antes === "−") && !tracoDeColuna) || !!dentro || !!depois;
    const inicio = deslocamento + (m.index ?? 0);
    out.push({ magnitude, credito, mais: antes === "+", inicio, fim: inicio + inteiro.length });
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
  const comMais: boolean[] = [];
  const lancar = (data: Data, descricao: string, valor: Valor) => {
    if (valor.magnitude === 0) return;
    const desc = limparDescricao(descricao);
    // Tem que ter cara de nome (letra, ou o "*" de "99*"); só número é boleto/código.
    if (!/[a-zà-ú*]/i.test(desc) || NAO_LANCAMENTO_RE.test(desc)) return;
    // Sem sinal nenhum, o estorno só se reconhece pelo nome (C6: "Estorno Tarifa 98,00").
    const ano = data.ano ?? (ref.mes !== null && Number(data.mm) > ref.mes ? ref.ano - 1 : ref.ano);
    const credito = valor.credito || pareceEstorno(desc) || CREDITO_SEM_SINAL_RE.test(desc);
    out.push({ date: `${ano}-${data.mm}-${data.dd}`, description: desc, amount: credito ? -valor.magnitude : valor.magnitude });
    comMais.push(valor.mais && !credito);
  };

  /**
   * Linha com várias compras, uma por coluna: "01/08 MERCADO 53,90 04/08 PIX Ministerio 01/02 125,56".
   * Uma data só abre compra nova se já veio um valor depois da anterior — senão é a parcela
   * ("01/02") no meio da descrição.
   */
  const variasNaLinha = (bruta: string): { data: Data; descricao: string; valor: Valor }[] => {
    const achadas: { data: Data; descricao: string; valor: Valor }[] = [];
    let atual: Data | null = null;
    let desde = 0;
    // O valor é o PRIMEIRO depois da data: o que vem depois dele até a próxima data é a outra
    // coluna ("Lançamentos produtos e serviços 125,56", "Demais faturas 730,14").
    const fechar = (ate: number) => {
      if (!atual) return;
      const vs = valores(bruta.slice(atual.fim, ate), atual.fim);
      if (vs.length > 0) achadas.push({ data: atual, descricao: bruta.slice(atual.fim, vs[0].inicio), valor: vs[0] });
    };
    for (const m of bruta.matchAll(DATA_QUALQUER_RE)) {
      const d = lerData(m, 0);
      if (!d || d.inicio < desde) continue;
      if (atual && valores(bruta.slice(atual.fim, d.inicio), 0).length === 0) continue;
      fechar(d.inicio);
      atual = d;
      desde = d.fim;
    }
    fechar(bruta.length);
    return achadas;
  };

  let noFuturo = false;
  let aberto: { data: Data; partes: string[]; espera: number } | null = null;
  let ultimaData: Data | null = null;
  for (let i = inicioCabecalho + 1; i < linhas.length; i++) {
    const limpa = linhas[i].replace(/ +/g, " ").trim();
    // "Repasse de IOF em R$ 2,43" (Itaú) é cobrança DESTA fatura em qualquer lugar da linha: no
    // começo, depois do quadro das próximas faturas, ou na outra coluna, ao lado de uma compra.
    // Lança com a data da última compra e tira da linha, que segue sendo lida.
    let bruta = op.remendado ? remendarNumeros(limpa) : limpa;
    if (ultimaData) {
      for (const m of [...bruta.matchAll(REPASSE_IOF_RE)]) {
        const v = valores(m[0], 0).at(-1);
        if (v) lancar(ultimaData, "Repasse de IOF", v);
      }
      bruta = bruta.replace(REPASSE_IOF_RE, " ").replace(/ +/g, " ").trim();
    }
    if (!bruta) continue;

    if (noFuturo) {
      const fim =
        op.fimDoBlocoFuturo === "pagina"
          ? VIRA_PAGINA_RE.test(bruta)
          : op.fimDoBlocoFuturo === "cabecalho"
            ? CABECALHO_RE.test(bruta)
            : DATA_INICIO_RE.test(bruta) && valores(bruta, 0).length > 0;
      if (!fim) continue;
      noFuturo = false;
      if (op.fimDoBlocoFuturo !== "data") continue;
    }
    // Duas colunas: o título "Total para próximas faturas 1.055,79" divide a linha com uma compra
    // DESTE mês na outra coluna. As parcelas futuras saem depois, por `semParcelaSeguinte`.
    if (op.variasPorLinha && !/%/.test(bruta)) {
      const varias = variasNaLinha(bruta);
      if (varias.length >= 1) {
        for (const v of varias) lancar(v.data, v.descricao, v.valor);
        ultimaData = varias[varias.length - 1].data;
        aberto = null;
        continue;
      }
    }
    if (BLOCO_FUTURO_RE.test(bruta) && !DATA_INICIO_RE.test(bruta)) {
      noFuturo = true;
      aberto = null;
      continue;
    }
    if (/%/.test(bruta)) continue;

    if (op.valorAntesDaData) {
      // Cada valor da linha, seguido da descrição e de uma data antes do próximo valor, é um
      // lançamento ("- R$ 112,16 <TAB> Benefício <TAB> 24 Ago - R$ 399,90 <TAB> Crédito <TAB> 10 Set").
      const vs = valores(bruta, 0);
      let achou = false;
      vs.forEach((v, k) => {
        const ate = k + 1 < vs.length ? vs[k + 1].inicio : bruta.length;
        let data: Data | null = null;
        for (const m of bruta.slice(v.fim, ate).matchAll(DATA_QUALQUER_RE)) data ??= lerData(m, v.fim);
        if (!data) return;
        lancar(data, bruta.slice(v.fim, data.inicio), v);
        ultimaData = data;
        achou = true;
      });
      if (achou) {
        aberto = null;
        continue;
      }
    }


    // Onde está a data desta linha?
    let data: Data | null = null;
    const noInicio = bruta.match(DATA_INICIO_RE);
    if (noInicio) data = lerData(noInicio, 0);
    // "04 JUL LEMOS IMPORTADOS" / "03/05 PENHA R$ 280,00": a compra esperando o valor tinha o mês
    // por extenso; "03/05" em número, sem ano, logo abaixo, é a PARCELA 3 de 5, não 3 de maio.
    if (data && aberto && aberto.data.mesPorExtenso && !data.mesPorExtenso && data.ano === null && Number(data.dd) <= Number(data.mm)) data = null;
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
        // A loja pode vir DEPOIS do valor ("Parcela de Compra - Parc.7/7 <TAB> 56,11 <TAB> Lojas Renner").
        const depois = bruta.slice(valor.fim).trim();
        const descricao = [antesDaData, bruta.slice(data.fim, valor.inicio), /[a-zà-ú]{3}/i.test(depois) ? depois : ""].join(" ").trim();
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
      // IOF nunca é crédito: "IOF R$ 12,30 -" é a coluna da simulação de parcelamento.
      const vs = IOF_SEM_DATA_RE.test(bruta) ? valores(bruta, 0) : [];
      if (vs.length === 1 && !vs[0].credito && ultimaData) lancar(ultimaData, bruta.slice(0, vs[0].inicio).replace(/\s+em$/i, ""), vs[0]);
      continue;
    }
    aberto.espera -= 1;
    if (aberto.espera <= 0) {
      aberto = null;
      continue;
    }
    const vs = valores(bruta, 0);
    if (vs.length === 0) {
      // Pedaço quebrado da descrição é curto ("DA", "*LOJA02/02"). Frase sem valor é explicação
      // ("realizada em 06 de Novembro de 2025", no meio do estorno do Nubank): pula e segue
      // esperando o valor, sem desistir da compra.
      if (NAO_LANCAMENTO_RE.test(bruta)) aberto = null;
      else if (bruta.split(/\s+/).length <= 3) aberto.partes.push(bruta);
      continue;
    }
    // "Câmbio do dia: R$ 5,48", "Peso argentino: 5.173,00": informação da compra, não o valor.
    if (LINHA_DE_CAMBIO_RE.test(bruta)) continue;
    // Linha SÓ de números ("3,69 20,23", "119,90 0,00 R$ 0,00 119,90"): colunas US$ e R$ — o
    // valor em reais é o último.
    const soNumeros = vs.length > 1 && SO_VALORES_RE.test(vs.reduceRight((t, v) => t.slice(0, v.inicio) + t.slice(v.fim), bruta));
    // Linha de valor tem que ser CURTA ("R$ 58,94", "Franca 79,89"); frase longa com valor
    // ("Total a pagar: R$ 294,70 (valor da transação de ...") é explicação: pula e segue esperando.
    if (vs.length > 1 && !soNumeros) continue;
    const valor = vs[vs.length - 1];
    if (soNumeros) {
      lancar(aberto.data, aberto.partes.join(" "), valor);
      aberto = null;
      continue;
    }
    const resto = (bruta.slice(0, valor.inicio) + " " + bruta.slice(valor.fim)).trim();
    const palavras = resto.split(/\s+/).filter(Boolean);
    // "R$ 12,06 de juros)." é pedaço de frase, não a linha do valor. Mas "do R$ 2,37" é o fim
    // de uma palavra quebrada ("Iof Complementar Parcela- / do"): uma palavra só não é frase.
    // Valor sozinho na ÚLTIMA coluna ("BYANCA MARTINS BARTO <TAB> R$ 29,52", Inter): o texto ao
    // lado é a coluna do beneficiário, não frase.
    const celula = String.raw`(?:[+−-]\s*)?(?:R\$\s*)?[−-]?\s*\d{1,3}(?:\.\d{3})*,\d{2}`;
    const colunaPropria =
      (new RegExp(String.raw`\t\s*${celula}\s*$`).test(bruta) || new RegExp(String.raw`^${celula}\s*\t`).test(bruta)) && !/[()]/.test(resto);
    if (!colunaPropria && (palavras.length > 2 || /[()]/.test(resto) || (palavras.length > 1 && /\b(de|do|da|em|com|juros|iof)\b/.test(resto)))) continue;
    if (NAO_LANCAMENTO_RE.test(resto)) {
      aberto = null;
      continue;
    }
    lancar(aberto.data, `${aberto.partes.join(" ")} ${resto}`, valor);
    aberto = null;
  }
  // "+" que só aparece numa MINORIA das linhas é o crédito ("- <TAB> + R$ 67,20", estorno no
  // Inter, onde a compra não tem sinal). Quando quase toda linha tem "+" (Riachuelo), ele é a compra.
  const mais = comMais.filter(Boolean).length;
  const lidos = mais > 0 && mais < out.length / 2 ? out.map((t, k) => (comMais[k] ? { ...t, amount: -t.amount } : t)) : out;
  return op.semParcelaSeguinte ? semParcelaSeguinte(lidos, op.semParcelaSeguinte === "qualquer") : lidos;
}

/** Da mais presa para a mais solta: no empate de linhas, fica a mais presa. */
export const COMBINACOES: Opcoes[] = [];
for (const remendado of [false, true])
  for (const variasPorLinha of [false, true])
    for (const semParcelaSeguinte of [false, "mesmaLoja", "qualquer"] as const)
      for (const soDepoisDoCabecalho of [true, false])
        for (const dataNoMeio of [false, true])
          for (const valorAbaixo of [false, true])
            for (const valorNoPedacoDaData of [false, true])
              for (const fimDoBlocoFuturo of ["cabecalho", "pagina", "data"] as const)
                COMBINACOES.push({ soDepoisDoCabecalho, dataNoMeio, valorAbaixo, valorNoPedacoDaData, fimDoBlocoFuturo, remendado, variasPorLinha, semParcelaSeguinte, valorAntesDaData: false });
// Linha ao contrário (valor antes da data) é um jeito de ler à parte: as outras chaves de onde
// fica a data e o valor não se aplicam.
for (const soDepoisDoCabecalho of [true, false])
  for (const fimDoBlocoFuturo of ["cabecalho", "pagina", "data"] as const)
    COMBINACOES.push({ soDepoisDoCabecalho, dataNoMeio: false, valorAbaixo: false, valorNoPedacoDaData: false, fimDoBlocoFuturo, remendado: false, variasPorLinha: false, semParcelaSeguinte: false, valorAntesDaData: true });

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
  // Remendar só muda alguma coisa no PDF com número quebrado; nos outros, é a mesma leitura.
  const temNumeroQuebrado = texto.split(/\r?\n/).some((l) => {
    const limpa = l.replace(/ +/g, " ").trim();
    return remendarNumeros(limpa) !== limpa;
  });
  // Entre as leituras que fecham, a que explica MAIS linhas do documento: uma compra no exterior
  // e o estorno dela se anulam, e a leitura que pula os dois também "fecha" — por coincidência.
  let melhor: ParsedTransaction[] | null = null;
  let maisLinhas = 0;
  for (const op of COMBINACOES) {
    if (op.remendado && !temNumeroQuebrado) continue;
    const txns = lerComOpcoes(texto, op, ref);
    if (!fechaNoCentavo(texto, txns)) continue;
    const linhas = txns.filter((t) => !isFaturaSummaryLine(t)).length;
    if (linhas > maisLinhas) {
      melhor = txns;
      maisLinhas = linhas;
    }
  }
  if (!melhor) return null;
  // Inter põe um "-" de coluna antes de TODA compra: a maioria do sinal é a compra, e ela sai
  // positiva como nos leitores de cada banco.
  const positivas = comprasDaFaturaSaoPositivas(melhor) ? melhor : melhor.map((t) => ({ ...t, amount: -t.amount }));
  return comPagamentoDaAnterior(texto, positivas);
}

const FALA_DE_PAGAMENTO_RE = /\b(pag|pgto|pagto|fat|deb|d[ée]bito|cr[ée]d)/i;
const ANTERIOR_RE = /^(?:\(\+\)\s*)?(?:total\s+da\s+)?(?:fatura|saldo)\s+anterior:?\s*(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})/im;

/**
 * O pagamento da fatura anterior vem escrito de mil jeitos ("Pagamento Banco CSF", "DEB 0340/35
 * 05647609", "Cred P Fat Ent" — o resto que foi pro parcelamento). Como crédito comum ele virava
 * ESTORNO e descontava o mês. O que denuncia é o valor: sozinho, ou somado ao pagamento que já foi
 * reconhecido, ele quita exatamente o saldo da fatura anterior impresso no resumo.
 */
function comPagamentoDaAnterior(texto: string, txns: ParsedTransaction[]): ParsedTransaction[] {
  const m = texto.match(ANTERIOR_RE);
  if (!m) return txns;
  const anterior = Math.round(parseBrazilianNumber(m[1]) * 100);
  if (!(anterior > 0)) return txns;
  const centavos = (t: ParsedTransaction) => Math.round(Math.abs(t.amount) * 100);
  const jaPago = txns.filter((t) => t.amount < 0 && isFaturaSummaryLine(t)).reduce((s, t) => s + centavos(t), 0);
  // Anterior já quitada pelo pagamento reconhecido: crédito do mesmo valor é outra coisa
  // ("Crédito de atraso", Nubank).
  if (jaPago >= anterior - 1) return txns;
  return txns.map((t) => {
    if (t.amount >= 0 || isFaturaSummaryLine(t)) return t;
    // E tem que FALAR de pagamento: uma devolução de loja pode ter, por acaso, o valor do saldo.
    if (!FALA_DE_PAGAMENTO_RE.test(t.description)) return t;
    const c = centavos(t);
    const quita = Math.abs(c - anterior) <= 1 || (jaPago > 0 && Math.abs(c + jaPago - anterior) <= 1);
    return quita ? { ...t, description: `Pagamento da fatura anterior · ${t.description}` } : t;
  });
}
