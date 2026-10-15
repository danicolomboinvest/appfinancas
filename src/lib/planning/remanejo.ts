import { nowInBrazil } from "@/lib/date/brazil-now";

/**
 * De onde tirar quando uma categoria passa do plano (regra 3.1, rodadas 38 e 53, decisão da
 * dona em 10/10/2026). Uma regra só para o Orçamento, o Resumo e, depois, o Decidir e o Casal.
 *
 * 1. Primeiro o que é desejo: Lazer, Outros (e Compras, Restaurantes, Assinaturas, Beleza,
 *    Viagens e Presentes quando existirem) e toda categoria criada pela pessoa que NÃO esteja
 *    marcada "É essencial".
 * 2. Só se o desejo não cobrir: o dia a dia (Transporte e Alimentação), com a etiqueta
 *    "é do dia a dia". Nesse caso o botão principal vira "Usar o livre do mês".
 * 3. Nunca: Moradia, Saúde, Educação e Impostos (a mesma lista FORA do Raio-X).
 *
 * Dentro do nível, a de maior folga primeiro, cada uma inteira até fechar o valor. O desejo é
 * usado TODO antes de encostar no dia a dia (15/10/2026: a sugestão zerou Alimentação no dia 14
 * em vez de usar Outros primeiro). E o dia a dia nunca é zerado no meio do mês: dele só sai o que
 * passa do que ela ainda vai gastar no ritmo até o fim do mês (`reservaDoRitmo`). O total do plano
 * do mês não muda: o que sai de umas é o que entra na outra.
 *
 * Puro, sem banco: a tela manda as categorias do mês e recebe a sugestão.
 */
export const NUNCA_SUGERIR = new Set(["MORADIA", "SAUDE", "EDUCACAO", "IMPOSTOS"]);
export const DO_DIA_A_DIA = new Set(["TRANSPORTE", "ALIMENTACAO"]);
const MAES = new Set(["MORADIA", "ALIMENTACAO", "TRANSPORTE", "SAUDE", "LAZER", "EDUCACAO", "OUTROS", "IMPOSTOS"]);

export type CategoriaParaRemanejo = {
  key: string;
  label: string;
  planejado: number;
  gasto: number;
  /** Só para categoria criada pela pessoa: marcada "É essencial" nunca é origem. */
  essencial?: boolean;
};

export type Nivel = 1 | 2;

/** 1 = desejo, 2 = dia a dia, null = nunca sugerir. */
export function nivelDaCategoria(c: Pick<CategoriaParaRemanejo, "key" | "essencial">): Nivel | null {
  if (MAES.has(c.key)) {
    if (NUNCA_SUGERIR.has(c.key)) return null;
    return DO_DIA_A_DIA.has(c.key) ? 2 : 1;
  }
  return c.essencial ? null : 1;
}

/** O que ainda está livre no plano da categoria neste mês (nunca negativo). */
export function folgaDe(c: Pick<CategoriaParaRemanejo, "planejado" | "gasto">): number {
  return Math.max(0, Math.floor(c.planejado - c.gasto));
}

/** Quanto passou do plano, arredondado para cima (R$ 66,40 vira R$ 67). */
export function quantoPassou(c: Pick<CategoriaParaRemanejo, "planejado" | "gasto">): number {
  return Math.max(0, Math.ceil(c.gasto - c.planejado - 1e-9));
}

export type Origem = { key: string; label: string; valor: number; folga: number; sobraDepois: number };

export type PlanoDeCobrir = {
  valor: number;
  /** De qual nível saiu a sugestão; null = nada cobre (só "Usar o livre" e "Deixar assim"). */
  nivel: Nivel | null;
  origens: Origem[];
  /** Botão principal: tirar das categorias (nível 1) ou usar o livre do mês (nível 2 ou nada). */
  principal: "tirar" | "livre";
};

/** O mês do ponto de vista do remanejo: quantos dias faltam (com hoje) e quantos tem. */
export type TempoDoMes = { diasRestantes: number; diasNoMes: number };

/** O tempo de hoje, no calendário do Brasil (quem não manda o tempo cai aqui). */
export function tempoDeHoje(hoje: Date = nowInBrazil()): TempoDoMes {
  const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  return { diasRestantes: Math.max(1, diasNoMes - hoje.getDate() + 1), diasNoMes };
}

/** O tempo a partir dos dias que faltam (com hoje); sem o tamanho do mês, o do mês de hoje. */
export function tempoDoMes(diasRestantes: number, diasNoMes: number = tempoDeHoje().diasNoMes): TempoDoMes {
  return { diasRestantes, diasNoMes };
}

/**
 * O que a categoria do dia a dia ainda vai gastar até o fim do mês, no ritmo dela: o gasto por
 * dia até aqui (sem gasto ainda, o plano por dia) vezes os dias que faltam. Isso fica na
 * categoria; o remanejo só tira o que sobra além disso.
 */
export function reservaDoRitmo(c: Pick<CategoriaParaRemanejo, "planejado" | "gasto">, tempo: TempoDoMes): number {
  const diasNoMes = Math.max(1, tempo.diasNoMes);
  const restantes = Math.max(0, Math.min(diasNoMes, tempo.diasRestantes));
  const decorridos = Math.max(1, diasNoMes - restantes + 1);
  const porDia = c.gasto > 0 ? c.gasto / decorridos : Math.max(0, c.planejado) / diasNoMes;
  return Math.ceil(porDia * restantes);
}

