/**
 * O Resumo novo (proposta resumo-referencias-proposta.html, 14/10/2026): as regras puras.
 *
 * - Qual número aparece no topo, caso a caso (dia a dia, mês fechado, primeira vez com extrato,
 *   com fatura, com um gasto digitado, ou nada ainda).
 * - A comparação com o mês passado ATÉ O MESMO DIA, pelo dia do último lançamento (a data do
 *   extrato), nunca pelo mês inteiro.
 * - As categorias que mais mudaram.
 * - A fila de sugestões: uma por vez (a regra de dispensa mora em lib/avisos).
 *
 * Nada aqui fala com o banco: o carregador (dados.ts) monta a entrada e a tela só desenha.
 */

export type Mes = { ano: number; mes: number };

/** Um gasto, do jeito que a comparação precisa: o valor, o dia do mês (null = sem dia) e a categoria. */
export type GastoDoDia = { valor: number; dia: number | null; categoria: string };

export const diasNoMes = (m: Mes) => new Date(m.ano, m.mes, 0).getDate();
export const mesAnterior = (m: Mes): Mes => (m.mes === 1 ? { ano: m.ano - 1, mes: 12 } : { ano: m.ano, mes: m.mes - 1 });

/* ---------------------------------------------------------------- até o mesmo dia */

/**
 * O dia até onde o mês de agora tem dado: o dia do gasto mais recente que não é do futuro. Sem
 * nenhum gasto com dia, vale hoje. É o "Outubro até dia 13" do topo: quem mandou o extrato no dia
 * 12 compara com 12/09, e o número nunca fica "errado" por falta de atualização, só antigo.
 */
export function diaDeCorte(gastos: Pick<GastoDoDia, "dia">[], hoje: number): number {
  const dias = gastos.map((g) => g.dia).filter((d): d is number => d !== null && d >= 1 && d <= hoje);
  return dias.length > 0 ? Math.max(...dias) : hoje;
}

/**
 * Soma o que saiu até o dia `corte`. Gasto sem dia (conta fixa lançada para o mês, fatura sem dia
 * por compra) conta desde o dia 1, nos dois meses do mesmo jeito.
 */
export function somaAteODia(gastos: Pick<GastoDoDia, "valor" | "dia">[], corte: number): number {
  return centavos(gastos.reduce((s, g) => ((g.dia ?? 1) <= corte ? s + g.valor : s), 0));
}

export type Comparacao = {
  /** O dia do mês de agora até onde vai a conta. */
  corte: number;
  /** O mesmo dia no mês passado (setembro não tem dia 31: vira 30). */
  cortePassado: number;
  atual: number;
  passado: number;
  /** atual − passado: positivo = saiu mais que no mês passado até o mesmo dia. */
  diferenca: number;
};

export function compararAteOMesmoDia(atual: GastoDoDia[], passado: GastoDoDia[], corte: number, mesPassado: Mes): Comparacao {
  const cortePassado = Math.min(corte, diasNoMes(mesPassado));
  const a = somaAteODia(atual, corte);
  const p = somaAteODia(passado, cortePassado);
  return { corte, cortePassado, atual: a, passado: p, diferenca: centavos(a - p) };
}

/** O gasto acumulado dia a dia (índice 0 = dia 1), até o dia `ate`. Para a curva do topo. */
export function curvaAcumulada(gastos: Pick<GastoDoDia, "valor" | "dia">[], ate: number): number[] {
  const porDia = Array.from({ length: ate }, () => 0);
  for (const g of gastos) {
    const d = g.dia ?? 1;
    if (d >= 1 && d <= ate) porDia[d - 1] += g.valor;
  }
  let soma = 0;
  return porDia.map((v) => (soma = centavos(soma + v)));
}

/* ---------------------------------------------------------------- categorias */

export type CategoriaQueMudou = { categoria: string; atual: number; passado: number; diferenca: number; compras: number };

/**
 * As N categorias que mais mudaram em reais, contra o mês passado no mesmo dia. Moradia e as
 * contas fixas ficam de fora quando estão iguais (não há o que olhar). Empate: a maior primeiro.
 */
