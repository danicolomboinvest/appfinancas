/**
 * As respostas da Central de decisões: cada pergunta vira uma resposta de verdade, com os
 * números da pessoa, e não um atalho pra tela que ela mesma preencheu.
 *
 * Formato de conversa: primeiro a resposta curta ("Não: você está dentro do plano"), depois os
 * números que sustentam, depois o que fazer. O tom (a abertura) vem do tema; o resto é número e
 * fala do número, nunca da pessoa. Sem jargão ("guardar", não "aporte").
 *
 * Puro, sem banco.
 */

export type Veredito = "bom" | "atencao" | "ruim";
export type Resposta = {
  veredito: Veredito;
  /** A resposta em uma frase. */
  frase: string;
  /** 2 a 4 frases curtas com os números que sustentam a resposta. */
  detalhes: string[];
  /** A conta, pra quem quer conferir. */
  conta: { rotulo: string; valor: string }[];
  /** Próximos passos. */
  acoes: { rotulo: string; href: string }[];
};

export type Tom = "padrao" | "girly" | "minimalista" | "disciplina" | "semfiltro" | "game" | "manifestacao";

/** A abertura de cada resposta, no jeito de cada tema (o resto é igual pra todos). */
export function abertura(tom: Tom, v: Veredito): string {
  const t: Record<Tom, Record<Veredito, string>> = {
    padrao: { bom: "", atencao: "", ruim: "" },
    minimalista: { bom: "", atencao: "", ruim: "" },
    girly: { bom: "Amiga, ", atencao: "Amiga, olha só: ", ruim: "Amiga, vamos juntas nessa: " },
    disciplina: { bom: "No plano. ", atencao: "Atenção: ", ruim: "Fora do plano. " },
    semfiltro: { bom: "Na real? ", atencao: "Na real: ", ruim: "Sem filtro: " },
    game: { bom: "Status: ", atencao: "Alerta: ", ruim: "Game over à vista: " },
    manifestacao: { bom: "Com carinho: ", atencao: "Com carinho: ", ruim: "Com carinho, e com verdade: " },
  };
  return t[tom]?.[v] ?? "";
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const primeiraMaiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export function comAbertura(tom: Tom, r: Resposta): Resposta {
  const a = abertura(tom, r.veredito);
  return { ...r, frase: a ? `${a}${r.frase.charAt(0).toLowerCase()}${r.frase.slice(1)}` : primeiraMaiuscula(r.frase) };
}

export type Categoria = {
  key: string;
  label: string;
  planejado: number;
  gasto: number;
  fixa?: boolean;
  /** Quanto do gasto já veio de lançamento recorrente criado antes do mês (o plano de saúde do dia 1). */
  fixoAutomatico?: number;
};

/**
 * Quanto do orçamento já devia ter saído a esta altura do mês. Conta fixa (aluguel, escola) é paga
 * de uma vez: o que já foi pago dela entra inteiro, e só o resto corre com os dias. O mesmo vale
 * pro recorrente que já nasce lançado no dia 1. É a regra do Foco e do "Onde estou exagerando?":
 * sem isso, o aluguel pago no dia 5 fazia o mês inteiro parecer "acima do ritmo".
 */
export function esperadoNoRitmo(planejado: number, decorrido: number, categorias: Categoria[]): { esperado: number; fixoPago: number } {
  const fixoPago = categorias
    .filter((c) => c.planejado > 0)
    .reduce((s, c) => s + Math.max(0, Math.min(c.planejado, c.gasto, c.fixa ? c.gasto : (c.fixoAutomatico ?? 0))), 0);
  const pago = Math.min(fixoPago, planejado);
  return { esperado: pago + (planejado - pago) * Math.max(decorrido, 0.03), fixoPago: pago };
}

/** "Estou gastando demais?": o gasto do mês contra o ritmo do plano e contra 90% da renda. */
export function estouGastandoDemais(e: {
  money: (v: number) => string;
  gastoDoMes: number;
  planejado: number;
  decorrido: number;
  renda: number | null;
  categorias: Categoria[];
  /**
   * Casal que só conta o que cada um põe na conta conjunta: gastar 100% dessa "renda" é o
   * combinado, então a regra dos 90% não vale. O limite passa a ser o que entra na conta.
   * Omitido = vale.
   */
  regra90?: boolean;
}): Resposta {
  const { money } = e;
  if (!(e.planejado > 0)) {
    return {
      veredito: "atencao",
      frase: `Sem orçamento eu não tenho com o que comparar. Este mês já saíram ${money(e.gastoDoMes)}.`,
      detalhes: ["Com o orçamento montado, eu te digo se está no ritmo e onde está pesando."],
      conta: [{ rotulo: "Gasto do mês até agora", valor: money(e.gastoDoMes) }],
      acoes: [{ rotulo: "Montar meu orçamento", href: "/orcamento" }],
    };
  }
  const { esperado, fixoPago } = esperadoNoRitmo(e.planejado, e.decorrido, e.categorias);
  const diferenca = e.gastoDoMes - esperado;
  const estouradas = e.categorias.filter((c) => c.planejado > 0 && c.gasto - c.planejado >= 1).sort((a, b) => b.gasto - b.planejado - (a.gasto - a.planejado));
  const pesadas = [...e.categorias].filter((c) => c.planejado > 0 && c.gasto > 0).sort((a, b) => b.gasto / b.planejado - a.gasto / a.planejado);
  const semRegra90 = e.regra90 === false;
  const limiteDaRenda = e.renda && e.renda > 0 ? e.renda * (semRegra90 ? 1 : 0.9) : null;
  const acimaDa90 = limiteDaRenda !== null ? e.gastoDoMes > limiteDaRenda : false;
  // R$ 13 acima numa categoria, com o mês inteiro abaixo do ritmo, não é "gastando demais".
  const estouroRelevante = estouradas.some((c) => c.gasto - c.planejado > Math.max(50, c.planejado * 0.05));
  const veredito: Veredito = e.gastoDoMes > e.planejado || acimaDa90 ? "ruim" : diferenca > e.planejado * 0.05 || estouroRelevante ? "atencao" : "bom";
  const frase =
    veredito === "bom"
      ? `Não. Você gastou ${money(e.gastoDoMes)} de ${money(e.planejado)}, e o mês já passou ${pct(e.decorrido)}: está ${money(Math.max(0, -diferenca))} abaixo do ritmo.`
      : veredito === "atencao"
        ? `Um pouco. Você gastou ${money(e.gastoDoMes)} de ${money(e.planejado)}, com o mês em ${pct(e.decorrido)}: ${diferenca > 0 ? `${money(diferenca)} acima do ritmo` : "no ritmo no total, mas com categoria estourada"}.`
        : `Sim. Já saíram ${money(e.gastoDoMes)}${e.gastoDoMes > e.planejado ? `, mais que o orçamento inteiro do mês (${money(e.planejado)})` : ""}.`;
  const detalhes: string[] = [];
  if (estouradas.length > 0) detalhes.push(`Passou do plano: ${estouradas.slice(0, 3).map((c) => `${c.label} (${money(c.gasto)} de ${money(c.planejado)})`).join(", ")}.`);
  else if (pesadas[0]) detalhes.push(`Onde mais pesou: ${pesadas[0].label}, ${money(pesadas[0].gasto)} de ${money(pesadas[0].planejado)}.`);
  if (limiteDaRenda !== null) {
    detalhes.push(
      semRegra90
        ? acimaDa90
          ? `Os gastos já passam do que vocês põem na conta conjunta (${money(limiteDaRenda)}).`
          : `Aqui a renda é o que vocês põem na conta conjunta (${money(limiteDaRenda)}): a regra dos 90% vale pra renda de cada um, não pra ela.`
        : acimaDa90
          ? `Os gastos já passam de 90% da renda (${money(limiteDaRenda)}): sobra menos de 10% pra guardar.`
          : `Pela regra dos 90%, seus gastos podem ir até ${money(limiteDaRenda)} este mês.`,
    );
  }
  return {
    veredito,
    frase,
    detalhes,
    conta: [
      { rotulo: "Gasto do mês até agora", valor: money(e.gastoDoMes) },
      { rotulo: "Orçamento do mês", valor: money(e.planejado) },
      ...(fixoPago >= 1 ? [{ rotulo: "Contas fixas já pagas (entram inteiras)", valor: money(fixoPago) }] : []),
      { rotulo: `No ritmo (${pct(e.decorrido)} do mês)`, valor: money(esperado) },
      ...(limiteDaRenda !== null ? [{ rotulo: semRegra90 ? "O que entra na conta conjunta" : "90% da renda", valor: money(limiteDaRenda) }] : []),
    ],
    acoes: veredito === "bom" ? [{ rotulo: "Onde estou exagerando?", href: "/decidir/pergunta/exagerando" }] : [{ rotulo: "Ver onde estou exagerando", href: "/decidir/pergunta/exagerando" }, { rotulo: "Voltar pro Foco", href: "/mensal/foco" }],
  };
}

/** "Onde estou exagerando?": as categorias mais acima do ritmo, o que está fora do orçamento e os maiores gastos. */
export function ondeEstouExagerando(e: {
  money: (v: number) => string;
  decorrido: number;
  categorias: Categoria[];
  fora: number;
  maiores: { descricao: string; valor: number; categoria: string | null }[];
  recorrentesAno: number | null;
}): Resposta {
  const { money } = e;
  const acima = e.categorias
    .filter((c) => c.planejado > 0)
    // Conta fixa (aluguel, escola) é paga de uma vez: só "exagera" se passar do plano do mês.
    .map((c) => ({ ...c, excesso: c.fixa ? c.gasto - c.planejado : c.gasto - c.planejado * Math.max(e.decorrido, 0.03) }))
    .filter((c) => c.excesso >= 1)
    .sort((a, b) => b.excesso - a.excesso);
  const veredito: Veredito = acima.length === 0 && e.fora < 1 ? "bom" : acima.some((c) => c.gasto > c.planejado) || e.fora >= 1 ? "ruim" : "atencao";
  const frase =
    acima.length === 0 && e.fora < 1
      ? "Em nenhum lugar agora: todas as categorias estão no ritmo do mês."
      : acima.length > 0
        ? `Em ${acima[0].label}: ${money(acima[0].gasto)} de ${money(acima[0].planejado)}, ${money(acima[0].excesso)} acima do ritmo do mês.`
        : `Nos gastos sem categoria no orçamento: ${money(e.fora)} este mês.`;
  const detalhes: string[] = [];
  for (const c of acima.slice(1, 3)) detalhes.push(`${c.label}: ${money(c.gasto)} de ${money(c.planejado)} (${money(c.excesso)} acima do ritmo).`);
  if (e.fora >= 1 && acima.length > 0) detalhes.push(`Mais ${money(e.fora)} em gastos sem categoria no orçamento.`);
  if (e.maiores.length > 0) detalhes.push(`Os maiores gastos do mês: ${e.maiores.slice(0, 3).map((g) => `${g.descricao} (${money(g.valor)})`).join(", ")}.`);
  if (e.recorrentesAno && e.recorrentesAno > 0) detalhes.push(`E o que se repete todo mês soma ${money(e.recorrentesAno)} por ano.`);
  return {
    veredito,
    frase,
    detalhes,
    conta: acima.slice(0, 5).map((c) => ({ rotulo: `${c.label} acima do ritmo`, valor: money(c.excesso) })),
    acoes: [
      { rotulo: "Resolver no Foco", href: "/mensal/foco" },
      ...(e.recorrentesAno ? [{ rotulo: "Ver o Raio-X do que se repete", href: "/decidir/raio-x" }] : []),
    ],
  };
}

export type MetaResposta = {
  nome: string;
  alvo: number;
  atual: number;
  /** "dezembro de 2026", ou null quando não tem data. */
  prazo: string | null;
  necessarioPorMes: number;
  /** Quanto ela tem guardado por mês pra essa meta, na média dos últimos meses (ou o combinado). */
  ritmoPorMes: number;
  /** Quando chega no ritmo atual ("março de 2027"), ou null se não chega. */
  chegaEm: string | null;
  noPrazo: boolean;
  /**
   * O mês do prazo já acabou e ela não chegou. Aí não existe "por mês pra chegar a tempo": o
   * necessário é o que ela combinou guardar, e a resposta pede uma data nova em vez de cobrar o
   * que falta inteiro como se fosse mensal.
   */
  vencida?: boolean;
};

/**
 * Quanto ela guarda por mês pra uma meta, de verdade: o que foi pra ela nos últimos meses fechados
 * (até 3), dividido pelos meses em que a meta já existia. A meta criada em agosto com R$ 600 em
 * agosto e R$ 600 em setembro guarda R$ 600 por mês, não R$ 400. Mês com dinheiro pra meta conta
 * mesmo antes da criação (guardado lançado com data antiga).
 */
export function ritmoMensalDaMeta(e: { soma: number; mesesComGuardado: number; criadaEm: { ano: number; mes: number }; hoje: { ano: number; mes: number } }): number {
  const mesesFechadosDesdeACriacao = (e.hoje.ano - e.criadaEm.ano) * 12 + (e.hoje.mes - e.criadaEm.mes);
  const meses = Math.min(3, Math.max(1, mesesFechadosDesdeACriacao, e.mesesComGuardado));
  return e.soma / meses;
}

/** "Quanto preciso guardar?": o que as metas e a reserva pedem por mês, contra o que está planejado. */
export function quantoPrecisoGuardar(e: {
  money: (v: number) => string;
  metas: MetaResposta[];
  reserva: { porMes: number; falta: number } | null;
  guardarPlanejado: number | null;
  renda: number | null;
}): Resposta {
  const { money } = e;
  const abertas = e.metas.filter((m) => m.atual < m.alvo && m.necessarioPorMes > 0);
  const total = abertas.reduce((s, m) => s + m.necessarioPorMes, 0) + (e.reserva?.porMes ?? 0);
  const minimoAula = e.renda ? e.renda * 0.1 : 0;
  const alvo = Math.max(total, minimoAula);
  const vencidasSemValor = e.metas.filter((x) => x.vencida && x.atual < x.alvo && !(x.necessarioPorMes > 0));
  if (alvo <= 0 && vencidasSemValor.length > 0) {
    return {
      veredito: "atencao",
      frase: `Ainda não sei: o prazo de ${vencidasSemValor[0].nome} (${vencidasSemValor[0].prazo}) já passou. Com uma data nova, eu calculo quanto guardar por mês.`,
      detalhes: ["A aula pede no mínimo 10% da renda todo mês, pro seu futuro."],
      conta: [],
      acoes: [{ rotulo: "Escolher uma data nova", href: "/planejamento/metas" }],
    };
  }
  if (alvo <= 0) {
    return {
      veredito: "atencao",
      frase: "Ainda não sei: sem metas e sem renda planejada, não tenho com o que calcular.",
      detalhes: ["A aula pede no mínimo 10% da renda todo mês, pro seu futuro."],
      conta: [],
      acoes: [{ rotulo: "Criar uma meta", href: "/planejamento/metas" }],
    };
  }
  const planejado = e.guardarPlanejado ?? 0;
  const veredito: Veredito = planejado >= alvo - 1 ? "bom" : planejado >= alvo * 0.7 ? "atencao" : "ruim";
  const frase =
    veredito === "bom"
      ? `${money(alvo)} por mês, e o seu plano já guarda ${money(planejado)}. Está coberto.`
      : `${money(alvo)} por mês. Hoje o plano guarda ${money(planejado)}: faltam ${money(alvo - planejado)} por mês.`;
  const detalhes: string[] = abertas
    .slice(0, 4)
    .map((m) => (m.vencida ? `${m.nome}: ${money(m.necessarioPorMes)} por mês, o que você combinou. O prazo (${m.prazo}) já passou: vale escolher uma data nova.` : `${m.nome}: ${money(m.necessarioPorMes)} por mês${m.prazo ? ` pra chegar em ${m.prazo}` : ""}.`));
  // Vencida sem valor combinado não entra na soma, mas também não some da resposta.
  for (const m of vencidasSemValor.slice(0, 2)) {
    detalhes.push(`${m.nome}: o prazo (${m.prazo}) já passou. Escolha uma data nova e eu calculo quanto guardar.`);
  }
  if (e.reserva && e.reserva.porMes > 0) detalhes.push(`Reserva de emergência: ${money(e.reserva.porMes)} por mês (faltam ${money(e.reserva.falta)}).`);
  if (minimoAula > total) detalhes.push(`As metas pedem menos que isso, mas a aula pede no mínimo 10% da renda: ${money(minimoAula)}.`);
  return {
    veredito,
    frase,
    detalhes,
    conta: [
      ...abertas.map((m) => ({ rotulo: m.nome, valor: `${money(m.necessarioPorMes)}/mês` })),
      ...(e.reserva && e.reserva.porMes > 0 ? [{ rotulo: "Reserva", valor: `${money(e.reserva.porMes)}/mês` }] : []),
      { rotulo: "Guardar planejado no mês", valor: money(planejado) },
    ],
    acoes: veredito === "bom" ? [{ rotulo: "Quando atinjo minhas metas?", href: "/decidir/pergunta/meta" }] : [{ rotulo: "Ajustar quanto guardo no mês", href: "/orcamento" }, { rotulo: "Ver minhas metas", href: "/planejamento/metas" }],
  };
}

/** "Quando atinjo minha meta?": no ritmo em que ela está guardando de verdade, meta por meta. */
export function quandoAtinjoMinhaMeta(e: { money: (v: number) => string; metas: MetaResposta[] }): Resposta {
  const { money } = e;
  const abertas = e.metas.filter((m) => m.atual < m.alvo);
  if (abertas.length === 0) {
    return {
      veredito: e.metas.length > 0 ? "bom" : "atencao",
      frase: e.metas.length > 0 ? "Todas as suas metas já chegaram lá." : "Você ainda não tem metas. Que tal criar a primeira?",
      detalhes: [],
      conta: [],
      acoes: [{ rotulo: "Criar uma meta", href: "/planejamento/metas" }],
    };
  }
  const atrasadas = abertas.filter((m) => !m.noPrazo);
  const principal = atrasadas[0] ?? abertas[0];
  const veredito: Veredito = atrasadas.length === 0 ? "bom" : atrasadas.some((m) => m.chegaEm === null) ? "ruim" : "atencao";
  const frase = principal.vencida
    ? `${principal.nome}: o prazo (${principal.prazo}) já passou${principal.chegaEm ? `. No ritmo de hoje, chega em ${principal.chegaEm}` : ""}. Quer escolher uma data nova?`
    : principal.chegaEm === null
      ? `${principal.nome}, no ritmo de hoje, não chega: você está guardando ${money(principal.ritmoPorMes)} por mês e ela pede ${money(principal.necessarioPorMes)}.`
      : principal.noPrazo
        ? `${principal.nome} chega em ${principal.chegaEm}${principal.prazo ? `, dentro do prazo (${principal.prazo})` : ""}.`
        : `${principal.nome} chega em ${principal.chegaEm}, depois do prazo (${principal.prazo}). Pra chegar a tempo: ${money(principal.necessarioPorMes)} por mês.`;
  const detalhes = abertas
    .filter((m) => m !== principal)
    .slice(0, 4)
    .map((m) =>
      m.vencida
        ? `${m.nome}: o prazo (${m.prazo}) já passou${m.chegaEm ? `; no ritmo de hoje, chega em ${m.chegaEm}` : ""}.`
        : m.chegaEm
          ? `${m.nome}: chega em ${m.chegaEm}${m.prazo ? (m.noPrazo ? " (no prazo)" : ` (o prazo era ${m.prazo})`) : ""}.`
          : `${m.nome}: no ritmo de hoje, não chega.`,
    );
  return {
    veredito,
    frase,
    detalhes,
    conta: abertas.map((m) => ({ rotulo: m.nome, valor: `${money(m.atual)} de ${money(m.alvo)} · ${money(m.ritmoPorMes)}/mês` })),
    acoes: [{ rotulo: principal.vencida ? "Escolher uma data nova" : "Ver minhas metas", href: "/planejamento/metas" }],
  };
}

/** "Minha reserva está suficiente?": meses de custo de vida que ela cobre, contra a meta. */
export function minhaReservaBasta(e: {
  money: (v: number) => string;
  reserva: { atual: number; custoMensal: number; mesesMeta: number; porMes: number } | null;
  gastoReal: number | null;
}): Resposta {
  const { money } = e;
  if (!e.reserva || !(e.reserva.custoMensal > 0)) {
    return {
      veredito: "ruim",
      frase: "Ainda não tem reserva montada no app.",
      detalhes: ["A reserva segura um imprevisto sem virar dívida. A referência é de 6 a 12 meses do seu custo de vida.", ...(e.gastoReal ? [`Seu custo de vida hoje é de uns ${money(e.gastoReal)} por mês.`] : [])],
      conta: [],
      acoes: [{ rotulo: "Montar minha reserva", href: "/planejamento/reserva-emergencia" }],
    };
  }
  const r = e.reserva;
  // O custo de vida de verdade pode ter subido desde que ela montou a reserva.
  const custo = Math.max(r.custoMensal, e.gastoReal ?? 0);
  const meses = r.atual / custo;
  const falta = Math.max(0, custo * r.mesesMeta - r.atual);
  const mesesPraCompletar = r.porMes > 0 ? Math.ceil(falta / r.porMes) : null;
  const veredito: Veredito = meses >= r.mesesMeta ? "bom" : meses >= 3 ? "atencao" : "ruim";
  const cobre = meses < 1 ? "menos de 1 mês" : `${(Math.floor(meses * 10) / 10).toLocaleString("pt-BR")} ${Math.floor(meses * 10) / 10 === 1 ? "mês" : "meses"}`;
  const frase =
    veredito === "bom"
      ? `Sim. Ela cobre ${cobre} do seu custo de vida, e a sua meta é ${r.mesesMeta}.`
      : `Ainda não. Ela cobre ${cobre} do seu custo de vida; a sua meta é ${r.mesesMeta} meses. Faltam ${money(falta)}.`;
  const detalhes: string[] = [];
  if (e.gastoReal && e.gastoReal > r.custoMensal * 1.1) detalhes.push(`Você montou a reserva com ${money(r.custoMensal)} de custo por mês, mas hoje gasta uns ${money(e.gastoReal)}. Usei o maior.`);
  if (veredito !== "bom") detalhes.push(mesesPraCompletar ? `Guardando ${money(r.porMes)} por mês, completa em ${mesesPraCompletar} ${mesesPraCompletar === 1 ? "mês" : "meses"}.` : "Sem um valor guardado por mês pra reserva, ela não cresce sozinha.");
  return {
    veredito,
    frase,
    detalhes,
    conta: [
      { rotulo: "Reserva hoje", valor: money(r.atual) },
      { rotulo: "Custo de vida por mês", valor: money(custo) },
      { rotulo: `Meta (${r.mesesMeta} meses)`, valor: money(custo * r.mesesMeta) },
    ],
    acoes: [{ rotulo: "Ver minha reserva", href: "/planejamento/reserva-emergencia" }],
  };
}

export type ResumoMes = { label: string; renda: number; gastos: number; guardado: number; porCategoria: Record<string, { label: string; valor: number }> };

/** "Por que meu dinheiro acabou mais rápido?": o que mudou de um mês pro outro. */
export function porqueAcabouMaisRapido(e: { money: (v: number) => string; atual: ResumoMes; anterior: ResumoMes; maiores: { descricao: string; valor: number; categoria: string | null }[] }): Resposta {
  const { money } = e;
  const diffGasto = e.atual.gastos - e.anterior.gastos;
  const diffRenda = e.atual.renda - e.anterior.renda;
  const subidas = Object.entries(e.atual.porCategoria)
    .map(([k, v]) => ({ label: v.label, antes: e.anterior.porCategoria[k]?.valor ?? 0, agora: v.valor }))
    .map((c) => ({ ...c, diff: c.agora - c.antes }))
    .filter((c) => c.diff >= 1)
    .sort((a, b) => b.diff - a.diff);
  const veredito: Veredito = diffGasto <= 0 && diffRenda >= 0 ? "bom" : diffGasto > e.anterior.gastos * 0.1 ? "ruim" : "atencao";
  const frase =
    diffGasto > 0
      ? `Porque saiu mais: ${money(e.atual.gastos)} em ${e.atual.label}, ${money(diffGasto)} a mais que em ${e.anterior.label}${subidas[0] ? `. O que mais subiu foi ${subidas[0].label} (+${money(subidas[0].diff)})` : ""}.`
      : diffRenda < 0
        ? `Os gastos não subiram (${money(e.atual.gastos)}); o que mudou foi a renda: entrou ${money(-diffRenda)} a menos que em ${e.anterior.label}.`
        : `Na verdade não acabou mais rápido: em ${e.atual.label} saíram ${money(e.atual.gastos)}, ${money(-diffGasto)} a menos que em ${e.anterior.label}.`;
  const detalhes: string[] = subidas.slice(1, 3).map((c) => `${c.label}: ${money(c.antes)} → ${money(c.agora)}.`);
  if (e.maiores.length > 0 && diffGasto > 0) detalhes.push(`Os maiores gastos de ${e.atual.label}: ${e.maiores.slice(0, 3).map((g) => `${g.descricao} (${money(g.valor)})`).join(", ")}.`);
  if (diffRenda < 0 && diffGasto > 0) detalhes.push(`E entrou ${money(-diffRenda)} a menos.`);
  return {
    veredito,
    frase,
    detalhes,
    conta: [
      { rotulo: `Gastos em ${e.anterior.label}`, valor: money(e.anterior.gastos) },
      { rotulo: `Gastos em ${e.atual.label}`, valor: money(e.atual.gastos) },
      { rotulo: `Renda em ${e.anterior.label}`, valor: money(e.anterior.renda) },
      { rotulo: `Renda em ${e.atual.label}`, valor: money(e.atual.renda) },
    ],
    acoes: [{ rotulo: "Ver onde estou exagerando", href: "/decidir/pergunta/exagerando" }],
  };
}

/** "Melhorei em relação ao mês passado?": gasto, guardado e quanto sobrou, lado a lado. */
export function melhoreiDoMesPassado(e: { money: (v: number) => string; atual: ResumoMes; anterior: ResumoMes }): Resposta {
  const { money } = e;
  const taxa = (m: ResumoMes) => (m.renda > 0 ? m.guardado / m.renda : 0);
  // Mês sem nada lançado não é base de comparação: cliente nova recebia "Não" em vermelho
  // (dois meses zerados empatam e empate dava 0 pontos) ou "Sim" verde contra o nada (guardou
  // R$ 500 "a mais" que zero no primeiro mês de uso). Sem base, a resposta é que não dá pra dizer.
  const vazio = (m: ResumoMes) => m.renda === 0 && m.gastos === 0 && m.guardado === 0;
  const semBase = vazio(e.anterior);
  const pontos = [e.atual.gastos < e.anterior.gastos, e.atual.guardado > e.anterior.guardado, taxa(e.atual) > taxa(e.anterior)].filter(Boolean).length;
  const veredito: Veredito = semBase ? "atencao" : pontos >= 2 ? "bom" : pontos === 1 ? "atencao" : "ruim";
  const frase = semBase
    ? vazio(e.atual)
      ? `Ainda não dá pra comparar: não tem nada lançado em ${e.anterior.label} nem em ${e.atual.label}.`
      : `Ainda não dá pra comparar: não tem nada lançado em ${e.anterior.label}. Em ${e.atual.label} você gastou ${money(e.atual.gastos)} e guardou ${money(e.atual.guardado)}.`
    : veredito === "bom"
      ? `Sim. Em ${e.atual.label} você gastou ${money(e.atual.gastos)} (em ${e.anterior.label} foram ${money(e.anterior.gastos)}) e guardou ${money(e.atual.guardado)}.`
      : veredito === "atencao"
        ? `Em parte. Em ${e.atual.label} você gastou ${money(e.atual.gastos)} e guardou ${money(e.atual.guardado)}; em ${e.anterior.label}, ${money(e.anterior.gastos)} e ${money(e.anterior.guardado)}.`
        : `Não. Em ${e.atual.label} os gastos foram ${money(e.atual.gastos)} e o guardado ${money(e.atual.guardado)}, contra ${money(e.anterior.gastos)} e ${money(e.anterior.guardado)} em ${e.anterior.label}.`;
  return {
    veredito,
    frase,
    detalhes: [
      `Do que entrou, você guardou ${pct(taxa(e.atual))} em ${e.atual.label} e ${pct(taxa(e.anterior))} em ${e.anterior.label}. A aula pede pelo menos 10%.`,
    ],
    conta: [
      { rotulo: `Gastos: ${e.anterior.label} → ${e.atual.label}`, valor: `${money(e.anterior.gastos)} → ${money(e.atual.gastos)}` },
      { rotulo: `Guardado: ${e.anterior.label} → ${e.atual.label}`, valor: `${money(e.anterior.guardado)} → ${money(e.atual.guardado)}` },
    ],
    acoes: [{ rotulo: "Por que o dinheiro acabou mais rápido?", href: "/decidir/pergunta/acabou" }],
  };
}

/** "Quanto posso gastar essa semana?": o livre do Foco, dito em uma frase. */
export function quantoPossoGastarNaSemana(e: { money: (v: number) => string; livreSemana: number | null; livreMes: number | null; diasRestantes: number; diasSemLancar: number | null }): Resposta {
  const { money } = e;
  if (e.livreSemana === null || e.livreMes === null) {
    return {
      veredito: "atencao",
      frase: "Sem orçamento eu não consigo dizer quanto está livre.",
      detalhes: [],
      conta: [],
      acoes: [{ rotulo: "Montar meu orçamento", href: "/orcamento" }],
    };
  }
  const porDia = e.livreMes / Math.max(1, e.diasRestantes);
  const veredito: Veredito = e.livreMes <= 0 ? "ruim" : "bom";
  return {
    veredito,
    frase:
      e.livreMes <= 0
        ? "Nada livre até o fim do mês: o orçamento do mês já foi todo."
        : e.diasRestantes < 7
          ? `${money(e.livreMes)} até o fim do mês, que acaba em ${e.diasRestantes === 1 ? "1 dia" : `${e.diasRestantes} dias`}: uns ${money(porDia)} por dia.`
          : `${money(e.livreSemana)} essa semana. Até o fim do mês são ${money(e.livreMes)}, uns ${money(porDia)} por dia.`,
    detalhes: e.diasSemLancar ? [`Seus últimos gastos lançados são de ${e.diasSemLancar} dias atrás: esse número pode estar alto.`] : [],
    conta: [
      { rotulo: "Livre até o fim do mês", valor: money(e.livreMes) },
      { rotulo: "Dias que faltam", valor: String(e.diasRestantes) },
    ],
    acoes: [{ rotulo: "Posso comprar uma coisa?", href: "/decidir/comprar" }],
  };
}