/** Quanto dá para tirar da categoria: do desejo, a folga toda; do dia a dia, o que passa da reserva do ritmo. */
export function quantoDaParaTirar(c: CategoriaParaRemanejo, nivel: Nivel, tempo: TempoDoMes): number {
  const folga = folgaDe(c);
  return nivel === 1 ? folga : Math.max(0, folga - reservaDoRitmo(c, tempo));
}

/** Pega de cada uma (a de mais para tirar primeiro), inteira, até fechar o valor. */
function juntar(lista: { c: CategoriaParaRemanejo; pode: number }[], valor: number): { origens: Origem[]; falta: number } {
  const ordem = lista.filter((x) => x.pode > 0).sort((a, b) => b.pode - a.pode || a.c.label.localeCompare(b.c.label));
  const origens: Origem[] = [];
  let falta = valor;
  for (const { c, pode } of ordem) {
    if (falta <= 0) break;
    const tira = Math.min(pode, falta);
    const folga = folgaDe(c);
    origens.push({ key: c.key, label: c.label, valor: tira, folga, sobraDepois: folga - tira });
    falta -= tira;
  }
  return { origens, falta };
}

/**
 * De onde sai o que passou. Desejo primeiro, todo ele; o dia a dia só completa o que o desejo não
 * cobriu, e só com o que passa do ritmo dela; essencial nunca. Sem `tempo`, vale o dia de hoje.
 */
export function planoDeCobrir(passou: CategoriaParaRemanejo, categorias: CategoriaParaRemanejo[], tempo: TempoDoMes = tempoDeHoje()): PlanoDeCobrir {
  const valor = quantoPassou(passou);
  const outras = categorias.filter((c) => c.key !== passou.key && c.planejado > 0);
  if (valor <= 0) return { valor: 0, nivel: null, origens: [], principal: "livre" };
  const doNivel = (n: Nivel) => outras.filter((c) => nivelDaCategoria(c) === n).map((c) => ({ c, pode: quantoDaParaTirar(c, n, tempo) }));
  const desejo = juntar(doNivel(1), valor);
  if (desejo.falta <= 0) return { valor, nivel: 1, origens: desejo.origens, principal: "tirar" };
  const diaADia = juntar(doNivel(2), desejo.falta);
  if (diaADia.falta <= 0) return { valor, nivel: 2, origens: [...desejo.origens, ...diaADia.origens], principal: "livre" };
  return { valor, nivel: null, origens: [], principal: "livre" };
}

/**
 * "Usar o livre do mês": o que passou sai do livre que sobra; o novo por dia divide o resto
 * pelos dias que faltam (com hoje). Ana: livre R$ 3.241 − 67 = R$ 3.174 em 25 dias = R$ 127.
 */
export function porDiaComOLivre(livre: number, valor: number, diasRestantes: number): number {
  return Math.max(0, livre - valor) / Math.max(1, diasRestantes);
}

/**
 * "Rever o plano" só aparece quando a categoria passou de 110% do plano em 3 meses seguidos
 * (os 3 últimos fechados). A sugestão é a mediana do gasto nesses meses; nunca salva sozinha.
 */
export function revisaoDoPlano(fechados: { gasto: number; planejado: number }[]): { mediana: number } | null {
  const ultimos = fechados.slice(-3);
  if (ultimos.length < 3) return null;
  if (!ultimos.every((m) => m.planejado > 0 && m.gasto > m.planejado * 1.1)) return null;
  const ordenados = ultimos.map((m) => m.gasto).sort((a, b) => a - b);
  return { mediana: Math.ceil(ordenados[1] / 10) * 10 };
}

/**
 * "Cobrir com outra categoria" (protótipo, folha "O que fazer?"): até 4 categorias de DESEJO que
 * cobrem sozinhas o que passou, a de mais folga primeiro. O dia a dia não entra aqui: ele só
 * completa o que o desejo não cobre, e isso é o plano juntando (planoDeCobrir). Antes, quando
 * Outros não cobria sozinha, a única opção era Alimentação inteira, e ela zerava no dia 14.
 * Vazio quando nenhuma de desejo cobre sozinha.
 */
export function fontesParaCobrir(passou: CategoriaParaRemanejo, categorias: CategoriaParaRemanejo[]): (Origem & { nivel: Nivel })[] {
  const valor = quantoPassou(passou);
  if (valor <= 0) return [];
  return categorias
    .filter((c) => c.key !== passou.key && c.planejado > 0 && nivelDaCategoria(c) === 1)
    .map((c) => ({ c, folga: folgaDe(c) }))
    .filter((x) => x.folga >= valor)
    .sort((a, b) => b.folga - a.folga || a.c.label.localeCompare(b.c.label))
    .slice(0, 4)
    .map((x) => ({ key: x.c.key, label: x.c.label, valor, folga: x.folga, sobraDepois: x.folga - valor, nivel: 1 as Nivel }));
}
