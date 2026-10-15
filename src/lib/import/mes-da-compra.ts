import { installmentCanonical, parseInstallment } from "@/lib/entries/recurrence";
import { cierreArgentino } from "./argentina";
import { detectarVencimento } from "./vencimento";

/**
 * Em que mês cada compra da fatura conta (out/2026).
 *
 * Antes a importação perguntava "Em que mês essa fatura vence?" e jogava a fatura inteira nesse
 * mês, sem dia. A dona achava a pergunta confusa ("fechou em agosto, vence em setembro, é de qual
 * mês?"). Agora o app decide sozinho, pelo que o próprio arquivo diz:
 *
 * - compra à vista: conta no mês em que foi feita, com o dia;
 * - parcela k/n: os leitores devolvem a data da compra ORIGINAL (a 09/10 de uma compra de 31/12
 *   vem com 31/12), então a parcela k conta no mês da compra + (k - 1), no dia da compra. Uma
 *   parcela por mês, e a mesma conta que a projeção das parcelas seguintes faz, então as faturas
 *   se encaixam;
 * - sem data legível: o mês do vencimento lido; sem vencimento, o mês de hoje.
 *
 * Não existe opção por pessoa de "conto a fatura no mês em que pago". Quem quiser isso para uma
 * fatura toca em "Mudar" na conferência, e aí vale o modo antigo (tudo num mês, sem dia).
 */

export type Mes = { year: number; month: number };

const pad = (n: number) => String(n).padStart(2, "0");
export const chaveDoMes = (m: Mes) => `${m.year}-${pad(m.month)}`;

export function mesDaData(iso: string | null | undefined): Mes | null {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { year: Number(m[1]), month };
}

export function somarMeses(m: Mes, n: number): Mes {
  const total = m.year * 12 + (m.month - 1) + n;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

const indiceDoMes = (m: Mes) => m.year * 12 + m.month;
const DIA_MS = 86_400_000;
const instante = (iso: string) => Date.parse(`${iso}T12:00:00Z`);

/**
 * Ano da compra: a fatura só traz dia/mês, e o leitor completa o ano. Compra DEPOIS do
 * vencimento não existe (a fatura fecha antes de vencer); quando aparece, é a compra de dezembro
 * numa fatura que vence em janeiro com o ano do vencimento. Volta um ano.
 */
export function ajustarAnoDaCompra(date: string, vencimento: string | null, fechamento: string | null = null): string {
  if (!vencimento || !mesDaData(date) || !mesDaData(vencimento)) return date;
  // Com o fechamento impresso, compra depois dele (com 3 dias de folga) também não é desta fatura:
  // "Loja (12/12) 10/07" na planilha da fatura que fecha em 13/06 é de julho do ano passado.
  const limite = fechamento && mesDaData(fechamento) ? instante(fechamento) + 3 * DIA_MS : instante(vencimento) + 31 * DIA_MS;
  if (instante(date) <= limite) return date;
  const anterior = `${Number(date.slice(0, 4)) - 1}${date.slice(4)}`;
  // 29/02 sem ano bissexto: fica como estava (raríssimo, e não inventa um dia).
  return Number.isFinite(instante(anterior)) && new Date(instante(anterior)).toISOString().slice(0, 10) === anterior ? anterior : date;
}

export type DatasDaFatura = { vencimento: string | null; fechamento: string | null };

const MESES_CURTOS: Record<string, number> = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function dataValida(dia: number, mes: number, ano: number): string | null {
  if (!(mes >= 1 && mes <= 12 && dia >= 1 && ano >= 2000 && ano <= 2100)) return null;
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCMonth() !== mes - 1) return null;
  return `${ano}-${pad(mes)}-${pad(dia)}`;
}

/** dd/mm sem ano: o ano que deixa o fechamento até 45 dias antes do vencimento. */
function comAnoDoVencimento(dia: number, mes: number, vencimento: string | null): string | null {
  if (!vencimento) return null;
  const ano = Number(vencimento.slice(0, 4));
  for (const a of [ano, ano - 1]) {
    const d = dataValida(dia, mes, a);
    if (d && instante(d) <= instante(vencimento) && instante(vencimento) - instante(d) <= 45 * DIA_MS) return d;
  }
  return null;
}

