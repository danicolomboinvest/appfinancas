import { TICKER_EUA } from "@/lib/portfolio/conta-exterior";
import type { ParsedHolding } from "./portfolio-parser";

/**
 * Carteira em dólar (07/10/2026): posição da Avenue, Nomad e parecidas, ou uma planilha com
 * ticker americano e valor em US$. A Dani: "o leitor precisa entender disso também".
 *
 * Dois jeitos de ler:
 * - tabela com cabeçalho (Excel/CSV): coluna de ticker + quantidade + preço/valor/custo;
 * - texto de PDF, uma linha por ativo: "VOO Vanguard S&P 500 ETF 3 714,34 2.143,02". Aqui só
 *   vale a linha em que quantidade × preço bate com o valor, que é o que separa um ativo de
 *   "PIX 10 50,00" num extrato qualquer.
 *
 * Tudo sai com currency "USD": o valor fica em dólar e a importação converte com o dólar do dia.
 */

/** Palavras de 1 a 5 letras que aparecem em extrato e não são ativo. */
const NAO_E_ATIVO = new Set(["PIX", "TED", "DOC", "IOF", "IR", "CDB", "LCI", "LCA", "CRI", "CRA", "USD", "BRL", "US", "TOTAL", "SALDO", "CASH", "TAXA", "FEE", "FEES", "DIV", "BUY", "SELL", "ETF", "INC", "LLC", "CORP", "THE", "DE", "DA", "DO", "E", "A", "O"]);

const SINAIS_DE_DOLAR = /\bavenue\b|\bnomad\b|us\$|\busd\b|\(usd\)|market value|valor de mercado em d[óo]lar|\bshares\b|securities/i;

/** O arquivo fala em dólar ou em corretora de fora? */
export function pareceCarteiraNoExterior(content: string): boolean {
  return SINAIS_DE_DOLAR.test(content);
}

function ehTicker(cell: string): string | null {
  const t = cell.trim().toUpperCase().replace(/\*$/, "");
  return TICKER_EUA.test(t) && !NAO_E_ATIVO.has(t) ? t : null;
}

/** "1,234.56", "1.234,56", "US$ 2.143,02", "$700.80" → número; NaN se não der. */
export function numeroEmDolar(raw: string): number {
  const t = raw.replace(/US\$|\$|USD|\s/gi, "");
  if (!t || /[a-z]/i.test(t)) return NaN;
  const virgula = t.lastIndexOf(",");
  const ponto = t.lastIndexOf(".");
  let n: string;
  if (virgula >= 0 && ponto >= 0) n = virgula > ponto ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  else if (virgula >= 0) n = /,\d{1,2}$/.test(t) ? t.replace(",", ".") : t.replace(/,/g, "");
  else if (ponto >= 0 && /^\d{1,3}(\.\d{3})+$/.test(t)) n = t.replace(/\./g, "");
  else n = t;
  const v = Number(n);
  return Number.isFinite(v) ? v : NaN;
}

const COLUNAS = {
  ticker: ["ticker", "symbol", "símbolo", "simbolo", "código", "codigo", "ativo", "papel"],
  quantidade: ["quantidade", "qtd", "quantity", "shares", "cotas", "qty"],
  preco: ["preço atual", "preco atual", "last price", "price", "preço", "preco", "cotação", "cotacao"],
  valor: ["market value", "valor de mercado", "valor atual", "valor (usd)", "valor", "value", "saldo", "total"],
  custo: ["cost basis", "custo", "investido", "valor investido", "preço médio", "preco medio", "average", "avg"],
};

function coluna(cabecalho: string[], nomes: string[], fora: number[] = []): number {
  for (const nome of nomes) {
    const i = cabecalho.findIndex((h, j) => !fora.includes(j) && h.includes(nome) && !h.includes("%"));
    if (i !== -1) return i;
  }
  return -1;
}

function separador(linha: string): string {
  return [";", "\t", ","].reduce((m, d) => (linha.split(d).length > linha.split(m).length ? d : m), ";");
}

