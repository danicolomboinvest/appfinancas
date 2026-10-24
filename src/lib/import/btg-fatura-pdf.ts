import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Fatura do cartão BTG Pactual (também o cartão EQI, emitido pelo BTG) em PDF.
 *
 *   Daniela Exemplo | fatura de Junho de 2026 | cartão final 0000
 *   Pagamentos feitos pelo cliente
 *   - R$ 16.754,82 <TAB> Pagamento de fatura <TAB> 18 Mai      ← pagamento da anterior: não é lançamento
 *   Lançamentos do cartão físico | Fulana | Final 0000 Total do cartão: R$ 6.190,67
 *   Total de créditos recebidos
 *   - R$ 27,81 <TAB> Cancelamento - Loja <TAB> 08 Jun          ← crédito vem com "-"
 *   Total de compras e despesas
 *   R$ 506,00 <TAB> Hospital Exemplo (4/5) <TAB> 27 Fev         ← valor, nome e data, nessa ordem
 *   US$ 36,00 <TAB> Calendly <TAB> 15 Mai                       ← compra em moeda estrangeira:
 *   Cotação da moeda -                                             a cotação e depois o valor em real
 *   Conversão para Real -                                          vêm sozinhos nas linhas de baixo
 *   R$ 5,27
 *   R$ 190,07
 *   R$ 6.218,48                                                 ← subtotal do cartão: não é lançamento
 *
 * Às vezes dois créditos saem na mesma linha ("- R$ 192,40 <TAB> Cashback Lk <TAB> 16 Ago - R$
 * 192,40 <TAB> Cashback Lk <TAB> 16 Ago"). Nenhum leitor reconhecia o formato: 180 linhas com
 * valor e zero lançamentos.
 */

const MESES: Record<string, string> = {
  jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06",
  jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12",
};
const NOMES_DOS_MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const LANCAMENTO_RE =
  /(-\s*)?(R\$|US\$|[A-Z]{3})\s*(\d{1,3}(?:\.\d{3})*,\d{2})\t([^\t]+?)\t(\d{2}) (Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)\b/g;
const SO_VALOR_RE = /^-?\s*R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})$/;
const FATURA_DE_RE = /\|\s*fatura de (\p{L}+) de (\d{4})\s*\|/iu;

export function isBtgInvoice(texto: string): boolean {
  return /BTG Pactual/i.test(texto) && /^Lan[çc]amentos do cart[ãa]o\b/m.test(texto) && /^Total de compras e despesas\b/m.test(texto);
}