export function categoriasQueMudaram(
  atual: GastoDoDia[],
  passado: GastoDoDia[],
  corte: number,
  cortePassado: number,
  fixas: ReadonlySet<string>,
  n = 4,
): CategoriaQueMudou[] {
  const mapa = new Map<string, CategoriaQueMudou>();
  const linha = (c: string) => mapa.get(c) ?? mapa.set(c, { categoria: c, atual: 0, passado: 0, diferenca: 0, compras: 0 }).get(c)!;
  for (const g of atual) {
    if ((g.dia ?? 1) > corte) continue;
    const l = linha(g.categoria);
    l.atual += g.valor;
    // Estorno (valor negativo) não é compra: "3 compras" com uma devolução eram 2.
    if (g.valor > 0) l.compras += 1;
  }
  for (const g of passado) {
    if ((g.dia ?? 1) > cortePassado) continue;
    linha(g.categoria).passado += g.valor;
  }
  return [...mapa.values()]
    .map((l) => ({ ...l, atual: centavos(l.atual), passado: centavos(l.passado), diferenca: centavos(l.atual - l.passado) }))
    .filter((l) => l.atual >= 1 || l.passado >= 1)
    .filter((l) => !(fixas.has(l.categoria) && Math.abs(l.diferenca) < 1))
    .sort((a, b) => Math.abs(b.diferenca) - Math.abs(a.diferenca) || b.atual - a.atual)
    .slice(0, n);
}

/** "R$ 180 a mais", "R$ 120 a menos" ou "igual" (menos de R$ 1 de diferença). */
export function direcao(diferenca: number): "mais" | "menos" | "igual" {
  if (Math.abs(diferenca) < 1) return "igual";
  return diferenca > 0 ? "mais" : "menos";
}

/* ---------------------------------------------------------------- qual topo */

/** O que um mês tem: soma dos gastos e das entradas, e de onde veio o dado. */
export type SinalDoMes = { gastos: number; entradas: number; extrato: boolean; fatura: boolean; digitados: number };

export type CasoDoTopo =
  /** Dois meses ou mais e gasto no mês de agora: "Outubro até dia 13, R$ X saiu". */
  | "dia-a-dia"
  /** Dias 1 a 7 (ou mês de agora ainda vazio): "Em setembro, ficou com você R$ X". */
  | "mes-fechado"
  /** Primeira vez, extrato da conta: "Em setembro, ficou com você R$ X". */
  | "extrato"
  /** Primeira vez, extrato e fatura do mesmo mês: o mesmo número, com o cartão aberto. */
  | "extrato-fatura"
  /** Primeira vez, só a fatura: "Seu cartão em setembro: R$ X". */
  | "fatura"
  /** Só gastos digitados no mês de agora: "Outubro até agora: R$ 45". */
  | "digitou"
  /** Nada ainda: "R$ ?". */
  | "nada";

export type EntradaDoTopo = {
  /** Dia de hoje no calendário do Brasil. */
  dia: number;
  atual: SinalDoMes;
  passado: SinalDoMes;
  /** Quantos dos últimos 12 meses (com o de agora) têm algum lançamento. */
  mesesComDado: number;
  /** O mês com arquivo (extrato ou fatura) mais recente, e o que chegou nele. Null: nenhum arquivo. */
  ultimoArquivo: { mes: Mes; extrato: boolean; fatura: boolean } | null;
};

const vazio = (m: SinalDoMes) => m.gastos === 0 && m.entradas === 0 && m.digitados === 0 && !m.extrato && !m.fatura;

/**
 * Qual número vai no topo. Com dois meses ou mais é o dia a dia (ou, nos dias 1 a 7, o mês que
 * fechou). Antes disso é a primeira vez, e o número é o que o arquivo dela consegue dizer com
 * certeza: extrato tem entrada e saída (dá para dizer o que ficou), fatura só diz para onde foi,
 * um gasto digitado é só ele. Nunca um número inventado.
 */
export function escolherCaso(e: EntradaDoTopo): CasoDoTopo {
  if (e.mesesComDado >= 2 && !vazio(e.passado)) {
    // Só dá para dizer "ficou com você" de um mês com entrada. Mês só com a fatura (entrou 0)
    // virava "Em setembro, saiu a mais do que entrou R$ 2.140", que não é verdade.
    const passadoFechavel = e.passado.entradas > 0;
    if (e.dia <= 7 && passadoFechavel) return "mes-fechado";
    if (e.atual.gastos > 0) return "dia-a-dia";
    if (passadoFechavel) return "mes-fechado";
  }
  if (e.mesesComDado >= 2 && e.atual.gastos > 0) return "dia-a-dia";
  if (e.ultimoArquivo) {
    if (e.ultimoArquivo.extrato && e.ultimoArquivo.fatura) return "extrato-fatura";
    if (e.ultimoArquivo.extrato) return "extrato";
    return "fatura";
  }
  if (e.atual.digitados > 0 || e.atual.gastos > 0) return "digitou";
  return "nada";
}

/** "11%" do que entrou ficou com ela. Null sem entrada (não há porcentagem de zero). */
export function porcentagemQueFicou(entrou: number, ficou: number): number | null {
  if (entrou <= 0) return null;
  // Com resgate (guardado negativo) o que ficou passa do que entrou: "133% do que entrou" não diz nada.
  if (ficou > entrou) return null;
  return Math.round((ficou / entrou) * 100);
}

