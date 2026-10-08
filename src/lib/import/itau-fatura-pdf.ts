import { remendarNumeros, semParcelaSeguinte } from "./numeros-quebrados";
import { parseBrazilianNumber, type ParsedTransaction } from "./statement-parser";

/**
 * Fatura do cartão Itaú em PDF.
 *
 *   Emissão: 26/09/2026
 *   Pagamentos efetuados
 *   04/09 Pagamento via conta -1.000,00                  ← pagamento da fatura anterior
 *   Lançamentos: compras e saques
 *   09/06 LOJA EXEMPLO 04/06 99,99                        ← parcela cobrada NESTA fatura
 *   alimentação SAO PAULO                                 ← categoria + cidade: a categoria vai pra compra de cima
 *   Lançamentos internacionais
 *   29/08 FARMACIA EXEMPLO 12,12                          ← o valor da linha já é em R$
 *   26,00 BOB 2,20                                        ← moeda de origem e dólar: ignora
 *   Repasse de IOF em R$ 0,67                             ← cobrança de verdade, sem data
 *   Total dos lançamentos atuais 9.741,14
 *   Compras parceladas - próximas faturas                 ← NÃO é desta fatura
 *   09/06 LOJA EXEMPLO 05/06 99,99
 *
 * O leitor genérico pegava toda linha com data e valor: o quadro "Compras parceladas - próximas
 * faturas", que só avisa o que VAI ser cobrado, entrava como gasto deste mês — numa fatura de
 * R$ 9.741, R$ 2.662 a mais, e a mesma parcela de novo na fatura seguinte. E o "Repasse de IOF"
 * das compras no exterior, que não tem data, ficava de fora.
 *
 * Compra sai POSITIVA e pagamento/estorno NEGATIVO; o pagamento sai como linha de resumo
 * (ver `isFaturaSummaryLine`).
 */

const LINHA_RE = /^(\d{2})\/(\d{2})\s+(.+?)\s+(-)?\s?(\d{1,3}(?:\.\d{3})*,\d{2})$/;
const EMISSAO_RE = /(?:Emiss[ãa]o|Postagem):\s*(\d{2})\/(\d{2})\/(\d{4})/i;
const INICIO_RE = /^(Pagamentos efetuados|Lan[çc]amentos:\s*compras e saques|Lan[çc]amentos internacionais|Lan[çc]amentos:\s*produtos e servi[çc]os)\b/i;
const FIM_RE = /^(Total dos lan[çc]amentos atuais|Compras parceladas\s*-\s*pr[óo]ximas faturas)\b/i;
const IOF_RE = /^Repasse de IOF em R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})$/i;
/**
 * A linha logo abaixo da compra: categoria em minúsculas e cidade em maiúsculas
 * ("alimentação SAO PAULO", "turismo e entretenim RIO DE JANEIRO"). Só a categoria interessa.
 */
