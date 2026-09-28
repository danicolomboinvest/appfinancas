import type { Titulos } from "@/lib/profiles/voice";

/**
 * O motor da aba Foco: dos números do mês, decide O QUE mostrar e em que ordem.
 *
 * Existe porque o app já sabia muita coisa (orçamento, metas, reserva, insights), mas cada tela
 * falava sozinha e a pessoa tinha que juntar as peças. Aqui as peças viram, no máximo, três
 * coisas que pedem atenção — mais que isso vira ansiedade, e a pessoa fecha o app.
 *
 * A ordem é fixa e igual pra todo mundo (a Dani pediu pra decidir junto): primeiro o que já
 * estourou, depois compromisso com prazo (guardar o do mês, meta atrasada), depois tendência
 * (categoria correndo rápido, reserva curta). Duas regras que não se negociam:
 * - nunca mais de 3 itens visíveis; o resto fica recolhido em "+N podem esperar";
 * - sem dado não tem conclusão: quem acompanha por mês e ainda não lançou nada no mês não
 *   recebe alerta de gasto — o app não sabe, então não chuta.
 *
 * Puro, sem banco e sem React: é a lógica que precisa de teste.
 */

export type Ritmo = "semanal" | "mensal";

export type FocoCategoria = {
  key: string;
  label: string;
  planejado: number;
  gasto: number;
  /** Conta fixa (moradia, escola, impostos): paga de uma vez no começo do mês, não "corre". */
  fixa?: boolean;
  /** Parte do gasto que já estava marcada antes do mês (recorrente automática, parcela da fatura). */
  fixoAutomatico?: number;
};
export type FocoMeta = {
  id: string;
  nome: string;
  status: "NOT_STARTED" | "ON_TRACK" | "BEHIND" | "ACHIEVED";
  /** "dezembro de 2026" — o prazo da meta, já escrito. */
  quando: string;
  /** Quanto precisaria guardar por mês pra chegar no prazo. */
  porMes: number;
  /** O prazo já passou e a meta não chegou: "guardar tudo este mês" não é conselho, é susto. */
  vencida?: boolean;
  /** O prazo cai neste mês: `porMes` é tudo que falta, e o texto não pode dizer "por mês". */
  ultimoMes?: boolean;
};

export type FocoEntrada = {
  ritmo: Ritmo;
  /** Dia de hoje (1–31) e quantos dias o mês tem. */
  dia: number;
  diasNoMes: number;
  /** Só as categorias com valor planejado no mês. */
  categorias: FocoCategoria[];
  /** Todo gasto lançado no mês, com ou sem orçamento. */
  gastoDoMes: number;
  /**
   * A pessoa lançou (ou importou) algum gasto neste mês? Despesa fixa recorrente criada lá atrás
   * não conta. Sem isso, o aluguel lançado em janeiro pra o ano todo tirava quem fecha por mês
   * da estimativa. Omitido = `gastoDoMes > 0`.
   */
  lancouGastoNoMes?: boolean;
  aportadoNoMes: number;
  /** Quanto a pessoa planejou guardar no mês (Plano do mês). null = não planejou. */
  aportePlanejado: number | null;
  /** Dias desde o último gasto com data. null = nenhum gasto com data no mês. */
  diasDesdeUltimoGasto: number | null;
  metas: FocoMeta[];
  /** Reserva de emergência: quanto tem e o custo de vida mensal que ela deve cobrir. */
  reserva: { atual: number; custoMensal: number } | null;
  /** Abaixo de quantos meses a reserva vira aviso. Pessoa: 6 (a aula). Empresa: 3 (Sebrae). */
  reservaMinimaMeses?: number;
  /** Rota da tela do mês, pra onde vão as ações de lançar. */
  hrefMes: string;
  /** Tetos que a pessoa pôs neste mês (chave da categoria → valor). Categoria com teto não vira alerta de ritmo. */
  tetos?: { categoria: string; valor: number }[];
  /** Gastos recorrentes do Raio-X que ela ainda não decidiu. */
  raiox?: { n: number; anual: number } | null;
  /** Avisos que ela já dispensou ("foi pontual", "entendi") neste mês ou nesta semana. */
  dispensados?: string[];
  money: (valor: number) => string;
  t: Titulos;
};

