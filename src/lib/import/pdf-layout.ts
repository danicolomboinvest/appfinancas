/**
 * Texto do PDF lido como uma pessoa lê a página: pela POSIÇÃO de cada pedaço, uma coluna de
 * cada vez, linha por linha.
 *
 * Por quê (23/10/2026): a leitura normal segue a ordem em que o arquivo guarda os pedaços. Na
 * fatura de duas colunas (compras à esquerda E à direita), cada linha do texto saía com duas
 * compras emendadas ("99/99 LOJA A 120,00 99/99 LOJA B 45,90") e a descrição da segunda linha
 * de uma caía no meio da outra. Além disso, alguns PDFs gravam o número já com espaço dentro
 * ("1.234 ,56", "12/ 09", "12 3,45"). Resultado: 20 de 55 compras lidas, 4 tentativas da mesma
 * pessoa.
 *
 * Aqui:
 *  1. o pedaço que é SÓ número (dígitos, ponto, vírgula, barra, sinal) perde os espaços de
 *     dentro: no PDF ele é uma célula só, então o espaço não separa dois valores;
 *  2. as colunas saem das DATAS alinhadas: se as datas aparecem em duas (ou três) posições
 *     horizontais bem separadas, cada posição é o começo de uma coluna de lançamentos;
 *  3. dentro de cada coluna, os pedaços da mesma altura viram uma linha, da esquerda para a
 *     direita, separados por tabulação quando há um vão grande entre eles.
 *
 * Isto só PRODUZ um texto. Quem decide se ele vale é quem lê depois: a leitura pela posição só
 * entra no lugar da normal quando a soma dela fecha com o total impresso (ver
 * escolherTextoDoPdf em import-actions.ts). Nunca troca uma leitura certa por um palpite.
 */

export type PedacoComTamanho = { str: string; x: number; y: number; w: number; fs: number };
export type PaginaDoPdf = { largura: number; pedacos: PedacoComTamanho[] };

/** Pedaço que é só número, data ou valor ("1.234 ,56", "12/ 09", "-12 3,45", "R$ 9 ,90"). */
const SO_NUMERO = /^(?:R\$\s*)?[-+]?\s*[\d][\d\s.,/]*[-+]?$/;

/**
 * Pedaço de texto com espaço falso no meio das palavras: o PDF posiciona cada letra e a leitura
 * enxerga um vão onde não há ("La nça me nt os : co m pr as e sa qu es"). Conta como falso quando
 * quase todo pedaço tem 1 ou 2 letras, o que não acontece em texto de verdade.
 */
export function temEspacoFalso(str: string): boolean {
  const partes = str.trim().split(/\s+/).filter((w) => /\p{L}/u.test(w));
  if (partes.length < 6) return false;
  const curtas = partes.filter((w) => w.replace(/[^\p{L}]/gu, "").length <= 2).length;
  return curtas / partes.length >= 0.75;
}

export function remendarPedaco(str: string): string {
  const t = str.trim();
  // As palavras coladas perdem a separação entre elas; quem lê os títulos aceita isso
  // ("Lançamentos:comprasesaques", "Compraspar celadas-próximasfaturas").
  if (temEspacoFalso(t)) return t.replace(/\s+(?=[^\s-])(?<=[^\s-]\s+)/g, "");
  if (!/\s/.test(t) || !SO_NUMERO.test(t)) return t;
  // Dois números de verdade lado a lado na mesma célula ("12/09 45,90" não chega aqui porque
  // a data vem em outro pedaço; mas "45,90 12,00" pode): só junta quando o resultado é UM
  // número com cara de dinheiro ou de data.
  const prefixo = t.startsWith("R$") ? "R$ " : "";
  const junto = t.replace(/^R\$\s*/, "").replace(/\s+/g, "");
  const dinheiro = /^[-+]?\d{1,3}(?:\.\d{3})*,\d{2}[-+]?$|^[-+]?\d+,\d{2}[-+]?$/;
  const data = /^\d{2}\/\d{2}(?:\/\d{2}(?:\d{2})?)?$/;
  return dinheiro.test(junto) || data.test(junto) ? prefixo + junto : t;
}

const DATA_NO_COMECO = /^\d{2}\/\d{2}(?:\/\d{2,4})?(?=\s|$)/;

/**
 * As posições horizontais onde começam colunas de lançamentos: cada grupo de datas alinhadas
 * (mesmo x, com folga de 6 pontos) com pelo menos 3 datas. Duas colunas só contam como colunas
 * se estiverem a mais de um quarto da página uma da outra; senão é a mesma tabela (data da
 * compra e data de lançamento lado a lado, por exemplo).
 */
export function inicioDasColunas(pedacos: PedacoComTamanho[], largura: number): number[] {
  const xs = pedacos.filter((p) => DATA_NO_COMECO.test(p.str.trim())).map((p) => p.x).sort((a, b) => a - b);
  const grupos: { x: number; n: number }[] = [];
  for (const x of xs) {
    const g = grupos.find((gr) => Math.abs(gr.x - x) <= 6);
    if (g) g.n += 1;
    else grupos.push({ x, n: 1 });
  }
  const fortes = grupos.filter((g) => g.n >= 3).sort((a, b) => a.x - b.x);
  const colunas: number[] = [];
  for (const g of fortes) {
    if (colunas.length === 0 || g.x - colunas[colunas.length - 1] > largura / 4) colunas.push(g.x);
  }
  return colunas;
}

