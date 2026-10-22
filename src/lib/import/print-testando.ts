import { isFaturaSummaryLine } from "./fatura-lines";
import { COMBINACOES, lerComOpcoes, lerFaturaTestando, referencia } from "./leitor-inteligente";
import { lerTabelaDaFatura, linhasDaImagem } from "./print-tabela";
import { lerPrint, type LinhaDoPrint, type PrintLido, type Segmento } from "./print-fatura";
import type { ParsedTransaction } from "./statement-parser";

/**
 * O print passa pelo MESMO cérebro dos PDFs desconhecidos (22/10/2026, pedido da Dani: "uma
 * inteligência dentro do app, sem pagar"). O OCR vira texto em linhas, com TAB entre as colunas
 * da imagem, e o leitor inteligente (leitor-inteligente.ts) testa as combinações de data, sinal,
 * colunas e blocos de próximas faturas. Só vale a leitura que FECHA no centavo com um total que
 * o próprio print mostra. Tudo roda dentro do app: nenhum dado sai, nenhum custo por uso.
 *
 * Cada formato novo que alguém ensinar ao leitor inteligente (para PDF) passa a valer também
 * para print, e o contrário.
 */

const VALOR_NO_FIM_RE = /(-)?\s?(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/;

/** As linhas do print como texto, uma por altura, com TAB entre os pedaços. */
export function textoDoPrint(segmentos: Segmento[]): string {
  return linhasDaImagem(segmentos)
    .map((segs) => segs.map((s) => s.texto.trim()).filter(Boolean).join("\t"))
    .filter(Boolean)
    .join("\n");
}

/** Todo valor de uma linha que começa com "Total" (total da fatura, das compras, deste cartão). */
function totaisDoPrint(texto: string): number[] {
  return texto
    .split("\n")
    .filter((l) => /^total\b/i.test(l.trim()))
    .flatMap((l) => {
      const m = l.match(VALOR_NO_FIM_RE);
      return m ? [Number(m[2].replace(/\./g, "").replace(",", "."))] : [];
    });
}

const centavos = (n: number) => Math.round(n * 100);

/** A combinação que fecha com algum total do print e explica mais linhas. */
function testarContraOTotal(texto: string, ano: number): ParsedTransaction[] | null {
  const totais = new Set(totaisDoPrint(texto).map(centavos));
  if (totais.size === 0) return null;
  const ref = referencia(texto, ano);
  let melhor: ParsedTransaction[] | null = null;
  for (const op of COMBINACOES) {
    const txns = lerComOpcoes(texto, op, ref).filter((t) => !isFaturaSummaryLine(t) && !/^total\b/i.test(t.description.trim()));
    if (txns.length < 2 || (melhor && txns.length <= melhor.length)) continue;
    const soma = Math.abs(txns.reduce((s, t) => s + t.amount, 0));
    if (totais.has(centavos(soma))) melhor = txns;
  }
  return melhor;
}

/** Linha que começa com data na esquerda da imagem: onde a tabela de compras está. */
const DATA_SOLTA_RE = /^\d{2}\/\d{2}(\/\d{2,4})?$/;

/**
 * Página com duas colunas lado a lado (as compras à esquerda e o resumo à direita, Bradesco): a
 * mesma altura juntava as duas e nenhuma leitura fechava. O corte é procurado só na faixa da
 * tabela (das primeiras datas até um pouco depois da última), porque o boleto em cima ocupa a
 * largura toda. Corte = faixa vertical por onde nenhum pedaço passa, com texto dos dois lados.
 */
export function colunas(segmentos: Segmento[]): Segmento[][] {
  const datas = segmentos.filter((s) => DATA_SOLTA_RE.test(s.texto.trim()));
  if (datas.length < 2) return [];
  const topo = Math.min(...datas.map((s) => s.y0)) - 60;
  const fundo = Math.max(...datas.map((s) => s.y1)) + 200;
  const faixa = segmentos.filter((s) => s.y0 >= topo && s.y1 <= fundo);
  const xs = [...new Set(faixa.flatMap((s) => [s.x0, s.x1]).map((x) => Math.round(x)))].sort((a, b) => a - b);
  const cortes: number[] = [];
  for (const x of xs) {
    const corte = x + 4;
    const atravessa = faixa.some((s) => s.x0 < corte && s.x1 > corte);
    const esquerda = faixa.filter((s) => s.x1 <= corte).length;
    const direita = faixa.filter((s) => s.x0 >= corte).length;
    if (!atravessa && esquerda >= 6 && direita >= 6 && !cortes.some((c) => Math.abs(c - corte) < 40)) cortes.push(corte);
  }
  return cortes.flatMap((c) => [faixa.filter((s) => s.x1 <= c), faixa.filter((s) => s.x0 >= c)]);
}

/** O OCR perde a barra da data: "2909/26", "29/0926" e "290926" são 29/09/26. */
export function remendarDatas(segmentos: Segmento[]): Segmento[] {
  return segmentos.map((s) => {
    const t = s.texto.trim();
    const m = t.match(/^(\d{2})(\d{2})\/(\d{2})$/) ?? t.match(/^(\d{2})\/(\d{2})(\d{2})$/) ?? t.match(/^(\d{2})(\d{2})(\d{2})$/);
    // Só quando dá uma data de verdade: "260926" vira 26/09/26, um código "999999" não.
    return m && Number(m[1]) >= 1 && Number(m[1]) <= 31 && Number(m[2]) >= 1 && Number(m[2]) <= 12 ? { ...s, texto: `${m[1]}/${m[2]}/${m[3]}` } : s;
  });
}

export function lerPrintTestando(segmentos: Segmento[], envio: string): PrintLido | null {
  const remendados = remendarDatas(segmentos);
  for (const parte of [remendados, ...colunas(remendados)]) {
    const lido = lerParte(parte, envio);
    if (lido) return lido;
  }
  return null;
}

function lerParte(segmentos: Segmento[], envio: string): PrintLido | null {
  const texto = textoDoPrint(segmentos);
  const ano = Number(envio.slice(0, 4)) || new Date().getFullYear();
  const txns = (lerFaturaTestando(texto, ano) ?? testarContraOTotal(texto, ano))?.filter((t) => !isFaturaSummaryLine(t));
  if (!txns || txns.length === 0) return null;
  // A maioria é compra: o sinal da maioria vira compra (positivo), o outro vira crédito.
  const compraPositiva = txns.filter((t) => t.amount > 0).length >= txns.filter((t) => t.amount < 0).length;
  const linhas: LinhaDoPrint[] = txns.map((t) => {
    const credito = compraPositiva ? t.amount < 0 : t.amount > 0;
    return { data: t.date, nome: t.description, valor: Math.abs(t.amount), sinal: credito ? "-" : null, credito, parcela: null };
  });
  const total = linhas.reduce((s, l) => s + (l.credito ? -l.valor : l.valor), 0);
  return { linhas, cabecalhoNoFim: null, totalDaFatura: Math.round(total * 100) / 100 };
}

/**
 * Todos os jeitos de ler um print. Primeiro os que CONFEREM com o total impresso (a tabela da
 * fatura em PDF e o leitor inteligente); a tela do app do banco, que não tem total para conferir,
 * só depois. Na imagem ampliada de uma página de PDF, o leitor de tela achava 4 compras soltas
 * que não fechavam e passaria na frente da leitura certa. Nenhum achou nada: null.
 */
export function lerQualquerPrint(segmentos: Segmento[], envio: string): PrintLido | null {
  const conferido = lerTabelaDaFatura(segmentos) ?? lerPrintTestando(segmentos, envio);
  if (conferido) return conferido;
  const daTela = lerPrint(segmentos, envio);
  return daTela.linhas.length > 0 ? daTela : null;
}