export type FocoLivre =
  | { tipo: "semOrcamento" }
  | {
      tipo: "semana" | "mes" | "estimativa";
      valor: number;
      porSemana: number;
      restante: number;
      planejado: number;
      gastoNoOrcamento: number;
      /** Tudo que já saiu no mês, com ou sem categoria no orçamento (o mesmo número da Visão mensal). */
      gastoTotal: number;
      diasRestantes: number;
      decorrido: number;
      /** Aviso de dado velho (último gasto há mais de 7 dias, no ritmo semanal). */
      diasSemLancar: number | null;
      /** Semanal, já passou da primeira semana e nunca lançou gasto com data: outro aviso, sem "há N dias". */
      semGastoComData: boolean;
      /** O mesmo "livre", dividido por categoria (soma = `restante`): é o que o ritual mostra. */
      porCategoria: { key: string; label: string; restante: number }[];
    };

/**
 * Os números por trás de cada aviso: é o que a janela "Ver o que fazer" mostra e usa pra oferecer
 * a ação certa ali mesmo (teto, subir o orçamento, "já transferi"), em vez de só mandar pra
 * outra tela.
 */
export type FocoDetalhe =
  | { tipo: "estouro" | "ritmo"; categoria: string; label: string; gasto: number; planejado: number; sobra: number; dias: number }
  | { tipo: "fora"; valor: number; livre: number }
  | { tipo: "aporte"; falta: number; guardado: number; planejado: number }
  | { tipo: "meta"; metaId: string; nome: string; porMes: number; quando: string; vencida: boolean; ultimoMes: boolean }
  | { tipo: "reserva"; meses: number; minimo: number }
  | { tipo: "raiox"; n: number; anual: number };

export type FocoItem = { id: string; nivel: 1 | 2 | 3; titulo: string; texto: string; href: string; acao: string; detalhe?: FocoDetalhe };
export type FocoBem = { titulo: string };
export type FocoFio = { meta: string; quando: string; guardarNoMes: number | null; guardadoNoMes: number };

export type FocoSaida = {
  livre: FocoLivre;
  atencao: FocoItem[];
  depois: FocoItem[];
  bem: FocoBem[];
  fio: FocoFio | null;
};

const MAX_ATENCAO = 3;
/** Dias sem lançar gasto a partir dos quais o número do "livre" deixa de ser confiável. */
const DIAS_DADO_VELHO = 7;
/** A régua da aula da Dani: reserva de 6 a 12 meses do custo de vida. */
const MESES_RESERVA_MINIMO = 6;
/** Diferença de centavos não é estouro: "R$ 500 de R$ 500 passou do orçamento" não ajuda ninguém. */
const FOLGA_ESTOURO = 1;