/**
 * Vencimento e fechamento impressos na fatura. O vencimento é o de `detectarVencimento` (com o
 * layout do PicPay, que põe as duas datas antes dos rótulos). O fechamento só vale quando o
 * arquivo escreve a palavra (ou o "realizados até" do Santander, a emissão do Nubank, que é o
 * dia em que ela fecha), e quando cai até 45 dias antes do vencimento: data solta não vira
 * fechamento.
 */
export function lerDatasDaFatura(texto: string, nomeDoArquivo?: string | null): DatasDaFatura {
  const t = semAcento(texto);
  const picpay = t.match(/(\d{2})\/(\d{2})\/(\d{4})\s*\|\s*(\d{2})\/(\d{2})\/(\d{4})\s+Vencimento:\s*Fechamento:/i);
  const vencimento =
    detectarVencimento(texto, nomeDoArquivo) ?? (picpay ? dataValida(Number(picpay[1]), Number(picpay[2]), Number(picpay[3])) : null);

  const candidatos: (string | null)[] = [];
  if (picpay) candidatos.push(dataValida(Number(picpay[4]), Number(picpay[5]), Number(picpay[6])));
  for (const m of t.matchAll(/(?<!proxima\s)(?<!preco\s)\bfechamento(?:\s+(?:desta|da)\s+fatura)?(?:\s+em)?\s*[:\-]?\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?(?!\d)/gi)) {
    const ano = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : null;
    candidatos.push(ano ? dataValida(Number(m[1]), Number(m[2]), ano) : comAnoDoVencimento(Number(m[1]), Number(m[2]), vencimento));
  }
  // BTG: "Período de compras: 13/02 até 13/03" (no PDF) ou "Período de Compras;;13/05 até 13/06" (planilha).
  const periodo = t.match(/periodo\s+de\s+compras[\s:;]*\d{2}\/\d{2}\s+ate\s+(\d{2})\/(\d{2})(?!\/\d)/i);
  if (periodo) candidatos.push(comAnoDoVencimento(Number(periodo[1]), Number(periodo[2]), vencimento));
  const ate = t.match(/realizad[oa]s\s+at[e]\s+(\d{2})\/(\d{2})(?:\/(\d{4}))?/i);
  if (ate) candidatos.push(ate[3] ? dataValida(Number(ate[1]), Number(ate[2]), Number(ate[3])) : comAnoDoVencimento(Number(ate[1]), Number(ate[2]), vencimento));
  const nubank = t.match(/EMISSAO E ENVIO (\d{2}) (JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ) (\d{4})/i);
  // Argentina: "CIERRE ACTUAL 23-Oct-26".
  candidatos.push(cierreArgentino(texto));
  if (nubank) candidatos.push(dataValida(Number(nubank[1]), MESES_CURTOS[nubank[2].toLowerCase()], Number(nubank[3])));

  const fechamento =
    candidatos.find(
      (d): d is string =>
        d !== null && (!vencimento || (instante(d) <= instante(vencimento) && instante(vencimento) - instante(d) <= 45 * DIA_MS)),
    ) ?? null;
  return { vencimento, fechamento };
}

export type Destino = {
  mes: Mes;
  /** O dia gravado no lançamento. Compra: o dia dela. Parcela com certeza: o dia da compra
   * original no mês da parcela (a de 26/06 em 3x cai em 26/07 e 26/08; dia 31 num mês de 30 vira
   * 30), como as projetadas. Antes ia sem dia e caía em "Sem data" nas Transações; a próxima
   * fatura reconhece a parcela pelo mês e pela descrição, não pelo dia. */
  dia: string | null;
  /** compra: o mês da data; parcela: mês da compra + (k - 1); ciclo: data antiga sem parcela
   * (vai pro começo do ciclo da fatura); vencimento/hoje: linha sem data. */
  origem: "compra" | "parcela" | "ciclo" | "vencimento" | "hoje";
};