/* ---------------------------------------------------------------- sugestões */

/*
 * A fila de sugestões, a dispensa ("Agora não"), a pausa do tipo e o "já respondido" moram no
 * módulo único de avisos (lib/avisos): nenhuma tela guarda regra própria. Daqui só se reexporta,
 * para quem já importava deste arquivo.
 */
export {
  TIPOS_DE_SUGESTAO,
  PAUSA_DO_TIPO_DIAS,
  tipoPausadoAte,
  escondida,
  escolherSugestao,
  type TipoDeSugestao,
  type Sugestao,
  type Dispensa,
} from "@/lib/avisos/sugestoes";

/* ---------------------------------------------------------------- as regras de cada sugestão */

/** Categorias que nunca recebem sugestão de limite. */
export const SEM_LIMITE = new Set(["MORADIA", "SAUDE", "EDUCACAO"]);

/**
 * "Categoria que subiu": só com 20% ou mais e pelo menos R$ 100 a mais que o mês passado no mesmo
 * dia. Nunca em Moradia, Saúde ou Educação. A que mais subiu em reais.
 */
export function categoriaQueSubiu(mudaram: CategoriaQueMudou[]): CategoriaQueMudou | null {
  return (
    mudaram
      .filter((c) => !SEM_LIMITE.has(c.categoria) && c.diferenca >= 100 && c.passado > 0 && c.diferenca / c.passado >= 0.2)
      .sort((a, b) => b.diferenca - a.diferenca)[0] ?? null
  );
}

/** "Algo indo bem": a categoria que mais caiu (pelo menos R$ 100 e 20% abaixo do mês passado). */
export function categoriaQueCaiu(mudaram: CategoriaQueMudou[]): CategoriaQueMudou | null {
  return (
    mudaram
      .filter((c) => c.diferenca <= -100 && c.passado > 0 && -c.diferenca / c.passado >= 0.2)
      .sort((a, b) => a.diferenca - b.diferenca)[0] ?? null
  );
}

/** O limite proposto: a média dos meses fechados (até 3), arredondada para cima de R$ 50 em R$ 50. */
export function limiteProposto(meses: number[]): number | null {
  const com = meses.filter((v) => v > 0).slice(-3);
  if (com.length === 0) return null;
  const media = com.reduce((s, v) => s + v, 0) / com.length;
  return Math.max(50, Math.ceil(media / 50) * 50);
}

function centavos(n: number): number {
  return Math.round(n * 100) / 100;
}

/* ---------------------------------------------------------------- parcelas projetadas */

/** Uma parcela que a fatura lançou num mês seguinte (lib/import/total-do-lote: parcelasProjetadas). */
export type ParcelaProjetada = { ano: number; mes: number; valor: number; loteId: string };

/**
 * Quem acabou de mandar a fatura de setembro com uma compra em 3x tem a parcela 3/3 projetada em
 * outubro (14/10/2026). Para escolher o caso do topo, essa parcela não é "dado de outubro": a
 * conta nova caía no dia a dia ("Outubro até dia 10: R$ 150 saíram") em vez de "Pronto. Esse é o
 * seu cartão em setembro.". Tira as projetadas do gasto de cada mês e do lote naquele mês.
 */
export function semAsProjetadas<V extends { ano: number; mes: number; gastou: number }, L extends { year: number; month: number; importBatchId: string | null; _count: { _all: number } }>(
  valores: V[],
  porLote: L[],
  projetadas: ParcelaProjetada[],
): { valores: V[]; porLote: L[] } {
  if (projetadas.length === 0) return { valores, porLote };
  const valor = new Map<string, number>();
  const contagem = new Map<string, number>();
  for (const p of projetadas) {
    valor.set(`${p.ano}-${p.mes}`, (valor.get(`${p.ano}-${p.mes}`) ?? 0) + p.valor);
    contagem.set(`${p.ano}-${p.mes}|${p.loteId}`, (contagem.get(`${p.ano}-${p.mes}|${p.loteId}`) ?? 0) + 1);
  }
  return {
    valores: valores.map((v) => {
      const tirar = valor.get(`${v.ano}-${v.mes}`) ?? 0;
      return tirar ? { ...v, gastou: Math.round((v.gastou - tirar) * 100) / 100 } : v;
    }),
    porLote: porLote.flatMap((l) => {
      const tirar = contagem.get(`${l.year}-${l.month}|${l.importBatchId}`) ?? 0;
      const sobra = l._count._all - tirar;
      return sobra > 0 ? [tirar ? { ...l, _count: { _all: sobra } } : l] : [];
    }),
  };
}