export function montarFoco(e: FocoEntrada): FocoSaida {
  const { t, money } = e;
  const diasRestantes = Math.max(1, e.diasNoMes - e.dia + 1);
  const decorrido = (e.dia - 1) / e.diasNoMes;
  const porSemanaDe = (valor: number) => (diasRestantes < 7 ? valor : (valor / diasRestantes) * 7);

  // Mensal e nada lançado no mês ainda: é o caso normal de quem fecha uma vez por mês, não um
  // problema. O número sai do planejado e é chamado de estimativa; alerta de gasto não existe.
  const semDadoDoMes = e.ritmo === "mensal" && !(e.lancouGastoNoMes ?? e.gastoDoMes > 0);

  const planejado = e.categorias.reduce((s, c) => s + c.planejado, 0);
  const gastoNoOrcamento = e.categorias.reduce((s, c) => s + c.gasto, 0);
  let livre: FocoLivre;
  if (planejado <= 0) {
    livre = { tipo: "semOrcamento" };
  } else {
    // O que sobra em cada categoria, mas nunca mais do que o mês inteiro ainda comporta: o que
    // estourou numa categoria e o que foi gasto fora do orçamento saem do mesmo bolso.
    const somaSobras = e.categorias.reduce((s, c) => s + Math.max(0, c.planejado - c.gasto), 0);
    const restante = semDadoDoMes
      ? (planejado * diasRestantes) / e.diasNoMes
      : Math.min(somaSobras, Math.max(0, planejado - Math.max(e.gastoDoMes, gastoNoOrcamento)));
    const escala = semDadoDoMes ? diasRestantes / e.diasNoMes : somaSobras > 0 ? restante / somaSobras : 0;
    const porCategoria = e.categorias.map((c) => ({
      key: c.key,
      label: c.label,
      restante: (semDadoDoMes ? c.planejado : Math.max(0, c.planejado - c.gasto)) * escala,
    }));
    const porSemana = porSemanaDe(restante);
    // Dado velho: o último gasto com data tem mais de 7 dias. Quem nunca lançou gasto com data
    // ganha outro aviso depois da primeira semana (não dá pra dizer "há N dias").
    const velho = e.ritmo === "semanal" && e.diasDesdeUltimoGasto !== null && e.diasDesdeUltimoGasto > DIAS_DADO_VELHO ? e.diasDesdeUltimoGasto : null;
    const semGastoComData = e.ritmo === "semanal" && e.diasDesdeUltimoGasto === null && e.dia > DIAS_DADO_VELHO;
    livre = {
      tipo: semDadoDoMes ? "estimativa" : e.ritmo === "semanal" ? "semana" : "mes",
      valor: e.ritmo === "semanal" && !semDadoDoMes ? porSemana : restante,
      porSemana,
      restante,
      planejado,
      gastoNoOrcamento,
      gastoTotal: Math.max(e.gastoDoMes, gastoNoOrcamento),
      diasRestantes,
      decorrido,
      diasSemLancar: velho,
      semGastoComData,
      porCategoria,
    };
  }

  const itens: FocoItem[] = [];
  const hrefOrcamento = "/orcamento";

  if (!semDadoDoMes) {
    // O maior estouro (em reais) primeiro: é ele que não pode cair no "+N podem esperar".
    const estouradas = e.categorias.filter((c) => c.planejado > 0 && c.gasto - c.planejado >= FOLGA_ESTOURO).sort((a, b) => b.gasto - b.planejado - (a.gasto - a.planejado));
    for (const c of estouradas) {
      itens.push({
        id: `estouro-${c.key}`,
        nivel: 1,
        titulo: t.focoEstouroT(c.label),
        texto: t.focoEstouroP(money(c.gasto), money(c.planejado), diasRestantes),
        href: hrefOrcamento,
        acao: t.focoAcao,
        detalhe: { tipo: "estouro", categoria: c.key, label: c.label, gasto: c.gasto, planejado: c.planejado, sobra: 0, dias: diasRestantes },
      });
    }
  }

  // Gasto fora do orçamento que come o "livre": sem esse aviso, o livre ia a zero e a tela dizia
  // "nada pedindo atenção".
  const fora = e.gastoDoMes - gastoNoOrcamento;
  if (!semDadoDoMes && planejado > 0 && fora >= FOLGA_ESTOURO && livre.tipo !== "semOrcamento") {
    const semFora = e.categorias.reduce((s, c) => s + Math.max(0, c.planejado - c.gasto), 0);
    if (livre.restante < semFora - FOLGA_ESTOURO) {
      itens.push({ id: "fora", nivel: 1, titulo: t.focoForaT(money(fora)), texto: t.focoForaP(money(livre.restante)), href: e.hrefMes, acao: t.focoAcao, detalhe: { tipo: "fora", valor: fora, livre: livre.restante } });
    }
  }

  // Quem fecha por mês e não lançou nada ainda: o aporte pode já ter saído da conta, o app só
  // não sabe. Fica pro fechamento.
  if (!semDadoDoMes && e.aportePlanejado && e.aportePlanejado - e.aportadoNoMes >= FOLGA_ESTOURO && e.dia >= 10) {
    itens.push({
      id: "aporte",
      nivel: 2,
      titulo: t.focoAporteT(money(e.aportePlanejado - e.aportadoNoMes)),
      texto: t.focoAporteP,
      href: e.hrefMes,
      acao: t.focoAcao,
      detalhe: { tipo: "aporte", falta: e.aportePlanejado - e.aportadoNoMes, guardado: e.aportadoNoMes, planejado: e.aportePlanejado },
    });
  }

  for (const m of e.metas) {
    if (m.status !== "BEHIND") continue;
    // Juros sozinhos já chegam lá: não existe "precisa de −R$ 31 por mês".
    if (!m.vencida && m.porMes < FOLGA_ESTOURO) continue;
    itens.push({
      id: `meta-${m.id}`,
      nivel: 2,
      titulo: t.focoMetaT(m.nome),
      texto: m.vencida ? t.focoMetaVencidaP : m.ultimoMes ? t.focoMetaUltimoMesP(money(m.porMes)) : t.focoMetaP(money(m.porMes)),
      href: `/planejamento/metas/${m.id}`,
      acao: t.focoAcao,
      detalhe: { tipo: "meta", metaId: m.id, nome: m.nome, porMes: m.porMes, quando: m.quando, vencida: Boolean(m.vencida), ultimoMes: Boolean(m.ultimoMes) },
    });
  }

  if (!semDadoDoMes && decorrido < 0.7) {
    for (const c of e.categorias) {
      const usado = c.planejado > 0 ? c.gasto / c.planejado : 0;
      // O ritmo é do que VARIA: o plano de saúde de R$ 800 lançado sozinho no dia 1 não faz
      // "Saúde: 80% usado" correr. Tira a parte já marcada antes do mês dos dois lados.
      const fixo = Math.min(c.fixoAutomatico ?? 0, c.gasto);
      const planoVariavel = c.planejado - fixo;
      const usadoVariavel = planoVariavel >= FOLGA_ESTOURO ? (c.gasto - fixo) / planoVariavel : 0;
      const temTeto = e.tetos?.some((x) => x.categoria === c.key);
      // Abaixo de 100%: categoria já paga inteira (o aluguel do dia 5) não é "correndo rápido".
      if (!c.fixa && usadoVariavel >= 0.7 && c.gasto < c.planejado - FOLGA_ESTOURO && !temTeto && !itens.some((i) => i.id === `estouro-${c.key}`)) {
        itens.push({
          id: `ritmo-${c.key}`,
          nivel: 3,
          // Pra baixo: "100% usado" do lado de "sobram R$ 4" é contradição.
          titulo: t.focoRitmoT(c.label, `${Math.floor(usado * 100)}%`),
          texto: t.focoRitmoP(diasRestantes, money(Math.max(0, c.planejado - c.gasto))),
          href: hrefOrcamento,
          acao: t.focoAcao,
          detalhe: { tipo: "ritmo", categoria: c.key, label: c.label, gasto: c.gasto, planejado: c.planejado, sobra: Math.max(0, c.planejado - c.gasto), dias: diasRestantes },
        });
      }
    }
  }

  if (e.reserva && e.reserva.custoMensal > 0) {
    const meses = e.reserva.atual / e.reserva.custoMensal;
    if (meses < (e.reservaMinimaMeses ?? MESES_RESERVA_MINIMO)) {
      // Arredonda pra baixo: 5,96 meses não pode virar "cobre 6 meses" do lado de "o mínimo é 6".
      const cortado = Math.floor(meses * 10) / 10;
      const texto = cortado < 1 ? "menos de 1 mês" : `${cortado.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${cortado === 1 ? "mês" : "meses"}`;
      itens.push({
        id: "reserva",
        nivel: 3,
        titulo: t.focoReservaT(texto),
        texto: t.focoReservaP,
        href: "/planejamento/reserva-emergencia",
        acao: t.focoAcao,
        detalhe: { tipo: "reserva", meses: cortado, minimo: e.reservaMinimaMeses ?? MESES_RESERVA_MINIMO },
      });
    }
  }

  if (e.raiox && e.raiox.n > 0) {
    itens.push({ id: "raiox", nivel: 3, titulo: t.focoRaioXT(e.raiox.n), texto: t.focoRaioXP(money(e.raiox.anual)), href: "/decidir/raio-x", acao: t.focoAcao, detalhe: { tipo: "raiox", n: e.raiox.n, anual: e.raiox.anual } });
  }

  // O que ela dispensou ("foi pontual", "entendi") some da lista até o mês (ou a semana) virar.
  if (e.dispensados && e.dispensados.length > 0) {
    const fora = new Set(e.dispensados);
    for (let i = itens.length - 1; i >= 0; i--) if (fora.has(itens[i].id)) itens.splice(i, 1);
  }

  // Estável: dentro do mesmo nível, fica a ordem em que foram achados (estouro maior primeiro
  // já vem da ordem das categorias; meta atrasada antes de categoria correndo).
  const ordenados = itens.map((item, i) => ({ item, i })).sort((a, b) => a.item.nivel - b.item.nivel || a.i - b.i).map((x) => x.item);

  // Categoria que já é aviso não aparece também como "indo bem".
  const comAviso = new Set(itens.map((i) => i.id.replace(/^(estouro|ritmo)-/, "")));
  const bem: FocoBem[] = [];
  for (const teto of e.tetos ?? []) {
    const c = e.categorias.find((x) => x.key === teto.categoria);
    if (c && !comAviso.has(c.key)) bem.push({ titulo: teto.valor > 0 ? t.focoBemTeto(c.label, money(teto.valor)) : t.focoSegurarBotao(c.label) });
  }
  // Com dado velho, "dentro do ritmo" pode ser só gasto que ainda não foi lançado.
  const dadoVelho = livre.tipo !== "semOrcamento" && (livre.diasSemLancar !== null || livre.semGastoComData);
  // Livre zerado (estouro ou gasto fora do orçamento) também não é hora de elogiar categoria.
  const livreZerado = livre.tipo !== "semOrcamento" && livre.restante < FOLGA_ESTOURO;
  if (!semDadoDoMes && !dadoVelho && !livreZerado) {
    const noRitmo = e.categorias.filter((c) => c.planejado > 0 && c.gasto > 0 && !comAviso.has(c.key) && c.gasto / c.planejado <= decorrido + 0.02);
    for (const c of noRitmo.slice(0, 1)) bem.push({ titulo: t.focoBemRitmo(c.label) });
  }
  for (const m of e.metas.filter((x) => x.status === "ON_TRACK").slice(0, 1)) bem.push({ titulo: t.focoBemMeta(m.nome, m.quando) });
  if (e.aportadoNoMes > 0 && (!e.aportePlanejado || e.aportadoNoMes > e.aportePlanejado - FOLGA_ESTOURO)) {
    bem.push({ titulo: t.focoBemAporte(money(e.aportadoNoMes)) });
  }

  const metaDoFio = e.metas.find((m) => m.status !== "ACHIEVED" && !m.vencida);
  const fio: FocoFio | null = metaDoFio
    ? { meta: metaDoFio.nome, quando: metaDoFio.quando, guardarNoMes: e.aportePlanejado, guardadoNoMes: e.aportadoNoMes }
    : null;

  return { livre, atencao: ordenados.slice(0, MAX_ATENCAO), depois: ordenados.slice(MAX_ATENCAO), bem: bem.slice(0, 3), fio };
}
