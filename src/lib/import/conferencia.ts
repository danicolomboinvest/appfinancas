import { detectInvoiceTotal } from "./detect";
import { comprasDaFaturaSaoPositivas } from "./fatura-lines";
import type { ParsedTransaction } from "./statement-parser";

/**
 * A leitura bateu com o que o PRÓPRIO documento diz?
 *
 * O aviso antigo contava linhas: "viu 52 linhas com valor e leu 11, então leu só parte". Só que
 * fatura e extrato em PDF têm muito número que não é lançamento — simulação de parcelamento,
 * taxa de juros, limite, comprovante repetindo o Pix. Em 29/09/2026, 10 dos 19 "erros" do dia
 * eram leituras perfeitas; e é essa mesma régua que decide mandar mensagem pra cliente dizendo
 * que o app leu errado.
 *
 * Aqui a conta é com o dinheiro: o total que a fatura imprime, o "Total de entradas/saídas" do
 * extrato. Bateu, fechou. Não bateu, faltou (ou sobrou) coisa de verdade.
 */

export type Conferencia =
  | { status: "fechou"; lido: number; esperado: number }
  | { status: "nao-fechou"; lido: number; esperado: number }
  | { status: "sem-referencia" };

const VALOR = String.raw`(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})`;

const TOTAL_DE_COMPRAS_NUBANK = new RegExp(String.raw`total\s+de\s+compras[^\n]*?R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})`, "i");

/** Totais de COMPRAS que as faturas imprimem, além do total a pagar (que mistura saldo anterior e pagamento). */
const TOTAIS_DE_COMPRAS: RegExp[] = [
  new RegExp(String.raw`compras\s+nacionais\s*${VALOR}`, "i"), // Ourocard
  new RegExp(String.raw`despesas\s+do\s+m[êe]s\s*${VALOR}`, "i"), // Inter
  TOTAL_DE_COMPRAS_NUBANK,
  new RegExp(String.raw`total\s+despesas\/d[ée]bitos\s+no\s+brasil\s*${VALOR}`, "i"), // Santander
  new RegExp(String.raw`compras\/d[ée]bitos\.*\s*${VALOR}`, "i"), // Bradesco
  new RegExp(String.raw`total\s+da\s+fatura\s+em\s+real[\s.]*${VALOR}`, "i"), // Bradesco (o app Bradesco Cartões põe ". . ." no meio)
  new RegExp(String.raw`^despesas\/d[ée]bitos\s+no\s+brasil\s*\+\s*${VALOR}`, "im"), // Riachuelo (Midway)
  new RegExp(String.raw`^despesas\s+atuais\s*\|\s*d[ée]bitos\s+no\s+brasil\s*${VALOR}`, "im"), // Sicredi
  new RegExp(String.raw`^consumos\s+de\s+\d{2}\/\d{2}\s+a\s+\d{2}\/\d{2}\s*${VALOR}`, "im"), // Mercado Pago
  new RegExp(String.raw`^total\s+de\s+gastos\s*${VALOR}`, "im"), // Banrisul
  // Itaú: "Lançamentos atuais 5.271,04" é só o mês; o total da fatura soma o que sobrou da anterior.
  new RegExp(String.raw`^(?:total\s+dos\s+)?lan[çc]amentos\s+atuais\s*${VALOR}`, "im"),
];

/** Saldo da fatura anterior que não foi pago e veio somado no total a pagar (C6). Não é compra
 * deste mês, então o total a pagar menos ele é o que as linhas têm que somar. */
const REMANESCENTE = new RegExp(String.raw`valor\s+remanescente\s+da\s+fatura\s+anterior\s*${VALOR}`, "i");

const OUTROS_LANCAMENTOS = new RegExp(String.raw`^outros\s+lan[çc]amentos\s*${VALOR}`, "im");