const CATEGORIA_RE = /^([a-zà-ÿ][a-zà-ÿ .]*?[a-zà-ÿ])\s+[A-ZÀ-Þ][A-ZÀ-Þ0-9 .'-]*$/;

export function isItauInvoice(texto: string): boolean {
  // Sem espaço nenhum, pra também reconhecer o PDF que sai com espaço no meio das palavras
  // ("Lanç am ent o s: c o mp ra s e saq ue s").
  const junto = semEspacos(texto);
  return (
    /\bita[uú](?![a-z])/i.test(texto) &&
    /Lan[çc]amentos:comprasesaques/i.test(junto) &&
    /Totaldoslan[çc]amentosatuais/i.test(junto)
  );
}

const semEspacos = (texto: string) => texto.replace(/[ \t]+/g, "");

export function parseItauInvoice(texto: string, refYear: number = new Date().getFullYear()): ParsedTransaction[] {
  const porSecao = lerItau(texto, refYear, true);
  if (fechaComOMes(texto, porSecao)) return porSecao;
  // PDF de duas colunas: a extração mistura as colunas e há compras do mês ANTES do primeiro
  // título (25 linhas, R$ 1.616, numa fatura de 30/09/2026). Lê toda linha com data, tira o
  // quadro das próximas faturas pelo total impresso dele, e só fica com isso se fechar no centavo.
  const tudo = semProximasFaturas(texto, lerItau(texto, refYear, false));
  if (fechaComOMes(texto, tudo)) return tudo;
  const espacado = lerItauEspacado(texto, refYear);
  return fechaComOMes(texto, espacado) ? espacado : porSecao;
}

/**
 * PDF em que a extração abre espaço NO MEIO de palavras e números, com as duas colunas na
 * mesma linha:
 *
 *   01/08 SA NT A FE SUP ERMER CAD OSS 53 ,90 04/ 08 PIX Ministe rio 01/02 125, 56
 *   L Tot al dos lançam ent os atuais 2.30 9,02
 *
 * Nenhum leitor achava data nem valor ("53 ,90", "2.30 9,02", "04/ 08"): o genérico leu 6 linhas
 * erradas — o limite do cartão (R$ 3.400) como lançamento — numa fatura de 21 compras.
 * Aqui os números são remendados, cada linha pode ter até duas compras (uma por coluna), e o
 * quadro das próximas faturas sai pela parcela seguinte da MESMA compra. Só vale se fechar no
 * centavo com o total do mês (ver `parseItauInvoice`).
 */
function lerItauEspacado(texto: string, refYear: number): ParsedTransaction[] {
  const emissao = texto.match(EMISSAO_RE);
  const mesEmissao = emissao ? Number(emissao[2]) : null;
  const anoEmissao = emissao ? Number(emissao[3]) : refYear;
  const out: ParsedTransaction[] = [];
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = remendarNumeros(bruta.replace(/\t/g, " ").replace(/\s+/g, " ").trim());
    // Com as colunas misturadas, o "Repasse de IOF em R$ 17,04" vem no meio da linha, colado no
    // texto da outra coluna.
    const iof = linha.match(IOF_NO_MEIO_RE);
    const valorIof = iof ? parseBrazilianNumber(iof[1]) : 0;
    if (valorIof > 0) {
      const data = emissao ? `${emissao[3]}-${emissao[2]}-${emissao[1]}` : out.at(-1)?.date;
      if (data) out.push({ date: data, description: "Repasse de IOF (compras no exterior)", amount: valorIof });
    }
    for (const m of linha.matchAll(COMPRA_NA_LINHA_RE)) {
      const [, dd, mm, descricao, menos, valor] = m;
      const magnitude = parseBrazilianNumber(valor);
      if (Number.isNaN(magnitude) || magnitude === 0) continue;
      const ano = mesEmissao !== null && Number(mm) > mesEmissao ? anoEmissao - 1 : anoEmissao;
      out.push({ date: `${ano}-${mm}-${dd}`, description: descricao.trim(), amount: menos ? -magnitude : magnitude });
    }
  }
  // Só compra pode ser parcela do quadro das próximas faturas. O cancelamento das parcelas
  // ("CANC PARCELAS 01/02 -111,19" e "02/02 -111,18", mesmo dia) parecia parcela seguinte de si
  // mesmo, e o crédito de R$ 111 sumia: a fatura não fechava por esse valor.
  const compras = semParcelaSeguinte(out.filter((t) => t.amount > 0));
  return out.filter((t) => t.amount <= 0 || compras.includes(t));
}

const IOF_NO_MEIO_RE = /Repasse de IOF em R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})(?!\d)/i;

/** Data que não é parte de data maior ("29/08/2026" fica de fora), descrição, valor. */
const COMPRA_NA_LINHA_RE = /(?<![\d/])(\d{2})\/(\d{2})(?![\d/])\s+(.+?)\s+(-)?\s?(\d{1,3}(?:\.\d{3})*,\d{2})(?=\s|$)/g;


