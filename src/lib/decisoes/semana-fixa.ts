import { chaveCobre } from "@/lib/import/comerciante";

/**
 * O "quanto dá para gastar na semana" (regra A, aprovada pela dona em 13/10/2026). Estudo em
 * Claude/estudo-apps-financas/gasto-da-semana-analise.html.
 *
 * Antes era "o que sobra do orçamento do mês ÷ dias que faltam × dias até domingo". Três defeitos:
 * a conta fixa ainda não lançada (o aluguel do dia 10) contava como livre; o número caía todo dia
 * sem ela gastar nada (segunda R$ 525, sábado R$ 200), porque "até domingo" encolhia; e o estouro
 * aparecia só como R$ 0.
 *
 * Agora é um envelope por semana, só do dia a dia:
 * - desde o dia 1 saem inteiros o guardar do mês, as contas fixas e as parcelas, lançadas ou não;
 * - o que sobra para o dia a dia no mês é dividido pelos dias que faltam, e a semana (segunda a
 *   domingo) leva os dias dela. Semana cortada pelo começo ou fim do mês leva só os dias que caem
 *   no mês (de quinta 1 a domingo 4, quatro dias);
 * - o valor da semana é fixo: sai do que sobrava ANTES de ela começar. O que muda durante a semana
 *   é quanto já saiu dele;
 * - a sobra ou o estouro de uma semana muda a seguinte;
 * - gasto que chega depois com data de antes (a fatura importada na quarta com compras do dia 2)
 *   não derruba a semana de agora: entra na conta da próxima.
 *
 * Puro, sem banco e sem React.
 */

/** Um gasto do dia a dia do mês (sem as contas fixas e as parcelas). */
export type GastoDoDiaADia = {
  valor: number;
  /** Dia do mês em que o gasto aconteceu (1 a 31). Nulo: a linha não diz (fatura sem dia). */
  dia: number | null;
  /** Dia do mês em que entrou no app (1 a 31). 0 = entrou antes do mês começar. */
  entrouNoDia: number;
  /** Veio de extrato, fatura ou Open Finance. Importado sem dia não diz quando foi. */
  importado: boolean;
};

export type EntradaDaSemana = {
  /** Hoje: dia do mês (1 a 31). */
  dia: number;
  diasNoMes: number;
  /** Dias de hoje até domingo, contando hoje (segunda = 7, domingo = 1). */
  diasAteDomingo: number;
  /** Soma do orçamento planejado do mês, todas as categorias. */
  orcamento: number;
  /** Contas fixas e parcelas do mês, reservadas inteiras (ver contasDoMes). */
  contas: number;
  /** O que ela planejou guardar no mês. Null: não planejou. */
  guardar: number | null;
  /** A renda que vale para o mês (a planejada, ou só o que entrou). Null: sem renda, vale o orçamento. */
  renda: number | null;
  gastos: GastoDoDiaADia[];
  /**
   * Ela já tinha algum lançamento no app antes desta semana começar? Só então a semana já foi
   * "prometida" e o que chega depois com data de antes vai para a próxima. Conta nova (ou quem lançou
   * tudo pela primeira vez agora) não tinha número nenhum para manter: tudo conta como de antes.
   * Omitido = sim.
   */
  jaTinhaLancamento?: boolean;
  /**
   * Quem fecha por mês e ainda não lançou nada: o app não sabe o que já saiu e supõe o ritmo do
   * plano. Sem isso, o dia 20 sem lançamento mostrava o mês inteiro como livre.
   */
  estimativa?: boolean;
};

export type SemanaFixa = {
  /** Orçamento do mês para o dia a dia: o que sobra depois do guardar e das contas. */
  paraDiaADia: number;
  /** O orçamento passava da renda menos guardar e contas: o número corta no limite da renda. */
  cortadoPelaRenda: boolean;
  /** Renda que ficou sem destino no orçamento (renda − guardar − contas − dia a dia). */
  semDestino: number;
  /** Dia a dia que já tinha saído antes desta semana começar. */
  gastoAntes: number;
  /** Chegou nesta semana com data de antes (fatura importada): conta na próxima semana. */
  chegouDepois: number;
  /** Sobra do dia a dia no começo da semana: é ela que a semana divide. */
  sobraNoInicio: number;
  /** Primeiro e último dia da semana dentro do mês. */
  inicio: number;
  fim: number;
  /** A semana vai até domingo (false: o mês acaba antes, e o "por dia" é até o último dia). */
  acabaNoDomingo: boolean;
  /** Quantos dias a semana tem neste mês (7, ou menos no começo e no fim do mês). */
  diasNaSemana: number;
  /** Dias do começo da semana até o fim do mês: é por eles que a sobra se divide. */
  diasAteOFimDoMes: number;
  /** O valor da semana, fixo de segunda a domingo. */
  valor: number;
  /** Quanto do dia a dia já saiu nesta semana. */
  gasto: number;
  /** valor − gasto. Negativo quando passou. */
  restante: number;
  /** Quanto passou da semana (0 quando não passou). */
  passou: number;
  /** Dias de hoje até o fim da semana, contando hoje. */
  diasAteOFim: number;
  /** O restante por dia até o fim da semana (0 quando passou). */
  porDia: number;
  /** O que sobra do dia a dia no mês, com tudo que já saiu. Negativo quando passou do mês. */
  sobraDoMes: number;
  /** O valor da próxima semana, se ela ainda é deste mês. Null: a próxima já é no mês que vem. */
  proxima: number | null;
};

