import { totalDoMesEmPesos } from "./argentina-tarjeta-pdf";
import { detectInvoiceTotal } from "./detect";
import { lerExtratoPeloSaldo } from "./extrato-pelo-saldo";
import { comprasDaFaturaSaoPositivas, pareceCreditoDePagamento } from "./fatura-lines";
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

// O (?!\d) impede ler "R$ 30,178.46" (planilha com vírgula de milhar) como R$ 30,17.
const VALOR = String.raw`(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})(?!\d)`;

const TOTAL_EM_REAL = new RegExp(String.raw`total\s+da\s+fatura\s+em\s+real[\s.]*${VALOR}`, "i");

const TOTAL_DE_COMPRAS_NUBANK = new RegExp(String.raw`total\s+de\s+compras[^\n]*?R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})(?!\d)`, "i");

/** Totais de COMPRAS que as faturas imprimem, além do total a pagar (que mistura saldo anterior e pagamento). */
const TOTAIS_DE_COMPRAS: RegExp[] = [
  new RegExp(String.raw`compras\s+nacionais\s*${VALOR}`, "i"), // Ourocard
  new RegExp(String.raw`despesas\s+do\s+m[êe]s\s*${VALOR}`, "i"), // Inter
  TOTAL_DE_COMPRAS_NUBANK,
  new RegExp(String.raw`total\s+despesas\/d[ée]bitos\s+no\s+brasil\s*${VALOR}`, "i"), // Santander
  new RegExp(String.raw`compras\/d[ée]bitos\.*\s*${VALOR}`, "i"), // Bradesco
  TOTAL_EM_REAL, // Bradesco (o app Bradesco Cartões põe ". . ." no meio)
  new RegExp(String.raw`^despesas\/d[ée]bitos\s+no\s+brasil\s*\+\s*${VALOR}`, "im"), // Riachuelo (Midway)
  new RegExp(String.raw`^despesas\s+atuais\s*\|\s*d[ée]bitos\s+no\s+brasil\s*${VALOR}`, "im"), // Sicredi
  new RegExp(String.raw`^consumos\s+de\s+\d{2}\/\d{2}\s+a\s+\d{2}\/\d{2}\s*${VALOR}`, "im"), // Mercado Pago
  new RegExp(String.raw`^total\s+de\s+gastos\s*${VALOR}`, "im"), // Banrisul
  new RegExp(String.raw`^despesas\s+e\s+cr[ée]ditos\s+do\s+m[êe]s\s*${VALOR}`, "im"), // Nomad
  new RegExp(String.raw`^despesas\s+at[ée]\s+a\s+emiss[ãa]o\s+desta\s+fatura\s*${VALOR}`, "im"), // XP
  // "Esta é a fatura de setembro / no valor total de R$ 349,90." (Ailos, Porto Seguro).
  // "DESPESAS/DÉBITOS <TAB> + R$ 3.240,53" (Unicred, Ailos).
  new RegExp(String.raw`^despesas\s*\/\s*d[ée]bitos\s*\+?\s*${VALOR}`, "im"),
  new RegExp(String.raw`\bno\s+valor\s+total\s+de\s*${VALOR}`, "i"),
  // "O valor total é / R$ 7.437,33" (Porto Seguro), "1.900,04 <TAB> Total R$" (Renner/Realize).
  new RegExp(String.raw`\bo\s+valor\s+total\s+[ée]\s*${VALOR}`, "i"),
  /^(\d{1,3}(?:\.\d{3})*,\d{2})\s+total\s+R\$\s*$/im,
  // Santander: "(=) Saldo Desta Fatura 2.072,07" já desconta os créditos (devolução, estorno) do mês.
  new RegExp(String.raw`^\(=\)\s*saldo\s+desta\s+fatura\s*${VALOR}`, "im"),
  // Itaú: "Lançamentos atuais 5.271,04" é só o mês; o total da fatura soma o que sobrou da anterior.
  new RegExp(String.raw`^(?:total\s+dos\s+)?lan[çc]amentos\s+atuais\s*${VALOR}`, "im"),
];

/** Saldo da fatura anterior que não foi pago e veio somado no total a pagar (C6). Não é compra
 * deste mês, então o total a pagar menos ele é o que as linhas têm que somar. */