/**
 * O resumo que quase toda fatura imprime: anterior − pagamento + o que entrou no mês = total. As
 * linhas do mês (sem o pagamento, que é linha de resumo) somam então total − anterior +
 * pagamento. Faz falta quando o mês tem CRÉDITO além de compra: renegociação no Nubank
 * ("Crédito de parcelamento −R$ 5.150,07", antecipações, descontos) e encargos de atraso na
 * Riachuelo — leituras certas no centavo que o alarme acusava de "não fechou".
 */
const ANTERIOR = new RegExp(String.raw`^(?:total\s+da\s+)?(?:fatura|saldo)\s+anterior:?\s*${VALOR}`, "im");
const PAGAMENTO_DO_RESUMO = new RegExp(
  String.raw`^(?:\(\+\)\s*)?(?:pagamento\s+recebido|pagamentos(?:\s+efetuados)?\/cr[ée]ditos):?\s*[−-]?\s*(?:R\$\s*)?[−-]?\s*(\d{1,3}(?:\.\d{3})*,\d{2})`,
  "im",
);
const TOTAL_ITAU_JUNTO = /Totaldoslan[çc]amentosatuais(\d{1,3}(?:\.\d{3})*,\d{2})/i;
/** O total no próprio resumo ("Saldo desta Fatura 254,49" na Riachuelo, que o detector geral não pega). */
const TOTAL_DO_RESUMO = new RegExp(String.raw`^(?:saldo\s+desta\s+fatura|total\s+da\s+fatura\s+atual|total\s+a\s+pagar):?\s*${VALOR}`, "im");

const TOTAL_ENTRADAS = new RegExp(String.raw`total\s+de\s+entradas\s*\+?\s*${VALOR}`, "i");
const TOTAL_SAIDAS = new RegExp(String.raw`total\s+de\s+sa[íi]das\s*-?\s*${VALOR}`, "i");

/**
 * Extrato do Nubank em PDF: os rótulos do resumo vêm numa coluna e os números noutra, e a linha
 * "Total de entradas + 225,00" que aparece depois é o subtotal de UM dia. Sem isto o alarme
 * comparava o mês inteiro lido com o primeiro dia e acusava erro em leitura certa.
 */
const RESUMO_EM_COLUNA = new RegExp(
  String.raw`Total de entradas\s*\n\s*Total de sa[íi]das\s*\n\s*Saldo final do per[íi]odo\s*\n\s*-?\d[\d.]*,\d{2}\s*\n\s*[+-]\d[\d.]*,\d{2}\s*\n\s*\+(\d{1,3}(?:\.\d{3})*,\d{2})\s*\n\s*-(\d{1,3}(?:\.\d{3})*,\d{2})`,
  "i",
);

const MERCADO_PAGO_ENTRADAS = new RegExp(String.raw`\bEntradas:\s*${VALOR}`);
const MERCADO_PAGO_SAIDAS = new RegExp(String.raw`\bSa[íi]das:\s*(?:R\$\s*)?-?(\d{1,3}(?:\.\d{3})*,\d{2})`);