/**
 * A semana (de segunda a domingo) recortada pelo mês: na quinta, dia 1, a semana deste mês vai do
 * dia 1 ao domingo 4. Na terça 29 de um mês de 30, vai da segunda 28 ao dia 30.
 */
export function semanaNoMes(dia: number, diasNoMes: number, diasAteDomingo: number): { inicio: number; fim: number } {
  const ateDomingo = Math.min(7, Math.max(1, diasAteDomingo));
  const indice = 7 - ateDomingo; // segunda = 0
  return { inicio: Math.max(1, dia - indice), fim: Math.min(diasNoMes, dia + ateDomingo - 1) };
}

/** Quando o gasto aconteceu para a conta da semana: antes dela, nela, ou chegou depois com data de antes. */
function quando(g: GastoDoDiaADia, inicio: number, fim: number, adiar: boolean): "antes" | "semana" | "depois" {
  const depois = adiar ? "depois" : "antes";
  if (g.dia === null && g.importado) return g.entrouNoDia < inicio ? "antes" : depois;
  const dia = g.dia ?? g.entrouNoDia;
  // Com data depois desta semana (o show do dia 28 lançado hoje): já é do mês, mas não desta
  // semana. Sai da sobra do mês e da próxima semana, nunca vira "Passou da semana" (e o valor
  // desta semana continua o mesmo, regra A).
  if (dia > fim) return "depois";
  if (dia >= inicio) return "semana";
  return g.entrouNoDia < inicio ? "antes" : depois;
}

export function semanaFixa(e: EntradaDaSemana): SemanaFixa {
  const { inicio, fim } = semanaNoMes(e.dia, e.diasNoMes, e.diasAteDomingo);
  const contas = Math.max(0, e.contas);
  const doOrcamento = Math.max(0, e.orcamento - contas);
  let paraDiaADia = doOrcamento;
  let cortadoPelaRenda = false;
  let semDestino = 0;
  if (e.renda !== null) {
    const limite = e.renda - Math.max(0, e.guardar ?? 0) - contas;
    // Centavos não contam: orçamento de R$ 2.550 numa renda que deixa R$ 2.549,60 não é "cortado".
    if (limite < doOrcamento - 1) {
      paraDiaADia = Math.max(0, limite);
      cortadoPelaRenda = true;
    } else semDestino = Math.max(0, limite - doOrcamento);
  }

  let gastoAntes = 0;
  let gasto = 0;
  let chegouDepois = 0;
  if (e.estimativa) {
    gastoAntes = (paraDiaADia * (inicio - 1)) / e.diasNoMes;
  } else {
    for (const g of e.gastos) {
      if (!(g.valor > 0) && !(g.valor < 0)) continue;
      const q = quando(g, inicio, fim, e.jaTinhaLancamento ?? true);
      if (q === "antes") gastoAntes += g.valor;
      else if (q === "semana") gasto += g.valor;
      else chegouDepois += g.valor;
    }
  }

  const diasNaSemana = fim - inicio + 1;
  const diasAteOFimDoMes = e.diasNoMes - inicio + 1;
  const sobraNoInicio = paraDiaADia - gastoAntes;
  const valor = (Math.max(0, sobraNoInicio) * diasNaSemana) / diasAteOFimDoMes;
  const restante = valor - gasto;
  const diasAteOFim = fim - e.dia + 1;
  const sobraDoMes = e.estimativa ? (paraDiaADia * (e.diasNoMes - e.dia + 1)) / e.diasNoMes : sobraNoInicio - gasto - chegouDepois;
  const diasDepois = e.diasNoMes - fim;
  const sobraDaProxima = e.estimativa ? (paraDiaADia * diasDepois) / e.diasNoMes : sobraDoMes;
  const proxima = diasDepois > 0 ? (Math.max(0, sobraDaProxima) * Math.min(7, diasDepois)) / diasDepois : null;

  return {
    paraDiaADia,
    cortadoPelaRenda,
    semDestino,
    gastoAntes,
    chegouDepois,
    sobraNoInicio,
    inicio,
    fim,
    acabaNoDomingo: fim === e.dia + Math.min(7, Math.max(1, e.diasAteDomingo)) - 1,
    diasNaSemana,
    diasAteOFimDoMes,
    valor,
    gasto,
    restante,
    passou: Math.max(0, -restante),
    diasAteOFim,
    porDia: Math.max(0, restante) / Math.max(1, diasAteOFim),
    sobraDoMes,
    proxima,
  };
}