const REMANESCENTE = new RegExp(String.raw`valor\s+remanescente\s+da\s+fatura\s+anterior\s*${VALOR}`, "i");

/** App Bradesco Cartões com a fatura "EM ABERTO": o "Total da Fatura em Real" soma o saldo da
 * anterior ("10/10 SALDO ANTERIOR BRL 0,00 0,00 R$ 0,00 1.097,14"), que não é compra deste mês. */
const SALDO_ANTERIOR_BRADESCO_APP = /SALDO ANTERIOR BRL\s+[\d.,]+\s+[\d.,]+\s+R\$\s*[\d.,]+\s+(\d{1,3}(?:\.\d{3})*,\d{2})/i;

/** C6: "(-) 500,00 <TAB> Pagamento antecipado". Quem adianta parte da fatura antes de fechar vê o
 * total a pagar já descontado, mas a linha "Inclusao de Pagamento" fica de fora da leitura. */
const PAGAMENTO_ANTECIPADO_C6 = new RegExp(String.raw`\(-\)\s*${VALOR}\s+pagamento\s+antecipado`, "i");

/** Sicoob: o resumo vem com o número antes do rótulo ("+ 16,95 <TAB> ENCARGOS", "+ 605,69 <TAB>
 * DESPESAS/DÉBITOS"). Encargos (anuidade, seguro, IOF) + despesas no Brasil + no exterior = tudo
 * que foi lançado no mês; o "SALDO TOTAL" mistura a anterior e o pagamento (que conta duas vezes
 * quando a pessoa pagou por débito e boleto). */
const SICOOB_RESUMO = /^\+ (\d{1,3}(?:\.\d{3})*,\d{2})\s+(?:ENCARGOS|DESPESAS\/D[ÉE]BITOS(?: INTERNACIONAIS)?)$/gm;

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

const RESUMO_MENSAL_C6 = /Entradas:\s*R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})\s*•\s*Sa[íi]das:\s*R\$\s*-?(\d{1,3}(?:\.\d{3})*,\d{2})/gi;

const MERCADO_PAGO_ENTRADAS = new RegExp(String.raw`\bEntradas:\s*${VALOR}`);
// "Saídas: -R$ 6.330,82" (RecargaPay) põe o sinal antes do R$.
const MERCADO_PAGO_SAIDAS = new RegExp(String.raw`\bSa[íi]das:\s*-?\s*(?:R\$\s*)?-?(\d{1,3}(?:\.\d{3})*,\d{2})`);