/** Tabela com cabeçalho: acha a linha de títulos e lê as de baixo. */
function lerTabela(linhas: string[]): ParsedHolding[] {
  for (let i = 0; i < Math.min(linhas.length, 40); i++) {
    const sep = separador(linhas[i]);
    const cab = linhas[i].split(sep).map((c) => c.trim().toLowerCase());
    const cTicker = coluna(cab, COLUNAS.ticker);
    if (cTicker === -1) continue;
    const cQtd = coluna(cab, COLUNAS.quantidade, [cTicker]);
    const cCusto = coluna(cab, COLUNAS.custo, [cTicker, cQtd]);
    const cPreco = coluna(cab, COLUNAS.preco, [cTicker, cQtd, cCusto]);
    const cValor = coluna(cab, COLUNAS.valor, [cTicker, cQtd, cCusto, cPreco]);
    if (cQtd === -1 && cValor === -1) continue;

    const ativos: ParsedHolding[] = [];
    for (const linha of linhas.slice(i + 1)) {
      const cel = linha.split(sep);
      const ticker = ehTicker(cel[cTicker] ?? "");
      if (!ticker) continue;
      const qtd = cQtd !== -1 ? numeroEmDolar(cel[cQtd] ?? "") : NaN;
      const preco = cPreco !== -1 ? numeroEmDolar(cel[cPreco] ?? "") : NaN;
      let valor = cValor !== -1 ? numeroEmDolar(cel[cValor] ?? "") : NaN;
      if (!(valor > 0) && qtd > 0 && preco > 0) valor = qtd * preco;
      const custoBruto = cCusto !== -1 ? numeroEmDolar(cel[cCusto] ?? "") : NaN;
      // "Preço médio" é por cota; "custo"/"investido" já é o total.
      const custoPorCota = cCusto !== -1 && /m[ée]dio|average|avg/.test(cab[cCusto]);
      const investido = custoBruto > 0 ? (custoPorCota && qtd > 0 ? custoBruto * qtd : custoBruto) : undefined;
      if (!(valor > 0) && !(qtd > 0)) continue;
      ativos.push({
        ticker,
        quantity: qtd > 0 ? qtd : 0,
        value: valor > 0 ? Math.round(valor * 100) / 100 : 0,
        assetClass: "INTERNACIONAL",
        investedValue: investido !== undefined ? Math.round(investido * 100) / 100 : undefined,
        currency: "USD",
      });
    }
    if (ativos.length > 0) return ativos;
  }
  return [];
}

const NUMERO = /(?<![A-Za-z\d])\$?\d[\d.,]*/g;

/** Texto de PDF: ticker no começo da linha e um trio quantidade × preço = valor. */
function lerTexto(linhas: string[]): ParsedHolding[] {
  const ativos: ParsedHolding[] = [];
  for (const linha of linhas) {
    const m = linha.trim().match(/^([A-Z]{1,5}(?:\.[A-Z])?)\*?\s/);
    if (!m || !ehTicker(m[1])) continue;
    const numeros = (linha.slice(m[0].length).match(NUMERO) ?? []).map(numeroEmDolar).filter((n) => n > 0);
    let achou: { qtd: number; preco: number; valor: number } | null = null;
    for (let a = 0; a < numeros.length && !achou; a++) {
      for (let b = a + 1; b < numeros.length && !achou; b++) {
        for (let c = b + 1; c < numeros.length; c++) {
          const [qtd, preco, valor] = [numeros[a], numeros[b], numeros[c]];
          if (Math.abs(qtd * preco - valor) <= Math.max(0.02, valor * 0.005)) {
            achou = { qtd, preco, valor };
            break;
          }
        }
      }
    }
    if (!achou) continue;
    ativos.push({ ticker: m[1], quantity: achou.qtd, value: Math.round(achou.valor * 100) / 100, assetClass: "INTERNACIONAL", currency: "USD" });
  }
  return ativos;
}

/** Ativos em dólar do arquivo; vazio quando não é carteira de fora. */
export function lerCarteiraNoExterior(content: string): ParsedHolding[] {
  if (!pareceCarteiraNoExterior(content)) return [];
  // Tem ação da B3 (PETR4, IVVB11)? É arquivo daqui, mesmo falando em dólar em algum canto: os
  // leitores brasileiros ficam com ele, senão as ações daqui sumiriam da importação.
  if (/\b[A-Z]{4}\d{1,2}\b/.test(content)) return [];
  const linhas = content.split(/\r?\n/).filter((l) => l.trim() !== "");
  const tabela = lerTabela(linhas);
  return tabela.length > 0 ? tabela : lerTexto(linhas);
}