type ItemDaFatura = { date: string; installment?: { current: number; total: number; confident: boolean } | null; description?: string };

/** O que a fatura inteira diz sobre o ciclo dela, calculado uma vez por arquivo. */
export type ContextoDaFatura = {
  vencimento: string | null;
  fechamento: string | null;
  /** Primeiro dia do ciclo de compras desta fatura (aproximado quando o arquivo não diz). */
  inicioDoCiclo: string | null;
  /** Último mês em que uma compra desta fatura pode contar (o do fechamento, ou do vencimento). */
  limite: Mes | null;
};

const isoDe = (t: number) => new Date(t).toISOString().slice(0, 10);

/** O mesmo dia no mês anterior ("2026-03-31" vira "2026-02-28"). */
function umMesAntes(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  const ano = m === 1 ? a - 1 : a;
  const mes = m === 1 ? 12 : m - 1;
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${ano}-${pad(mes)}-${pad(Math.min(d, ultimo))}`;
}

/** O dia da compra (`data`, "AAAA-MM-DD") dentro de `mes`: 31 num mês de 30 dias vira 30. */
export function diaDaParcela(data: string, mes: Mes): string {
  const ultimo = new Date(Date.UTC(mes.year, mes.month, 0)).getUTCDate();
  return `${mes.year}-${pad(mes.month)}-${pad(Math.min(Number(data.slice(8, 10)), ultimo))}`;
}

export function contextoDaFatura(datas: DatasDaFatura, datasDasLinhas: string[], hoje: Date = new Date()): ContextoDaFatura {
  const { vencimento, fechamento } = datas;
  // Data no futuro é ano errado do leitor, não a compra mais recente: não puxa o ciclo pra frente.
  const amanha = hoje.getTime() + DIA_MS;
  const validas = datasDasLinhas
    .filter((d) => mesDaData(d))
    .map((d) => ajustarAnoDaCompra(d, vencimento, fechamento))
    .filter((d) => vencimento || instante(d) <= amanha);
  const maisRecente = validas.length > 0 ? validas.reduce((a, b) => (a > b ? a : b)) : null;
  // Ciclo de ~um mês até o fechamento. Sem ele, o fechamento costuma vir uma semana antes do
  // vencimento; sem nenhum dos dois, a compra mais recente do arquivo faz o papel.
  // Com o fechamento, o ciclo começa no mesmo dia do mês anterior (13/02 a 13/03): com "31 dias
  // antes" ele começava em 10/02, e a parcela 2/3 de uma compra de 12/02 ficava em fevereiro.
  const inicioDoCiclo = fechamento
    ? umMesAntes(fechamento)
    : vencimento
      ? isoDe(instante(vencimento) - 38 * DIA_MS)
      : maisRecente
        ? isoDe(instante(maisRecente) - 31 * DIA_MS)
        : null;
  return { vencimento, fechamento, inicioDoCiclo, limite: mesDaData(fechamento) ?? mesDaData(vencimento) ?? mesDaData(maisRecente) };
}

/**
 * O mês em que uma linha da fatura conta (ver o comentário do arquivo).
 *
 * Data DENTRO do ciclo: é a compra (ou a cobrança da parcela, como o Nubank escreve), conta no
 * mês dela. Data ANTES do ciclo: só está nesta fatura porque é parcela, e os bancos escrevem a
 * data da compra original; a parcela k conta no mês da compra + (k - 1). Vale também para o
 * "LOJA 11/12" sem a palavra parcela, desde que o mês calculado caia no ciclo. Data antiga que
 * não fecha como parcela vai pro começo do ciclo, nunca para um mês lá atrás.
 */
export function mesDaCompra(item: ItemDaFatura, ctx: ContextoDaFatura, hoje: Date = new Date()): Destino {
  const data = mesDaData(item.date) ? ajustarAnoDaCompra(item.date, ctx.vencimento, ctx.fechamento) : null;
  if (!data) {
    const venc = mesDaData(ctx.vencimento);
    return venc ? { mes: venc, dia: null, origem: "vencimento" } : { mes: { year: hoje.getFullYear(), month: hoje.getMonth() + 1 }, dia: null, origem: "hoje" };
  }
  const compra = mesDaData(data)!;
  const parcela = item.installment ?? (item.description !== undefined ? parseInstallment(item.description) : null);
  const antes = (dias: number) => ctx.inicioDoCiclo !== null && instante(data) < instante(ctx.inicioDoCiclo) - dias * DIA_MS;
  // Parcela: régua exata do ciclo (a data da compra original fica sempre antes dele). Compra à
  // vista: 20 dias de folga, pra compra lançada atrasada (exterior, posto) manter o dia dela.
  if (parcela?.confident ? !antes(0) : !(parcela ? antes(0) : antes(20))) {
    // Sem vencimento nem fechamento (prints da fatura aberta), o ciclo é um chute de 31 dias para
    // trás e pega a data da compra ORIGINAL de uma parcela 2 ou mais: "Loja (2/8)" de 14/09 no print
    // de 14/10 ficava em setembro, ao lado da 1/8, e não casava com a 2/8 que já estava em outubro.
    // Se o mês da parcela (compra + k - 1) ainda cabe na fatura, é ele.
    if (parcela?.confident && parcela.current >= 2 && !ctx.vencimento && !ctx.fechamento && ctx.limite) {
      const daParcela = somarMeses(compra, parcela.current - 1);
      if (indiceDoMes(daParcela) <= indiceDoMes(ctx.limite)) return { mes: daParcela, dia: diaDaParcela(data, daParcela), origem: "parcela" };
    }
    return parcela?.confident ? { mes: compra, dia: data, origem: "parcela" } : { mes: compra, dia: data, origem: "compra" };
  }
  const inicio = mesDaData(ctx.inicioDoCiclo)!;
  if (parcela) {
    let mes = somarMeses(compra, parcela.current - 1);
    if (ctx.limite && indiceDoMes(mes) > indiceDoMes(ctx.limite)) mes = ctx.limite;
    if (indiceDoMes(mes) >= indiceDoMes(inicio)) return { mes, dia: parcela.confident ? diaDaParcela(data, mes) : null, origem: "parcela" };
  }
  return { mes: inicio, dia: null, origem: "ciclo" };
}

/** Os meses em que as compras da fatura caem ("YYYY-MM", em ordem). */
export function mesesDasCompras(itens: ItemDaFatura[], ctx: ContextoDaFatura, hoje: Date = new Date()): string[] {
  return [...new Set(itens.map((i) => chaveDoMes(mesDaCompra(i, ctx, hoje).mes)))].sort();
}

const NOMES_DOS_MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "agosto e setembro"; "dezembro de 2025 e janeiro de 2026" quando cruza o ano; "julho, agosto e setembro". */
export function listaDeMeses(chaves: string[]): string {
  const meses = chaves.flatMap((c) => {
    const m = mesDaData(`${c}-01`);
    return m ? [m] : [];
  });
  if (meses.length === 0) return "";
  const cruzaAno = new Set(meses.map((m) => m.year)).size > 1;
  const nomes = meses.map((m) => (cruzaAno ? `${NOMES_DOS_MESES[m.month - 1]} de ${m.year}` : NOMES_DOS_MESES[m.month - 1]));
  return nomes.length === 1 ? nomes[0] : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

// ---------------------------------------------------------------------------------------------
// Fatura já gravada no modelo antigo (tudo no mês escolhido, sem dia)

const comparavel = (d: string | null) => installmentCanonical(d ?? "").trim().toLowerCase();

export type LancamentoAntigo = { loteId: string; year: number; month: number; valor: number; descricao: string | null };

/**
 * Esta fatura já entrou antes, no modelo antigo? Lá ela foi gravada inteira num mês, sem dia, e
 * com a data da compra a chave nova nunca bate: subir a mesma fatura de novo duplicava tudo.
 *
 * Procura um lote de fatura que tenha, num mesmo mês, a maioria das compras À VISTA desta fatura
 * (mesma descrição e valor). Parcela não conta: a parcela projetada de outra fatura também tem a
 * mesma descrição, e uma assinatura (Netflix) sozinha não faz maioria. Devolve os meses em que
 * esses lotes gravaram, pra comparar a chave antiga (mês, sem dia) só ali.
 */
export function mesesDaMesmaFaturaAntiga(itens: { valor: number; descricao: string }[], existentes: LancamentoAntigo[]): Mes[] {
  const avista = itens.filter((i) => !parseInstallment(i.descricao)?.confident && i.valor > 0);
  if (avista.length < 2) return [];
  const grupos = new Map<string, { mes: Mes; restantes: Map<string, number> }>();
  for (const e of existentes) {
    if (parseInstallment(e.descricao)?.confident) continue;
    const g = `${e.loteId}|${e.year}-${e.month}`;
    if (!grupos.has(g)) grupos.set(g, { mes: { year: e.year, month: e.month }, restantes: new Map() });
    const k = `${e.valor.toFixed(2)}|${comparavel(e.descricao)}`;
    const r = grupos.get(g)!.restantes;
    r.set(k, (r.get(k) ?? 0) + 1);
  }
  const achados = new Map<string, Mes>();
  for (const { mes, restantes } of grupos.values()) {
    const sobra = new Map(restantes);
    let batem = 0;
    for (const i of avista) {
      const k = `${i.valor.toFixed(2)}|${comparavel(i.descricao)}`;
      const n = sobra.get(k) ?? 0;
      if (n > 0) {
        batem += 1;
        sobra.set(k, n - 1);
      }
    }
    if (batem >= 2 && batem * 2 >= avista.length) achados.set(chaveDoMes(mes), mes);
  }
  return [...achados.values()];
}

// ---------------------------------------------------------------------------------------------
// Pagamento da fatura no extrato

export type LancamentoDeFatura = {
  year: number;
  month: number;
  entryDate: string | null;
  descricao: string | null;
  /** Valor da linha, quando quem chama tem (serve de teto para o mês vizinho, ver pagamentoTemFatura). */
  valor?: number;
};

/** O que mais se sabe do pagamento: o valor dele e as datas dos OUTROS pagamentos de fatura dela. */
export type ContextoDoPagamento = { valor?: number; outrasDatas?: string[] };

/** Compra com dia entre 30 e 8 dias antes do pagamento: é do ciclo que ele paga (ver pagamentoTemFatura). */
const CICLO_PAGO = { de: 30 * DIA_MS, ate: 8 * DIA_MS };

const ehAVista = (l: LancamentoDeFatura) => !parseInstallment(l.descricao)?.confident;
const noCicloPago = (pagoEm: number, entryDate: string) => {
  const antes = pagoEm - instante(entryDate);
  return antes >= CICLO_PAGO.ate && antes <= CICLO_PAGO.de;
};
/** O máximo que as compras de um ciclo explicam: 10% e R$ 10 de folga (IOF, juros, encargos). */
const tetoDoCiclo = (total: number) => total * 1.1 + 10;

/**
 * Os meses de fatura SEM dia (modelo antigo) que este pagamento paga. O mês do pagamento, o
 * vizinho na virada (até 7 dias da troca de mês) e, desde 15/10/2026, o vizinho de qualquer dia:
 * no modo antigo ela escolhia o mês ("a fatura que vence em setembro é de agosto"), e o
 * pagamento de 12/09 não achava a fatura gravada em agosto e contava como gasto (77 linhas,
 * R$ 65,6 mil em 12 contas). O vizinho de qualquer dia só vale quando nenhum outro pagamento de
 * fatura dela cai naquele mês (senão a fatura de lá já tem o pagamento dela) e, com os valores à
 * mão, quando o pagamento cabe no total daquele mês.
 */
function mesesSemDiaPagos(dataPagamento: string, lancamentos: LancamentoDeFatura[], ctx: ContextoDoPagamento = {}): Set<string> {
  const pago = mesDaData(dataPagamento);
  if (!pago) return new Set();
  const dia = Number(dataPagamento.slice(8, 10));
  const semDia = lancamentos.filter((l) => !l.entryDate);
  const comCompraAVista = new Set(semDia.filter(ehAVista).map((l) => chaveDoMes(l)));
  const naVirada = new Set([chaveDoMes(pago)]);
  if (dia <= 7) naVirada.add(chaveDoMes(somarMeses(pago, -1)));
  if (dia >= 24) naVirada.add(chaveDoMes(somarMeses(pago, 1)));
  const meses = new Set([...naVirada].filter((k) => comCompraAVista.has(k)));
  const mesesDeOutrosPagamentos = new Set(
    (ctx.outrasDatas ?? []).filter((d) => d !== dataPagamento).flatMap((d) => {
      const m = mesDaData(d);
      return m ? [chaveDoMes(m)] : [];
    }),
  );
  for (const vizinho of [somarMeses(pago, -1), somarMeses(pago, 1)].map(chaveDoMes)) {
    if (naVirada.has(vizinho) || !comCompraAVista.has(vizinho) || mesesDeOutrosPagamentos.has(vizinho)) continue;
    const doMes = semDia.filter((l) => chaveDoMes(l) === vizinho);
    if (ctx.valor !== undefined && doMes.every((l) => l.valor !== undefined)) {
      if (ctx.valor > tetoDoCiclo(doMes.reduce((s, l) => s + (l.valor ?? 0), 0))) continue;
    }
    meses.add(vizinho);
  }
  return meses;
}

/**
 * A fatura que este pagamento paga já está no app? Só compra à vista conta (a parcela projetada
 * por uma fatura antiga cai em todos os meses seguintes e não diz nada). Compra com dia (modelo
 * novo): alguma entre 30 e 8 dias antes do pagamento, que é o ciclo da fatura paga ali (a anterior
 * fechou mais de um mês antes). A última semana antes do pagamento fica de fora: a fatura fecha
 * uns 7 dias antes do vencimento, e a compra desses dias já é da fatura SEGUINTE (14/10/2026: com
 * a fatura de agosto no app, o pagamento de 08/08, que é da fatura de julho, sumia por causa das
 * compras de 1 a 8/08, e agosto ficava R$ 1.815 mais barato do que foi). Sem dia (modelo antigo,
 * tudo num mês só): ver mesesSemDiaPagos.
 *
 * Pagamento sem nenhuma fatura no app em volta continua sendo gasto: é o cartão inteiro numa linha.
 */
export function pagamentoTemFatura(dataPagamento: string, lancamentos: LancamentoDeFatura[], ctx: ContextoDoPagamento = {}): boolean {
  if (!mesDaData(dataPagamento)) return false;
  const t = instante(dataPagamento);
  if (lancamentos.some((l) => l.entryDate && ehAVista(l) && noCicloPago(t, l.entryDate))) return true;
  return mesesSemDiaPagos(dataPagamento, lancamentos, ctx).size > 0;
}

/** Pagamento do cartão no extrato, com a fatura dele já no app: só mudou de conta. */
export const NOTA_PAGAMENTO_COM_FATURA =
  "Pagamento do cartão: só mudou de conta. A fatura já está no app com as compras uma a uma, então ele fica de fora para não contar duas vezes.";
/** …e sem a fatura: entra como gasto do cartão, e a fatura pode vir depois. */
export const NOTA_PAGAMENTO_SEM_FATURA =
  "Pagamento do cartão: entra como gasto em Outros. Se você trouxer a fatura depois, eu separo compra por compra e pergunto se tiro este pagamento.";

/**
 * O que fazer com a linha de pagamento da fatura do extrato. Nunca vira pergunta: com a fatura
 * no app ela fica de fora ("só mudei de conta"); sem, entra como gasto em Outros › Cartão de
 * crédito, já classificada. Quando a fatura chega depois, a importação dela oferece tirar este
 * pagamento (findCardPaymentCandidates, pela mesma regra de descrição).
 */
export function pagamentoDoCartao(
  dataPagamento: string,
  lancamentosDeFatura: LancamentoDeFatura[],
  ctx: ContextoDoPagamento = {},
):
  | { ignorar: true; nota: string }
  | { parentCategory: "OUTROS"; customCategoryId: null; subcategory: string; autoClassified: true; nota: string } {
  return pagamentoTemFatura(dataPagamento, lancamentosDeFatura, ctx)
    ? { ignorar: true, nota: NOTA_PAGAMENTO_COM_FATURA }
    : { parentCategory: "OUTROS", customCategoryId: null, subcategory: "Cartão de crédito", autoClassified: true, nota: NOTA_PAGAMENTO_SEM_FATURA };
}

export type PagamentoNoApp = { id: string; data: string; valor: number };

/**
 * A fatura chegou DEPOIS do extrato (ou no mesmo lote, ou pelo /comecar): quais pagamentos que o
 * extrato já gravou como gasto são desta fatura e saem sozinhos, pela mesma regra que deixa o
 * pagamento de fora quando a fatura vem antes (pagamentoTemFatura). Antes só a tela de importação
 * oferecia "tirar", e o /comecar e o lote de vários arquivos perdiam a oferta: o mês contava a
 * fatura duas vezes ("R$ 4.856 saíram" com R$ 2.976 de verdade, 14/10/2026).
 *
 * Mais de um pagamento no mesmo mês sai quando as compras do ciclo explicam a soma (15/10/2026):
 * antes saía no máximo UM por mês, e o pagamento parcelado (dois Pix para a mesma fatura) ou o
 * segundo cartão com a fatura também no app ficavam como gasto. Em ordem, o de valor mais perto
 * das compras do ciclo que ele paga sai sempre; os seguintes saem enquanto a soma dos pagamentos
 * cabe no total das faturas desses ciclos (parcelas inclusive, com 10% e R$ 10 de folga). Com dois
 * cartões e só uma fatura no app, o pagamento do outro cartão estoura o teto e continua sendo
 * gasto (e a tela ainda oferece tirar, quando aparece).
 */
export function pagamentosDaFatura(pagamentos: PagamentoNoApp[], lancamentos: (LancamentoDeFatura & { valor: number })[]): Set<string> {
  const outrasDatas = pagamentos.map((p) => p.data);
  const porMes = new Map<string, { id: string; valor: number; distancia: number; ciclo: number[] }[]>();
  for (const p of pagamentos) {
    const mes = mesDaData(p.data);
    if (!mes) continue;
    const t = instante(p.data);
    const semDia = mesesSemDiaPagos(p.data, lancamentos, { valor: p.valor, outrasDatas });
    const ciclo = lancamentos.flatMap((l, i) => ((l.entryDate ? noCicloPago(t, l.entryDate) : semDia.has(chaveDoMes(l))) ? [i] : []));
    const aVista = ciclo.filter((i) => ehAVista(lancamentos[i]));
    // O mesmo critério de pagamentoTemFatura: sem compra à vista do ciclo, a fatura não está no app.
    if (aVista.length === 0) continue;
    const distancia = Math.abs(aVista.reduce((s, i) => s + lancamentos[i].valor, 0) - p.valor);
    const k = chaveDoMes(mes);
    porMes.set(k, [...(porMes.get(k) ?? []), { id: p.id, valor: p.valor, distancia, ciclo }]);
  }
  const ids = new Set<string>();
  for (const candidatos of porMes.values()) {
    candidatos.sort((a, b) => a.distancia - b.distancia);
    const linhas = new Set(candidatos.flatMap((c) => c.ciclo));
    const teto = tetoDoCiclo([...linhas].reduce((s, i) => s + lancamentos[i].valor, 0));
    let soma = 0;
    candidatos.forEach((c, n) => {
      if (n > 0 && soma + c.valor > teto) return;
      ids.add(c.id);
      soma += c.valor;
    });
  }
  return ids;
}