/** Contas fixas: pagas de uma vez no começo do mês, não "correm". Saem inteiras do dia a dia. */
export const CATEGORIAS_FIXAS: ReadonlySet<string> = new Set(["MORADIA", "EDUCACAO", "IMPOSTOS"]);

/** Uma conta a pagar do mês que ainda não foi paga nem apareceu nos lançamentos. */
export type ContaPendente = { valor: number; /** Categoria-mãe da conta; null quando ela não disse. */ categoria: string | null };

export type ContasDoMes = {
  total: number;
  /** Moradia, Educação, Impostos: o planejado inteiro, ou o gasto se passou. */
  fixas: number;
  /** Contas já lançadas fora dessas categorias: recorrentes, parcelas, conta paga que bateu com a lista. */
  lancadas: number;
  /** Contas a pagar ainda não lançadas, além do que o planejado das fixas já reserva. */
  pendentes: number;
  /** Quanto as contas a pagar ainda não lançadas somam (o que ainda vai sair, já separado). */
  aPagar: number;
};

/**
 * As contas do mês, reservadas inteiras desde o dia 1, sem contar a mesma duas vezes:
 * - categoria fixa (moradia, escola, impostos): o planejado inteiro, lançado ou não; passou do
 *   planejado, vale o gasto;
 * - fora delas: o que já foi lançado como conta (repetição, parcela, conta da lista paga);
 * - conta a pagar ainda não lançada: reservada. Sem categoria, ou numa categoria fixa, ela cabe
 *   primeiro no que o planejado das fixas ainda não usou (o "Aluguel" da lista é o mesmo
 *   aluguel do planejado de Moradia).
 */
export function contasDoMes(
  categorias: { key: string; planejado: number; gasto: number; fixa?: boolean }[],
  lancadas: number,
  pendentes: ContaPendente[],
  ehFixa: (categoria: string) => boolean,
): ContasDoMes {
  let fixas = 0;
  let folga = 0;
  for (const c of categorias) {
    if (!c.fixa) continue;
    fixas += Math.max(c.planejado, c.gasto);
    folga += Math.max(0, c.planejado - c.gasto);
  }
  let nasFixas = 0;
  let outras = 0;
  for (const p of pendentes) {
    if (!(p.valor > 0)) continue;
    if (p.categoria === null || ehFixa(p.categoria)) nasFixas += p.valor;
    else outras += p.valor;
  }
  const reservadas = Math.max(0, nasFixas - folga) + outras;
  const l = Math.max(0, lancadas);
  return { total: fixas + l + reservadas, fixas, lancadas: l, pendentes: reservadas, aPagar: nasFixas + outras };
}

const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * O lançamento é o pagamento desta conta da lista? Pelo comerciante aprendido (a assinatura que ela
 * escolheu dos lançamentos: "PG *MANYCHAT" é o ManyChat dela), pelo nome (o "Vivo" da lista dentro de "PAG
 * VIVO FIXO") ou, na mesma categoria, pelo valor (até 5% de diferença). É o que impede a conta de
 * contar duas vezes: reservada enquanto não aparece, e depois no lançamento.
 */
export function lancamentoDaConta(
  g: { descricao: string | null; subcategoria: string | null; valor: number; categoria: string | null; /** Quem cobrou, na chave do motor. */ comerciante?: string | null },
  conta: { nome: string; valor: number | null; categoria: string | null; /** O comerciante aprendido (assinatura escolhida dos lançamentos). */ comerciante?: string | null },
): boolean {
  if (conta.comerciante && g.comerciante && chaveCobre(conta.comerciante, g.comerciante)) return true;
  const nome = normalizar(conta.nome);
  const texto = normalizar(`${g.descricao ?? ""} ${g.subcategoria ?? ""}`);
  if (nome.length >= 3 && texto.length > 0 && ` ${texto} `.includes(` ${nome} `)) return true;
  if (conta.valor !== null && conta.valor > 0 && conta.categoria !== null && conta.categoria === g.categoria) {
    return Math.abs(g.valor - conta.valor) <= Math.max(1, conta.valor * 0.05);
  }
  return false;
}