function numero(m: RegExpMatchArray | null): number | null {
  if (!m) return null;
  const n = Number(m[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** O valor casado é exatamente zero ("R$ 0,00"). */
function zerado(m: RegExpMatchArray | null): boolean {
  return m !== null && /^0,00$/.test(m[1]);
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
    // O crédito que fala em pagamento ("PAGAMENTO PIX" no Itaú) a revisão já deixa de fora como
    // pagamento da fatura anterior; somado aqui, a fatura certa no centavo caía em "não fechou".
    const creditos = txns
      .filter((t) => (positivas ? t.amount < 0 : t.amount > 0) && !pareceCreditoDePagamento(t.description))
      .reduce((s, t) => s + Math.abs(t.amount), 0);
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
    const antecipadoC6 = numero(texto.match(PAGAMENTO_ANTECIPADO_C6));
    if (total !== null && antecipadoC6 !== null) referencias.push(Math.round((total + antecipadoC6) * 100) / 100);
    const saldoAnteriorBradesco = numero(texto.match(SALDO_ANTERIOR_BRADESCO_APP));
    const totalEmReal = numero(texto.match(TOTAL_EM_REAL));
    if (totalEmReal !== null && saldoAnteriorBradesco !== null) referencias.push(Math.round((totalEmReal - saldoAnteriorBradesco) * 100) / 100);
    // Itaú com espaço no meio das palavras e números ("L Tot al dos lançam ent os atuais 2.30 9,02").
    const totalItauJunto = numero(texto.replace(/[ \t]+/g, "").match(TOTAL_ITAU_JUNTO));
    if (totalItauJunto !== null) referencias.push(totalItauJunto);
    const anterior = numero(texto.match(ANTERIOR));
    const pagamento = numero(texto.match(PAGAMENTO_DO_RESUMO));
    // Fatura já paga antes de fechar: "Total a pagar R$ 0,00". Zero é um total de verdade aqui
    // (anterior − pagamento + o mês = 0); sem isto a conta do mês não era feita e a leitura certa
    // de uma fatura do Nubank (13/10/2026) caía em "não fechou".
    const totalDoResumo = numero(texto.match(TOTAL_DO_RESUMO)) ?? (zerado(texto.match(TOTAL_DO_RESUMO)) ? 0 : total);
    if (totalDoResumo !== null && anterior !== null && pagamento !== null) {
      const doMes = Math.round((totalDoResumo - anterior + pagamento) * 100) / 100;
      if (doMes > 0) referencias.push(doMes);
    }
    const sicoob = [...texto.matchAll(SICOOB_RESUMO)];
    if (sicoob.length > 0) referencias.push(Math.round(sicoob.reduce((s, m) => s + (numero([m[0], m[1]]) ?? 0), 0) * 100) / 100);
    // Resumen de tarjeta argentino: saldo actual − anterior + o pago em pesos.
    const doMesAr = totalDoMesEmPesos(texto);
    if (doMesAr !== null) referencias.push(doMesAr);
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

  // Banco do Brasil: "1.060,00 (+) Saldo Anterior" no começo e "210,95 (-) S A L D O" no fim. Saldo
  // anterior + o que as linhas somam tem que dar o saldo final — a conta que o banco mesmo faz.
  // (Pix de valor redondo parecia "coluna errada" e dava alarme falso: 05/10/2026.)
  const porSaldo = conferirPorSaldoBB(texto, txns);
  if (porSaldo) return porSaldo;

  // Extrato: só o que é inequívoco. Saldo inicial/final muda de nome e de sinal a cada banco, e
  // uma referência lida errada acusaria (e mandaria mensagem pra) quem teve a leitura certa.
  // C6: "Entradas: R$ 10.857,25 • Saídas: R$ 10.931,35" em cada mês do arquivo — soma os meses.
  const meses = [...texto.matchAll(RESUMO_MENSAL_C6)];
  if (meses.length > 0) {
    const entradasC6 = meses.reduce((s, m) => s + (numero([m[0], m[1]]) ?? 0), 0);
    const saidasC6 = meses.reduce((s, m) => s + (numero([m[0], m[2]]) ?? 0), 0);
    const lidoE = txns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const lidoS = txns.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0);
    const ok = (lido: number, esperado: number) => (esperado === 0 ? lido < 0.01 : bate(lido, esperado));
    return { status: ok(lidoE, entradasC6) && ok(lidoS, saidasC6) ? "fechou" : "nao-fechou", lido: lidoE + lidoS, esperado: entradasC6 + saidasC6 };
  }
  // Nubank com vários meses juntados num PDF: um resumo por mês — soma todos.
  const colunas = [...texto.matchAll(new RegExp(RESUMO_EM_COLUNA.source, "gi"))];
  const somaColuna = (i: 1 | 2) => colunas.reduce((s, m) => s + (numero([m[0], m[i]]) ?? 0), 0) || null;
  // Mercado Pago: "Entradas: R$ 10.635,42" e "Saidas: R$ -10.625,71" no topo.
  // "Saidas: R$ 0,00" (conta que só rendeu no período, Mercado Pago) é total de verdade: sem ele a
  // leitura certa ficava sem conferência e caía no alarme "tudo entrou como entrada".
  const totalOuZero = (m: RegExpMatchArray | null) => numero(m) ?? (zerado(m) ? 0 : null);
  const entradas = colunas.length > 0 ? somaColuna(1) : totalOuZero(texto.match(TOTAL_ENTRADAS) ?? texto.match(MERCADO_PAGO_ENTRADAS));
  const saidas = colunas.length > 0 ? somaColuna(2) : totalOuZero(texto.match(TOTAL_SAIDAS) ?? texto.match(MERCADO_PAGO_SAIDAS));
  const lidoEntradas = txns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const lidoSaidas = txns.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0);
  if (entradas === null || saidas === null) return conferirPeloSaldoDaLinha(texto, lidoEntradas, lidoSaidas);
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

/**
 * Prints da fatura aberta (19/10/2026): a soma das compras lidas com o total que o app do banco
 * mostra no topo. Bate com o total das compras ou com o líquido (compras menos estorno). Não
 * bater aqui quase sempre é print que faltou, não leitura errada: quem chama não trata como erro.
 */
export function conferirPrints(compras: { amount: number }[], total: number | null): Conferencia {
  if (total === null || compras.length === 0) return { status: "sem-referencia" };
  const centavos = (n: number) => Math.round(n * 100) / 100;
  const liquido = centavos(compras.reduce((s, c) => s + c.amount, 0));
  const soCompras = centavos(compras.filter((c) => c.amount > 0).reduce((s, c) => s + c.amount, 0));
  const lido = [liquido, soCompras].find((n) => bate(n, total));
  return lido !== undefined ? { status: "fechou", lido, esperado: total } : { status: "nao-fechou", lido: liquido, esperado: total };
}

const BB_SALDO_ANTERIOR = /(\d{1,3}(?:\.\d{3})*,\d{2})\s*\(([+-])\)\s*Saldo\s+Anterior/i;
/** O "S A L D O" sozinho na linha. As "Informações Adicionais" do fim trazem "9.821,19 (+) SALDO EM
 * CONTA-SALARIO", que não é o saldo desta conta: lido como final, acusava erro numa leitura certa. */
const BB_SALDO_FINAL = /(\d{1,3}(?:\.\d{3})*,\d{2})\s*\(([+-])\)\s*S\s*A\s*L\s*D\s*O[ \t]*$/gm;

const valorBR = (v: string) => Number(v.replace(/\./g, "").replace(",", "."));

function conferirPorSaldoBB(texto: string, txns: ParsedTransaction[]): Conferencia | null {
  const ini = texto.match(BB_SALDO_ANTERIOR);
  const fins = [...texto.matchAll(BB_SALDO_FINAL)];
  const fim = fins[fins.length - 1];
  if (!ini || !fim) return null;
  const sinal = (m: RegExpMatchArray) => (m[2] === "-" ? -1 : 1);
  const inicial = sinal(ini) * valorBR(ini[1]);
  const final = sinal(fim) * valorBR(fim[1]);
  if (Number.isNaN(inicial) || Number.isNaN(final)) return null;
  const soma = txns.reduce((acc, t) => acc + t.amount, 0);
  const esperado = Math.round((final - inicial) * 100) / 100;
  const lido = Math.round(soma * 100) / 100;
  return Math.abs(lido - esperado) <= 0.05 ? { status: "fechou", lido, esperado } : { status: "nao-fechou", lido, esperado };
}

/**
 * Extrato sem total impresso, mas com o saldo depois de cada lançamento (XP, Inter "saldo por
 * transação", Rico): se a leitura pela conta do saldo (extrato-pelo-saldo.ts, que só aceita quando
 * fecha no centavo linha a linha) chega às mesmas entradas e saídas, a leitura do leitor está
 * conferida. Só confirma, nunca acusa: o leitor pelo saldo pula linha sem saldo, e uma diferença
 * aqui não prova que faltou dinheiro. Sem isso, conta que só recebe rendimento ou só paga Pix
 * ganhava o alarme de "sinal perdido" com a leitura certa.
 */
function conferirPeloSaldoDaLinha(texto: string, lidoEntradas: number, lidoSaidas: number): Conferencia {
  const peloSaldo = lerExtratoPeloSaldo(texto);
  if (!peloSaldo || peloSaldo.length === 0) return { status: "sem-referencia" };
  const entradas = peloSaldo.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const saidas = peloSaldo.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0);
  const igual = (a: number, b: number) => Math.abs(a - b) < 0.01;
  if (!igual(lidoEntradas, entradas) || !igual(lidoSaidas, saidas)) return { status: "sem-referencia" };
  return { status: "fechou", lido: lidoEntradas + lidoSaidas, esperado: entradas + saidas };
}