function lerItau(texto: string, refYear: number, soNasSecoes: boolean): ParsedTransaction[] {
  // A fatura não traz o ano de cada compra. A emissão traz: compra de um mês DEPOIS do mês da
  // emissão só pode ser do ano anterior (parcela de compra antiga).
  const emissao = texto.match(EMISSAO_RE);
  const mesEmissao = emissao ? Number(emissao[2]) : null;
  const anoEmissao = emissao ? Number(emissao[3]) : refYear;

  const out: ParsedTransaction[] = [];
  let dentro = !soNasSecoes;
  // A compra que acabou de ser lida: a linha de categoria logo abaixo é dela, e de mais ninguém.
  let ultimaCompra: ParsedTransaction | null = null;
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.replace(/\t/g, " ").replace(/\s+/g, " ").trim();
    const compraAnterior = ultimaCompra;
    ultimaCompra = null;
    const cat = compraAnterior ? linha.match(CATEGORIA_RE) : null;
    if (cat && compraAnterior) {
      compraAnterior.categoriaDoBanco = cat[1];
      continue;
    }
    // Pausa, não fim: em PDF de duas colunas, compras DESTE mês voltam depois do quadro das
    // próximas faturas, embaixo de um novo "Lançamentos: compras e saques".
    if (FIM_RE.test(linha)) {
      dentro = !soNasSecoes;
      continue;
    }
    if (INICIO_RE.test(linha)) {
      dentro = true;
      continue;
    }
    if (!dentro) continue;

    const iof = linha.match(IOF_RE);
    if (iof) {
      const valor = parseBrazilianNumber(iof[1]);
      // Sem data própria: cai no dia da emissão (ou no da última compra, se a emissão sumiu).
      const data = emissao ? `${emissao[3]}-${emissao[2]}-${emissao[1]}` : out.at(-1)?.date;
      if (data && valor > 0) out.push({ date: data, description: "Repasse de IOF (compras no exterior)", amount: valor });
      continue;
    }

    const m = linha.match(LINHA_RE);
    if (!m) continue;
    const [, dd, mm, descricao, menos, valor] = m;
    const magnitude = parseBrazilianNumber(valor);
    if (Number.isNaN(magnitude) || magnitude === 0) continue;
    const ano = mesEmissao !== null && Number(mm) > mesEmissao ? anoEmissao - 1 : anoEmissao;
    const compra: ParsedTransaction = { date: `${ano}-${mm}-${dd}`, description: descricao.trim(), amount: menos ? -magnitude : magnitude };
    out.push(compra);
    ultimaCompra = compra;
  }
  return soNasSecoes ? semProximasFaturas(texto, out) : out;
}

const VALOR = String.raw`(\d{1,3}(?:\.\d{3})*,\d{2})`;
const TOTAL_ATUAL_RE = new RegExp(String.raw`Total dos lan[çc]amentos atuais\s*${VALOR}`, "i");
const TOTAL_ATUAL_JUNTO_RE = new RegExp(String.raw`Totaldoslan[çc]amentosatuais${VALOR}`, "i");
const PROXIMA_RE = new RegExp(String.raw`^Pr[óo]xima fatura\s*${VALOR}`, "im");
const centavos = (n: number) => Math.round(n * 100);
const somaDoMes = (txns: ParsedTransaction[]) => centavos(txns.filter((t) => !/^pagamento/i.test(t.description)).reduce((s, t) => s + t.amount, 0));

/** A leitura soma exatamente o "Total dos lançamentos atuais" impresso? */
function fechaComOMes(texto: string, txns: ParsedTransaction[]): boolean {
  const total = texto.match(TOTAL_ATUAL_RE) ?? semEspacos(texto).match(TOTAL_ATUAL_JUNTO_RE);
  return !!total && txns.length > 0 && Math.abs(somaDoMes(txns) - centavos(parseBrazilianNumber(total[1]))) <= 1;
}

/**
 * PDF em duas colunas: a extração às vezes solta as linhas do quadro "Compras parceladas -
 * próximas faturas" ANTES do título dele, e aí nada indica que não são desta fatura (R$ 2.800 a
 * mais numa de R$ 9.457). A fatura imprime o total do quadro ("Próxima fatura 3.716,75"): se a
 * leitura passou do total do mês exatamente nesse valor, tira o bloco seguido de linhas que soma
 * isso. Só mexe quando as duas contas batem no centavo.
 */
function semProximasFaturas(texto: string, txns: ParsedTransaction[]): ParsedTransaction[] {
  const total = texto.match(TOTAL_ATUAL_RE);
  const proxima = texto.match(PROXIMA_RE);
  if (!total || !proxima) return txns;
  const alvo = centavos(parseBrazilianNumber(proxima[1]));
  const lido = somaDoMes(txns);
  if (lido - centavos(parseBrazilianNumber(total[1])) !== alvo || alvo <= 0) return txns;
  for (let a = 0; a < txns.length; a++) {
    let soma = 0;
    for (let b = a; b < txns.length; b++) {
      soma += centavos(txns[b].amount);
      if (soma === alvo) return [...txns.slice(0, a), ...txns.slice(b + 1)];
      if (soma > alvo) break;
    }
  }
  return txns;
}