export function parseBtgInvoice(texto: string, refYear: number = new Date().getFullYear()): ParsedTransaction[] {
  const fatura = texto.match(FATURA_DE_RE);
  const mesFatura = fatura ? NOMES_DOS_MESES.indexOf(fatura[1].toLowerCase()) + 1 || null : null;
  const anoFatura = fatura ? Number(fatura[2]) : refYear;
  // Compra de depois do vencimento é do ano anterior: "Loja (12/12) 18 Ago" na fatura que vence
  // em 17/08/2026 foi comprada em 18/08/2025 (antes entrava em 2026, um dia depois do vencimento).
  const venc = texto.match(/^Vencimento:\s*(\d{2})\/(\d{2})\b/m);
  const limite = venc && mesFatura !== null && Number(venc[2]) === mesFatura ? `${String(mesFatura).padStart(2, "0")}-${venc[1]}` : null;
  const out: ParsedTransaction[] = [];
  // Compras em outra moeda esperando o valor em real, e todos os números soltos ("R$ 5,27",
  // "R$ 190,07", subtotais) na ordem em que aparecem. A cotação e o valor em real de uma compra
  // nem sempre ficam logo abaixo dela: na quebra de página o bloco "Cotação / Conversão" desce
  // para depois do cabeçalho da página seguinte (fatura de julho: Manychat US$ 165,00 ficou com
  // "R$ 27,41" de outra compra e faltaram R$ 899,05). Por isso o par certo é achado pela conta:
  // valor em dólar × cotação = valor em real.
  const estrangeiras: { txn: ParsedTransaction; estrangeiro: number; posicao: number }[] = [];
  const soltos: number[] = [];
  const negativos: boolean[] = [];

  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.trim();
    const soValor = linha.match(SO_VALOR_RE);
    if (soValor) {
      soltos.push(parseBrazilianNumber(soValor[1]));
      negativos.push(linha.startsWith("-"));
      continue;
    }
    for (const m of linha.matchAll(LANCAMENTO_RE)) {
      const [, menos, moeda, valorTxt, descricao, dd, mesNome] = m;
      if (/^Pagamento de fatura\b/i.test(descricao.trim())) continue;
      const mm = MESES[mesNome.toLowerCase()];
      // Parcela comprada no ano anterior ("Cativa (10/12) 18 Ago" na fatura de junho).
      const anoAnterior = limite ? `${mm}-${dd}` > limite : mesFatura !== null && Number(mm) > mesFatura;
      const ano = anoAnterior ? anoFatura - 1 : anoFatura;
      const sinal = menos ? -1 : 1;
      const valor = parseBrazilianNumber(valorTxt);
      const txn: ParsedTransaction = { date: `${ano}-${mm}-${dd}`, description: descricao.trim(), amount: sinal * valor };
      if (moeda === "R$") out.push(txn);
      else {
        estrangeiras.push({ txn, estrangeiro: valor, posicao: soltos.length });
        out.push(txn); // entra na ordem do arquivo; sai de novo se não achar o valor em real
      }
    }
  }

  const usados = new Set<number>();
  const casa = (e: { estrangeiro: number }, k: number) => {
    if (usados.has(k) || usados.has(k + 1) || k + 1 >= soltos.length) return false;
    const esperado = e.estrangeiro * soltos[k];
    return Math.abs(esperado - soltos[k + 1]) <= Math.max(0.05, esperado * 0.01);
  };
  const aplicar = (e: (typeof estrangeiras)[number], i: number) => {
    usados.add(i);
    usados.add(i + 1);
    // Crédito em moeda estrangeira (estorno de aluguel de carro em euro): a linha da compra vem sem
    // sinal e quem traz o "-" é o valor em real.
    e.txn.amount = e.txn.amount < 0 || negativos[i + 1] ? -soltos[i + 1] : soltos[i + 1];
  };
  // 1ª rodada: compra cujo par está logo abaixo dela (o normal). Essas ficam resolvidas e dão a
  // cotação de referência de cada dia para desempatar as outras.
  const resolvidas: { e: (typeof estrangeiras)[number]; cotacao: number }[] = [];
  const pendentes: (typeof estrangeiras) = [];
  // Quando várias compras em moeda estrangeira aparecem seguidas, só a ÚLTIMA delas tem o par logo
  // abaixo; as de cima ficaram sem o seu (desceu na quebra de página).
  const ultimaDaPosicao = new Map<number, (typeof estrangeiras)[number]>();
  for (const e of estrangeiras) ultimaDaPosicao.set(e.posicao, e);
  for (const e of estrangeiras) {
    if (ultimaDaPosicao.get(e.posicao) === e && e.posicao < soltos.length && casa(e, e.posicao)) {
      resolvidas.push({ e, cotacao: soltos[e.posicao] });
      aplicar(e, e.posicao);
    } else pendentes.push(e);
  }
  // 2ª rodada: o par desceu na quebra de página. Várias compras iguais em dólar (4 Manychat de
  // US$ 10,00) fecham a conta com qualquer par, e a ordem do texto trocava o valor em real entre
  // elas. Aqui vale a cotação das compras resolvidas mais próximas na data (o dólar muda pouco
  // de um dia para o outro); sem referência, a ordem do texto.
  const dia = (iso: string) => new Date(`${iso}T12:00:00Z`).getTime() / 86_400_000;
  for (const e of pendentes) {
    const candidatos = [...soltos.keys()].filter((k) => casa(e, k));
    if (candidatos.length === 0) {
      // Sem par que feche a conta, a compra fica de fora: melhor faltar (a conferência com o total
      // da fatura avisa) do que entrar com um valor de outra compra.
      out.splice(out.indexOf(e.txn), 1);
      continue;
    }
    const perto = resolvidas
      .filter((r) => r.e.txn.date && r.e !== e)
      .sort((x, y) => Math.abs(dia(x.e.txn.date) - dia(e.txn.date)) - Math.abs(dia(y.e.txn.date) - dia(e.txn.date)))[0];
    const distanciaPosicao = (k: number) => (k >= e.posicao ? k - e.posicao : soltos.length + e.posicao - k);
    candidatos.sort((x, y) => {
      if (perto) {
        const d = Math.abs(soltos[x] - perto.cotacao) - Math.abs(soltos[y] - perto.cotacao);
        if (Math.abs(d) > 0.0001) return d;
      }
      return distanciaPosicao(x) - distanciaPosicao(y);
    });
    aplicar(e, candidatos[0]);
    resolvidas.push({ e, cotacao: soltos[candidatos[0]] });
  }
  // Mensalidade do cartão que o resumo cobra mas a lista de lançamentos não traz (fatura de junho
  // de uma cliente: R$ 90,00 de fora e a conferência acusava "não fechou"). Só entra quando não
  // há linha de mensalidade na lista (senão dobra); o valor do resumo já vem com o desconto.
  const mensalidade = texto.match(/^Mensalidade do cart[ãa]o de cr[ée]dito\s+R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/im);
  if (mensalidade && venc && !out.some((t) => /mensalidade/i.test(t.description))) {
    const valor = parseBrazilianNumber(mensalidade[1]);
    if (valor > 0) out.push({ date: `${anoFatura}-${venc[2]}-${venc[1]}`, description: "Mensalidade cartão de crédito", amount: valor });
  }
  return out;
}