function linhasDaColuna(pedacos: PedacoComTamanho[]): string[] {
  type Linha = { y: number; fs: number; pedacos: PedacoComTamanho[] };
  const linhas: Linha[] = [];
  // De cima para baixo; um pedaço entra na linha cuja altura está a menos de 40% da fonte.
  for (const p of [...pedacos].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const l = linhas.find((li) => Math.abs(li.y - p.y) <= Math.max(1.5, Math.min(li.fs, p.fs) * 0.4));
    if (l) l.pedacos.push(p);
    else linhas.push({ y: p.y, fs: p.fs || 8, pedacos: [p] });
  }
  linhas.sort((a, b) => b.y - a.y);
  return linhas.map((l) => {
    const ordem = [...l.pedacos].sort((a, b) => a.x - b.x);
    let texto = "";
    let fim = -Infinity;
    for (const p of ordem) {
      const vao = p.x - fim;
      if (texto) texto += vao > Math.max(4, (p.fs || 8) * 1.2) ? "\t" : vao > (p.fs || 8) * 0.15 ? " " : "";
      texto += p.str;
      fim = Math.max(fim, p.x + p.w);
    }
    return texto.trim();
  });
}

function pedacosUteis(pagina: PaginaDoPdf): PedacoComTamanho[] {
  return pagina.pedacos.map((p) => ({ ...p, str: remendarPedaco(p.str) })).filter((p) => p.str !== "");
}

/**
 * Uma página → linhas, coluna por coluna (a da esquerda inteira, depois a próxima).
 * `colunasDoArquivo`: as colunas achadas nas outras páginas. A última página da fatura costuma
 * ter as compras só à esquerda e, à direita, um quadro de juros e IOF sem data nenhuma; sem isso
 * o "9,99" do quadro grudava no fim da linha da compra e virava o valor dela.
 */
export function linhasDaPagina(pagina: PaginaDoPdf, colunasDoArquivo: number[] = []): string[] {
  const uteis = pedacosUteis(pagina);
  if (uteis.length === 0) return [];
  let colunas = inicioDasColunas(uteis, pagina.largura);
  if (colunas.length <= 1 && colunasDoArquivo.length > 1) {
    // A coluna da esquerda desta página pode estar uns pontos deslocada; as outras vêm do arquivo.
    const esquerda = colunas[0] ?? colunasDoArquivo[0];
    const outras = colunasDoArquivo.slice(1);
    const temOutroLado = outras.every((c) => uteis.some((p) => Math.abs(p.x - c) <= 12));
    if (esquerda < outras[0] - pagina.largura / 4 && temOutroLado) colunas = [esquerda, ...outras];
  }
  if (colunas.length <= 1) return linhasDaColuna(uteis);
  if (!uteis.some((p) => DATA_NO_COMECO.test(p.str.trim()))) return linhasDaColuna(uteis);
  // Cada pedaço vai para a última coluna que começa à esquerda dele (com 6 pontos de folga).
  const colunaDe = (p: PedacoComTamanho) => {
    let i = 0;
    for (let c = 0; c < colunas.length; c++) if (p.x >= colunas[c] - 6) i = c;
    return i;
  };
  // Até onde vai cada coluna para cima: a primeira data dela e mais umas 3 linhas (o título
  // "Lançamentos" e a linha "Data Descrição Valor" são da coluna). O resto do alto da página é
  // cabeçalho de largura inteira (nome, vencimento, total) e sai antes, numa coluna só, para não
  // picar "Total da fatura R$ 1.234,56".
  const datas = uteis.filter((p) => DATA_NO_COMECO.test(p.str.trim()));
  const topoDaColuna = colunas.map((_, c) => {
    const dela = datas.filter((d) => colunaDe(d) === c);
    const fonte = Math.max(...dela.map((d) => d.fs || 8));
    return dela.length > 0 ? Math.max(...dela.map((d) => d.y)) + fonte * 5 : -Infinity;
  });
  const cabecalho = uteis.filter((p) => p.y > topoDaColuna[colunaDe(p)]);
  const corpo = uteis.filter((p) => p.y <= topoDaColuna[colunaDe(p)]);
  const saida = linhasDaColuna(cabecalho);
  const porColuna: PedacoComTamanho[][] = colunas.map(() => []);
  for (const p of corpo) porColuna[colunaDe(p)].push(p);
  for (const col of porColuna) saida.push(...linhasDaColuna(col));
  return saida;
}

export function textoPorLayout(paginas: PaginaDoPdf[]): string {
  // As colunas mais largas que alguma página mostrou valem de referência para as outras.
  const porPagina = paginas.map((p) => inicioDasColunas(pedacosUteis(p), p.largura));
  const doArquivo = porPagina.reduce<number[]>((melhor, c) => (c.length > melhor.length ? c : melhor), []);
  return paginas.map((p) => linhasDaPagina(p, doArquivo).join("\n")).join("\n\n");
}