function numero(m: RegExpMatchArray | null): number | null {
  if (!m) return null;
  const n = Number(m[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Diferença de centavos é arredondamento; R$ 1 ou 0,5% (o que for maior) ainda é "bateu". */
function bate(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(1, Math.abs(b) * 0.005);
}

/**
 * `txns` já sem as linhas de resumo da fatura (pagamento da anterior, "total de compras").
 */
export function conferirLeitura(texto: string, docType: string, txns: ParsedTransaction[]): Conferencia {
  if (txns.length === 0) return { status: "sem-referencia" };

  if (docType === "fatura") {
    const positivas = comprasDaFaturaSaoPositivas(txns);
    const compras = txns.filter((t) => (positivas ? t.amount > 0 : t.amount < 0)).reduce((s, t) => s + Math.abs(t.amount), 0);
    const creditos = txns.filter((t) => (positivas ? t.amount < 0 : t.amount > 0)).reduce((s, t) => s + Math.abs(t.amount), 0);
    const total = detectInvoiceTotal(texto);
    const referencias = [total, ...TOTAIS_DE_COMPRAS.map((re) => numero(texto.match(re)))].filter(
      (n): n is number => n !== null,
    );
    // Nubank: "Outros lançamentos R$ 62,31" (IOF, encargos, Pix no crédito) fica fora do "Total de
    // compras", mas vem linha a linha na fatura.
    const outros = numero(texto.match(OUTROS_LANCAMENTOS));
    const comprasNubank = numero(texto.match(TOTAL_DE_COMPRAS_NUBANK));
    if (outros !== null && comprasNubank !== null) referencias.push(Math.round((comprasNubank + outros) * 100) / 100);
    const remanescente = numero(texto.match(REMANESCENTE));
    if (total !== null && remanescente !== null) referencias.push(Math.round((total - remanescente) * 100) / 100);
    // Itaú com espaço no meio das palavras e números ("L Tot al dos lançam ent os atuais 2.30 9,02").
    const totalItauJunto = numero(texto.replace(/[ \t]+/g, "").match(TOTAL_ITAU_JUNTO));
    if (totalItauJunto !== null) referencias.push(totalItauJunto);
    const anterior = numero(texto.match(ANTERIOR));
    const pagamento = numero(texto.match(PAGAMENTO_DO_RESUMO));
    const totalDoResumo = numero(texto.match(TOTAL_DO_RESUMO)) ?? total;
    if (totalDoResumo !== null && anterior !== null && pagamento !== null) {
      const doMes = Math.round((totalDoResumo - anterior + pagamento) * 100) / 100;
      if (doMes > 0) referencias.push(doMes);
    }
    if (referencias.length === 0) return { status: "sem-referencia" };
    const lidos = [compras, compras - creditos];
    // De todas as combinações que batem, a mais próxima: com a folga de 0,5%, o total a pagar
    // (que inclui saldo da anterior) "batia" antes do total exato das compras.
    let melhor: { lido: number; esperado: number } | null = null;
    for (const esperado of referencias)
      for (const lido of lidos)
        if (bate(lido, esperado) && (!melhor || Math.abs(lido - esperado) < Math.abs(melhor.lido - melhor.esperado)))
          melhor = { lido, esperado };
    if (melhor) return { status: "fechou", ...melhor };
    return { status: "nao-fechou", lido: compras, esperado: referencias[0] };
  }

  // Extrato: só o que é inequívoco. Saldo inicial/final muda de nome e de sinal a cada banco, e
  // uma referência lida errada acusaria (e mandaria mensagem pra) quem teve a leitura certa.
  const coluna = texto.match(RESUMO_EM_COLUNA);
  // Mercado Pago: "Entradas: R$ 10.635,42" e "Saidas: R$ -10.625,71" no topo.
  const entradas = coluna ? numero([coluna[0], coluna[1]]) : numero(texto.match(TOTAL_ENTRADAS) ?? texto.match(MERCADO_PAGO_ENTRADAS));
  const saidas = coluna ? numero([coluna[0], coluna[2]]) : numero(texto.match(TOTAL_SAIDAS) ?? texto.match(MERCADO_PAGO_SAIDAS));
  if (entradas === null || saidas === null) return { status: "sem-referencia" };
  const lidoEntradas = txns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const lidoSaidas = txns.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0);
  const status = bate(lidoEntradas, entradas) && bate(lidoSaidas, saidas) ? "fechou" : "nao-fechou";
  return { status, lido: lidoEntradas + lidoSaidas, esperado: entradas + saidas };
}

/**
 * A régua única de "faltou coisa na leitura" (guardar o arquivo, relatório diário, aviso na tela).
 * - Bateu com o documento: não faltou nada, por mais linha com número que o arquivo tenha.
 * - Não bateu: faltou (ou sobrou) de verdade.
 * - Sem total pra conferir: leitor próprio do banco (já conferido com arquivo real) vale; o
 *   leitor genérico cai na régua antiga das linhas.
 */
export function leituraIncompleta(conf: Conferencia, leitorDedicado: boolean, linhasPartial: boolean): boolean {
  if (conf.status === "fechou") return false;
  if (conf.status === "nao-fechou") return true;
  return leitorDedicado ? false : linhasPartial;
}
