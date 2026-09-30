/**
 * "Posso comprar?": o que uma compra faz com o mês e com as metas, ANTES de passar o cartão.
 *
 * As regras são as da aula da Dani, não inventadas aqui:
 * - gastar no máximo 90% da renda (o resto é futuro, não sobra);
 * - regra de ouro: parcelado sem juros vale mais que à vista quando o dinheiro fica rendendo,
 *   a menos que o desconto à vista seja maior que o rendimento;
 * - "corte o que for preciso, mas nunca deixe de investir no seu futuro": uma parcela tira
 *   primeiro dos sonhos de prazo mais longo; a reserva de emergência é a última a ser mexida.
 *
 * Toda conta é determinística e aparece na tela ("Como cheguei nisso"). Sem dado, não responde:
 * pede o dado.
 *
 * Puro, sem banco e sem React.
 */

export type CompraMeta = {
  id: string;
  nome: string;
  atual: number;
  alvo: number;
  /** Quanto a pessoa guarda por mês pra esta meta hoje. */
  aporte: number;
  /** Taxa mensal (0,009 = 0,9% ao mês). */
  taxa: number;
  /** Prazo da meta em meses a partir de hoje (0 = sem prazo). Só serve pra ordenar quem perde primeiro. */
  prazoMeses: number;
  /** A reserva de emergência entra aqui também, marcada, pra ser a última a perder. */
  reserva?: boolean;
  /** Como a meta está hoje (o mesmo status do Foco e de Metas): "no prazo" só se estiver mesmo. */
  status?: "NOT_STARTED" | "ON_TRACK" | "BEHIND";
  /** Meses de calendário até o mês do prazo (setembro → dezembro = 3): a data que a tela mostra é a da meta. */
  mesesAtePrazo?: number;
};

export type CompraBase = {
  renda: number;
  /** Soma do orçamento planejado do mês (gastos). */
  gastoPlanejado: number;
  /**
   * Quanto ela GASTOU de fato, em média, nos últimos meses fechados (já inclui as parcelas de
   * compras antigas que ela está pagando). null = sem histórico ainda.
   */
  gastoReal?: number | null;
  /** O que já foi gasto NESTE mês (tudo, com ou sem categoria no orçamento). */
  gastoDoMesAtual?: number;
  /** O "quanto guardar por mês" do Plano do mês. As metas podem somar menos que isso. */
  guardarPlanejado?: number | null;
  /** De onde veio a renda: o plano do mês, a renda típica dos últimos meses, ou o que entrou até agora. */
  fonteRenda?: "plano" | "media" | "mes";
  /**
   * A regra dos 90% vale? Não vale no perfil Casal que só recebe o que cada um põe na conta
   * conjunta: essa "renda" é repasse, e gastar 100% dela é o combinado. Omitido = vale.
   */
  regra90?: boolean;
  /** O que ainda sobra do orçamento do dia a dia no mês. */
  sobraDoMes: number;
  /**
   * Compras que ela já decidiu fazer ("Vou comprar") e ainda não apareceram nos lançamentos: o
   * valor das à vista e a soma das parcelas mensais das parceladas. Sem isso, cada compra
   * aprovada parecia caber sozinha, e o mesmo dinheiro livre aprovava a segunda e a terceira.
   */
  jaDecidido?: { vista: number; parcelaMensal: number };
  diasRestantes: number;
  metas: CompraMeta[];
  /** Taxa mensal de referência pro "dinheiro rendendo" na comparação à vista × parcelado. */
  taxaReferencia: number;
  /** Tem dinheiro na reserva (mesmo completa): é de onde sairia o que falta, e o texto diz isso. */
  reservaComSaldo?: boolean;
};

export type Compra = {
  valor: number;
  modo: "vista" | "parcelado";
  parcelas: number;
  /** Juros ao mês, em fração (0,02 = 2%). 0 = sem juros. */
  juros: number;
  /** Desconto se pagar à vista, em fração. */
  desconto: number;
  /** O que a pessoa quer comprar ("celular"): entra no aviso de juros. */
  descricao?: string;
};

export type Veredito = "ok" | "custo" | "nao";

export type LinhaAntesDepois = { rotulo: string; hoje: string; depois: string };

export type ResultadoCompra =
  | { erro: "valor" | "renda" | "orcamento" }
  | {
      veredito: Veredito;
      titulo: string;
      explicacao: string;
      linhas: LinhaAntesDepois[];
      sugestao: string | null;
      comparacao: { vista: number; parceladoHoje: number; melhor: "vista" | "parcelado"; diferenca: number } | null;
      custoJuros: number | null;
      /**
       * Parcelado com juros: "O celular custa R$ 3.000. Em 12x com 4% ao mês, você paga R$ 3.836:
       * R$ 836 a mais só por parcelar." Aparece em destaque, em amarelo, em qualquer veredito.
       */
      alertaJuros?: string | null;
      /** Quanto da renda já está comprometido hoje e como fica com a compra (frações da renda). */
      comprometimento?: { hoje: number; depois: number; valor: number; renda: number; fonte: "real" | "planejado" | "mes" };
      /** Dado que parece incompleto ou ambíguo: a tela avisa em vez de fingir certeza. */
      avisos?: string[];
      conta: { rotulo: string; valor: string }[];
    };

export const LIMITE_GASTO = 0.9;
const MAX_MESES = 600;

/** Meses até a meta chegar no alvo, com o aporte de cada mês dado por `aporteNoMes(k)`. */
export function mesesAteMeta(meta: Pick<CompraMeta, "atual" | "alvo" | "taxa">, aporteNoMes: (k: number) => number): number | null {
  let saldo = meta.atual;
  if (saldo >= meta.alvo) return 0;
  for (let k = 1; k <= MAX_MESES; k++) {
    // Aporte no começo do mês, rendendo o mês inteiro: a mesma conta do plano da meta (pmt tipo 1).
    // A folga de meio centavo evita que arredondamento empurre a meta um mês pra frente.
    saldo = (saldo + aporteNoMes(k)) * (1 + meta.taxa);
    if (saldo >= meta.alvo - 0.005) return k;
  }
  return null;
}

/** Valor de hoje de N parcelas iguais, com o dinheiro rendendo `taxa` ao mês. */
export function valorPresente(parcela: number, n: number, taxa: number): number {
  if (taxa <= 0) return parcela * n;
  return (parcela * (1 - Math.pow(1 + taxa, -n))) / taxa;
}

/**
 * Quanto cada meta deixa de receber por mês enquanto a parcela durar. Os sonhos de prazo mais
 * longo perdem primeiro (sem prazo = o mais longo de todos); a reserva, por último. Meta já
 * alcançada não entra: não tem o que perder.
 */
export function cortesPorMeta(metas: CompraMeta[], parcela: number): Map<string, number> {
  const prazo = (m: CompraMeta) => (m.prazoMeses > 0 ? m.prazoMeses : Number.POSITIVE_INFINITY);
  const ordem = metas
    .filter((m) => m.atual < m.alvo)
    .sort((a, b) => Number(a.reserva ?? false) - Number(b.reserva ?? false) || (prazo(a) === prazo(b) ? 0 : prazo(b) > prazo(a) ? 1 : -1));
  const cortes = new Map<string, number>();
  let resto = parcela;
  for (const m of ordem) {
    if (resto <= 0) break;
    const corte = Math.min(m.aporte, resto);
    if (corte > 0) cortes.set(m.id, corte);
    resto -= corte;
  }
  return cortes;
}

/**
 * Perto de 90%, uma casa decimal e arredondando pra longe do limite: 90,04% aparece "90,1%"
 * (passou) e 89,96% aparece "89,9%" (não passou). Nunca "vão a 90%. A regra é no máximo 90%".
 */
export function pct(v: number): string {
  const x = v * 100;
  const limite = LIMITE_GASTO * 100;
  const f = (n: number, casas: number) => `${n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
  if (Math.abs(x - limite) < 1) return f(x > limite ? Math.ceil(x * 10 - 1e-9) / 10 : Math.floor(x * 10 + 1e-9) / 10, 1);
  return f(Math.round(x), 0);
}

type Formatos = { money: (v: number) => string; mesDaqui: (meses: number | null) => string };

/**
 * O que a tela precisa avisar ANTES de qualquer veredito: dado que parece incompleto. É o que
 * impede uma resposta errada por um jeito diferente de preencher o app.
 */
export function avisosDaBase(base: CompraBase, money: (v: number) => string): string[] {
  const avisos: string[] = [];
  const real = base.gastoReal ?? 0;
  if (base.gastoPlanejado > 0 && real > base.gastoPlanejado * 1.2) {
    avisos.push(
      `Seus gastos de verdade (média de ${money(real)} nos últimos meses) estão bem acima do seu orçamento (${money(base.gastoPlanejado)}). Ou o orçamento não inclui todos os gastos (os fixos também contam), ou tem transferência, aplicação ou pagamento de fatura lançado como gasto. Usei o maior dos dois: vale conferir.`,
    );
  } else if (base.gastoPlanejado > 0 && (base.gastoDoMesAtual ?? 0) > base.gastoPlanejado) {
    avisos.push(
      `Neste mês já saíram ${money(base.gastoDoMesAtual ?? 0)}, mais que o seu orçamento inteiro (${money(base.gastoPlanejado)}). Se o orçamento não inclui todos os gastos, vale completar: usei o que já saiu.`,
    );
  }
  if (base.regra90 === false) {
    avisos.push("Aqui a renda é o que vocês colocam na conta conjunta, então a regra dos 90% não se aplica: ela vale pra renda de cada um. A conta abaixo olha se cabe no que já está na conta e nas metas do casal.");
  }
  if (base.fonteRenda === "media") {
    avisos.push(`Você não planejou a renda deste mês. Usei ${money(base.renda)}, a renda típica dos seus últimos meses. Planeje a renda no Orçamento pra conta ficar exata.`);
  } else if (base.fonteRenda === "mes") {
    avisos.push(`Você não planejou a renda deste mês e não tenho renda dos meses anteriores. Usei o que entrou até agora (${money(base.renda)}). Planeje a renda no Orçamento pra conta ficar exata.`);
  }
  return avisos;
}

export function avaliarCompra(base: CompraBase, compraBruta: Compra, fmt: Formatos): ResultadoCompra {
  const r = avaliarSemAvisos(base, compraBruta, fmt);
  return "erro" in r ? r : { ...r, avisos: avisosDaBase(base, fmt.money) };
}

function avaliarSemAvisos(base: CompraBase, compraBruta: Compra, fmt: Formatos): ResultadoCompra {
  if (!(compraBruta.valor > 0) || !Number.isFinite(compraBruta.valor)) return { erro: "valor" };
  if (!(base.renda > 0)) return { erro: "renda" };
  if (!(base.gastoPlanejado > 0)) return { erro: "orcamento" };
  const { money, mesDaqui } = fmt;
  // Entrada saneada: desconto entre 0 e 90%, juros nunca negativo, parcelas inteiras de 1 a 48.
  const parcelasPedidas = Number.isFinite(compraBruta.parcelas) ? Math.round(compraBruta.parcelas) : 1;
  const compra: Compra = {
    ...compraBruta,
    // Parcelado em 1x vira à vista, mas sem o desconto de quem paga à vista.
    desconto:
      compraBruta.modo === "parcelado" && parcelasPedidas <= 1 ? 0 : Math.min(0.9, Math.max(0, Number.isFinite(compraBruta.desconto) ? compraBruta.desconto : 0)),
    juros: Math.max(0, Number.isFinite(compraBruta.juros) ? compraBruta.juros : 0),
    // Parcelado em 1x é à vista, sem desconto.
    modo: compraBruta.modo === "parcelado" && parcelasPedidas <= 1 ? "vista" : compraBruta.modo,
  };
  const porSemana = (v: number) => (base.diasRestantes < 7 ? v : (v / base.diasRestantes) * 7);
  // O que a renda JÁ tem de compromisso: o maior entre o que ela planejou gastar e o que ela
  // gastou de fato, na média dos últimos meses. Planejar R$ 7.000 e gastar R$ 8.800 (parcelas
  // antigas, mercado que sempre passa) não pode fazer uma compra nova parecer caber.
  // Também o que já saiu neste mês: orçamento que cobre só 2 categorias não pode dizer "cabe"
  // quando o mês já gastou mais que ele.
  const real = base.gastoReal && base.gastoReal > 0 ? base.gastoReal : 0;
  const doMes = base.gastoDoMesAtual && base.gastoDoMesAtual > 0 ? base.gastoDoMesAtual : 0;
  const comprometidoSemDecididas = Math.max(base.gastoPlanejado, real, doMes);
  const fonte: "real" | "planejado" | "mes" = comprometidoSemDecididas === base.gastoPlanejado ? "planejado" : comprometidoSemDecididas === real ? "real" : "mes";
  // O que ela já decidiu comprar e ainda não lançou: as parcelas entram no compromisso de todo
  // mês; o à vista sai do dinheiro sem destino e, no que ele não cobrir, da sobra do dia a dia,
  // do mesmo jeito que a compra de agora sairia.
  const decididoVista = Math.max(0, base.jaDecidido?.vista ?? 0);
  const decididoParcela = Math.max(0, base.jaDecidido?.parcelaMensal ?? 0);
  const comprometido = comprometidoSemDecididas + decididoParcela;
  const margem90 = base.renda * LIMITE_GASTO - comprometido;
  const temMetas = base.metas.some((m) => m.atual < m.alvo);
  const temReserva = base.reservaComSaldo ?? base.metas.some((m) => m.reserva && m.atual < m.alvo);
  const guardadoNasMetas = base.metas.reduce((s, m) => s + m.aporte, 0);
  // O que ela planejou guardar no mês vale mesmo sem meta: é o "nunca deixe de investir no seu
  // futuro". A parte do plano que não tem meta é a primeira a ser usada, antes dos sonhos.
  const guardadoHoje = Math.max(base.guardarPlanejado ?? 0, guardadoNasMetas);
  const guardadoSemMeta = guardadoHoje - guardadoNasMetas;
  const algumaAtrasada = base.metas.some((m) => m.status === "BEHIND" && m.atual < m.alvo);
  // Dinheiro do mês que não tem destino (nem gasto planejado nem meta): a compra sai dele
  // primeiro, à vista ou parcelada. Só o que ele não cobre mexe no dia a dia ou nas metas.
  const semDestinoAntes = Math.max(0, base.renda - comprometido - guardadoHoje);
  const decididoDoSemDestino = Math.min(decididoVista, semDestinoAntes);
  const semDestino = semDestinoAntes - decididoDoSemDestino;
  const sobraDoMes = Math.max(0, base.sobraDoMes - (decididoVista - decididoDoSemDestino));
  // O gasto DESTE mês: a parte das à vista já decididas que saiu do dinheiro sem destino é gasto
  // a mais no mês (a parte que saiu da sobra do dia a dia já estava no orçamento). Sem isso, a
  // segunda compra à vista via 74% da renda quando o mês já ia a 94%, e escapava da regra dos 90%.
  // O parcelado continua olhando o compromisso de TODO mês (comprometido): a compra à vista é uma
  // vez só e a primeira parcela vem na próxima fatura.
  const comprometidoNoMes = comprometido + decididoDoSemDestino;
  const linhaComprometida = (depois: number, hoje = comprometido): LinhaAntesDepois => ({ rotulo: "Renda comprometida", hoje: pct(hoje / base.renda), depois: pct(depois / base.renda) });
  const comprometimento = (depois: number, hoje = comprometido) => ({ hoje: hoje / base.renda, depois: depois / base.renda, valor: hoje, renda: base.renda, fonte });
  const contaComprometido = {
    rotulo:
      fonte === "real" ? "Já comprometido (média do que você gastou nos últimos meses)" : fonte === "mes" ? "Já comprometido (o que já saiu neste mês)" : "Já comprometido (seu orçamento do mês)",
    // As parcelas já decididas aparecem na linha delas, logo abaixo.
    valor: money(comprometidoSemDecididas),
  };
  const contaDecididas =
    decididoVista + decididoParcela > 0
      ? [
          ...(decididoParcela > 0 ? [{ rotulo: "Parcelas de compras que você já decidiu fazer", valor: `${money(decididoParcela)} por mês` }] : []),
          ...(decididoVista > 0 ? [{ rotulo: "Compras à vista que você já decidiu fazer", valor: money(decididoVista) }] : []),
        ]
      : [];

  if (compra.modo === "vista") {
    const custo = compra.valor * (1 - compra.desconto);
    const sobra = sobraDoMes;
    const doSemDestino = Math.min(custo, semDestino);
    const resto = custo - doSemDestino;
    const depois = Math.max(0, sobra - resto);
    const falta = resto - sobra;
    // O que sai da sobra do dia a dia já estava no orçamento; o resto aumenta o gasto do mês.
    const gastoMesDepois = comprometidoNoMes + custo - Math.min(resto, sobra);
    const passa90 = base.regra90 !== false && gastoMesDepois / base.renda > LIMITE_GASTO + 1e-9;
    const linhas: LinhaAntesDepois[] = [
      linhaComprometida(gastoMesDepois, comprometidoNoMes),
      { rotulo: "Livre por semana", hoje: money(porSemana(sobra)), depois: money(porSemana(depois)) },
      { rotulo: "Sobra do mês pro dia a dia", hoje: money(sobra), depois: falta > 0 ? `falta ${money(falta)}` : money(depois) },
    ];
    if (semDestino > 0) linhas.push({ rotulo: "Livre sem destino no mês", hoje: money(semDestino), depois: money(semDestino - doSemDestino) });
    if (temMetas) {
      const hoje = algumaAtrasada ? "com atraso" : "no prazo";
      linhas.push({ rotulo: "Suas metas", hoje, depois: falta > 0 ? "em risco" : hoje });
    }
    const conta = [
      contaComprometido,
      ...contaDecididas,
      { rotulo: compra.desconto > 0 ? `Valor com ${pct(compra.desconto)} de desconto` : "Valor", valor: money(custo) },
      ...(semDestino > 0 ? [{ rotulo: "Sai do dinheiro sem destino", valor: money(doSemDestino) }] : []),
      { rotulo: "Sobra do orçamento no mês", valor: money(sobra) },
      { rotulo: "Depois da compra", valor: falta > 0 ? `falta ${money(falta)}` : money(depois) },
    ];
    const cmp = comprometimento(gastoMesDepois, comprometidoNoMes);
    // Cabe no dinheiro do mês, mas os gastos passam de 90% da renda: sobra menos de 10% pra
    // guardar. Não é "não", mas também não é verde.
    if (falta <= 0 && passa90) {
      return { veredito: "custo", titulo: "Cabe, mas passa da regra dos 90%", explicacao: `Neste mês seus gastos iriam a ${pct(gastoMesDepois / base.renda)} da renda: sobra menos de 10% pra guardar.`, linhas, sugestao: null, comparacao: null, custoJuros: null, comprometimento: cmp, conta };
    }
    if (resto <= 0) {
      return { veredito: "ok", titulo: "Cabe no dinheiro que ainda não tem destino", explicacao: temMetas ? "Não mexe no dia a dia nem nas suas metas." : "Não mexe no dinheiro do dia a dia.", linhas, sugestao: null, comparacao: null, custoJuros: null, comprometimento: cmp, conta };
    }
    if (resto <= sobra * 0.35) {
      return { veredito: "ok", titulo: "Cabe no que está livre este mês", explicacao: temMetas ? "Suas metas não mudam. Só sobra um pouco menos pro resto do mês." : "Só sobra um pouco menos pro resto do mês.", linhas, sugestao: null, comparacao: null, custoJuros: null, comprometimento: cmp, conta };
    }
    if (resto <= sobra) {
      return { veredito: "custo", titulo: "Cabe, mas aperta o resto do mês", explicacao: `Sobram ${money(porSemana(depois))} por semana até o fim do mês.`, linhas, sugestao: null, comparacao: null, custoJuros: null, comprometimento: cmp, conta };
    }
    // Casal com conta conjunta não usa a regra dos 90%: o limite é o que entra na conta.
    const semRegra90 = base.regra90 === false;
    // Folga de TODO mês (parcelas, guardar pra comprar depois) e folga DESTE mês, que já perdeu o
    // que saiu pras compras à vista decididas.
    const folga = Math.max(0, semRegra90 ? base.renda - comprometido : margem90);
    const folgaNoMes = Math.max(0, folga - decididoDoSemDestino);
    const limite = semRegra90 ? "no que vocês põem na conta todo mês" : "na regra dos 90%";
    // Parcelado a loja cobra o preço cheio: o desconto é só pra quem paga à vista.
    const parcelasSugeridas = folga > 0 ? Math.max(2, Math.ceil(compra.valor / folga)) : null;
    const mesesGuardando = folga > 0 ? Math.ceil(custo / folga) : null;
    const sugestao =
      folgaNoMes > 0 && custo <= folgaNoMes
        ? `Cabe ${semRegra90 ? "no que vocês põem na conta" : "dentro da regra dos 90% da renda"} se sair do que ${semRegra90 ? "vocês guardariam" : "você guardaria"} este mês, sem mexer no básico. Aí a decisão é ${semRegra90 ? "de vocês" : "sua"}: a compra agora ou o guardado do mês.`
        : parcelasSugeridas && parcelasSugeridas <= 24 && mesesGuardando
          ? `Se a loja parcelar em ${parcelasSugeridas}x sem juros (${money(compra.valor / parcelasSugeridas)} por mês), cabe ${limite}. Ou, guardando ${money(folga)} por mês, dá pra comprar à vista em ${mesesGuardando} ${mesesGuardando > 1 ? "meses" : "mês"}, sem dívida.`
          : "Esse valor pede uma meta própria: guardar antes e comprar depois.";
    return {
      veredito: "nao",
      titulo: "Neste mês não cabe",
      explicacao: `Faltariam ${money(falta)}: teria que sair do básico do mês${temReserva ? " ou da sua reserva" : ""}.`,
      linhas,
      sugestao,
      comparacao: null,
      custoJuros: null,
      comprometimento: cmp,
      conta,
    };
  }

  const n = Math.max(2, Math.min(48, parcelasPedidas));
  const parcela = compra.juros > 0 ? (compra.valor * compra.juros) / (1 - Math.pow(1 + compra.juros, -n)) : compra.valor / n;
  const gastoDepois = (comprometido + parcela) / base.renda;
  const doGuardado = Math.max(0, parcela - semDestino);
  const cortes = cortesPorMeta(base.metas, Math.max(0, doGuardado - guardadoSemMeta));
  const linhas: LinhaAntesDepois[] = [
    { rotulo: "Parcela", hoje: "—", depois: `${money(parcela)} × ${n}` },
    linhaComprometida(comprometido + parcela),
  ];
  if (guardadoHoje > 0) linhas.push({ rotulo: "Guardado por mês", hoje: money(guardadoHoje), depois: money(Math.max(0, guardadoHoje - doGuardado)) });
  if (semDestino > 0) linhas.push({ rotulo: "Livre sem destino no mês", hoje: money(semDestino), depois: money(Math.max(0, semDestino - parcela)) });
  let atrasoReserva = 0;
  let maiorAtraso: { nome: string; meses: number } | null = null;
  for (const m of base.metas) {
    if (m.atual >= m.alvo) continue;
    const corte = cortes.get(m.id) ?? 0;
    const antes = mesesAteMeta(m, () => m.aporte);
    // A primeira parcela vem na próxima fatura: o corte vale do mês 1 ao mês n.
    const depois = corte > 0 ? mesesAteMeta(m, (k) => (k <= n ? m.aporte - corte : m.aporte)) : antes;
    const atraso = (depois ?? MAX_MESES) - (antes ?? MAX_MESES);
    // Meta no ritmo: a data de hoje é a DELA (a mesma do Foco e de Metas), e o atraso anda a partir dali.
    const usaPrazo = m.mesesAtePrazo !== undefined && m.status !== "BEHIND" && antes !== null;
    linhas.push({
      rotulo: m.nome,
      hoje: usaPrazo ? mesDaqui(m.mesesAtePrazo!) : mesDaqui(antes),
      depois: usaPrazo ? (depois === null ? mesDaqui(null) : mesDaqui(m.mesesAtePrazo! + Math.max(0, atraso))) : mesDaqui(depois),
    });
    if (m.reserva) atrasoReserva = atraso;
    else if (atraso > 0 && (!maiorAtraso || atraso > maiorAtraso.meses)) maiorAtraso = { nome: m.nome, meses: atraso };
  }

  // Casal que só conta o que cada um põe na conta conjunta: a regra dos 90% não vale, mas a
  // parcela ainda tem que caber no que entra nessa conta. O teto é o dinheiro sem destino mais
  // o que se guarda (o guardado pode virar parcela, os gastos combinados não).
  const cabeNaConjunta = semDestino + guardadoHoje;
  const conta = [
    { rotulo: "Parcela", valor: money(parcela) },
    ...(parcelasPedidas > 48 ? [{ rotulo: "Parcelas consideradas", valor: "48 (o máximo que o app simula)" }] : []),
    contaComprometido,
    ...contaDecididas,
    { rotulo: "Comprometido + parcela", valor: money(comprometido + parcela) },
    base.regra90 === false
      ? { rotulo: "Cabe por mês na conta conjunta", valor: money(cabeNaConjunta) }
      : { rotulo: "Limite da regra dos 90%", valor: money(base.renda * LIMITE_GASTO) },
    { rotulo: "Sai do dinheiro sem destino", valor: money(Math.min(parcela, semDestino)) },
    { rotulo: "Sai do que você guarda", valor: money(Math.min(doGuardado, guardadoHoje)) },
    { rotulo: "Primeira parcela", valor: "na próxima fatura" },
    { rotulo: "Quem deixa de receber primeiro", valor: "os sonhos mais distantes; a reserva por último" },
  ];
  const comparacao =
    compra.juros === 0
      ? (() => {
          const vista = compra.valor * (1 - compra.desconto);
          const parceladoHoje = valorPresente(parcela, n, base.taxaReferencia);
          return { vista, parceladoHoje, melhor: parceladoHoje < vista ? ("parcelado" as const) : ("vista" as const), diferenca: Math.abs(vista - parceladoHoje) };
        })()
      : null;
  const custoJuros = compra.juros > 0 ? parcela * n - compra.valor : null;
  const nome = compraBruta.descricao?.trim() ? `${compraBruta.descricao.trim().charAt(0).toUpperCase()}${compraBruta.descricao.trim().slice(1)}` : "Essa compra";
  const taxaTexto = `${(compra.juros * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
  const alertaJuros =
    custoJuros !== null && custoJuros >= 1
      ? `${nome} custa ${money(compra.valor)}. Em ${n}x com juros de ${taxaTexto} ao mês, você paga ${money(parcela * n)}: ${money(custoJuros)} a mais só por parcelar.`
      : null;
  // Juros acima do que o dinheiro rende parado: mesmo cabendo no mês, parcelar sai caro. O
  // veredito não fica verde; fica amarelo, com o valor dos juros na cara.
  const jurosAltos = alertaJuros !== null && compra.juros > base.taxaReferencia;

  if (base.regra90 !== false && gastoDepois > LIMITE_GASTO) {
    const minimo = margem90 > 0 ? Math.max(2, Math.ceil(compra.valor / margem90)) : null;
    return {
      veredito: "nao",
      titulo: "Passa da regra dos 90%",
      explicacao: `Sua renda já está ${pct(comprometido / base.renda)} comprometida. Com essa parcela, vai a ${pct(gastoDepois)}. A regra é no máximo 90%.`,
      linhas,
      sugestao: minimo && minimo <= 48 && compra.juros === 0 ? `Em ${minimo}x sem juros (${money(compra.valor / minimo)} por mês), cabe dentro dos 90%.` : "Vale guardar antes e comprar depois.",
      comparacao,
      custoJuros,
      alertaJuros,
      comprometimento: comprometimento(comprometido + parcela),
      conta,
    };
  }
  if (base.regra90 === false && parcela > cabeNaConjunta + 1e-9) {
    const minimo = cabeNaConjunta > 0 ? Math.max(2, Math.ceil(compra.valor / cabeNaConjunta)) : null;
    return {
      veredito: "nao",
      titulo: "Não cabe no que vocês colocam na conta conjunta",
      explicacao: `Com essa parcela, os gastos da conta iriam a ${pct(gastoDepois)} do que entra nela. Faltariam ${money(parcela - cabeNaConjunta)} por mês.`,
      linhas,
      sugestao: minimo && minimo <= 48 && compra.juros === 0 ? `Em ${minimo}x sem juros (${money(compra.valor / minimo)} por mês), cabe no que entra na conta.` : "Vale guardar antes e comprar depois.",
      comparacao,
      custoJuros,
      alertaJuros,
      comprometimento: comprometimento(comprometido + parcela),
      conta,
    };
  }
  if (atrasoReserva > 0) {
    return { veredito: "custo", titulo: "Cabe, mas atrasa sua reserva", explicacao: `A reserva é a sua segurança e passaria a chegar ${atrasoReserva} ${atrasoReserva > 1 ? "meses" : "mês"} depois.`, linhas, sugestao: null, comparacao, custoJuros, alertaJuros, comprometimento: comprometimento(comprometido + parcela), conta };
  }
  if (maiorAtraso && maiorAtraso.meses > 1) {
    return { veredito: "custo", titulo: "Cabe, mas tem um custo", explicacao: `${maiorAtraso.nome} atrasa ${maiorAtraso.meses} meses. A reserva continua no prazo, porque ela é a última a ser mexida.`, linhas, sugestao: null, comparacao, custoJuros, alertaJuros, comprometimento: comprometimento(comprometido + parcela), conta };
  }
  return {
    veredito: jurosAltos ? "custo" : "ok",
    titulo: jurosAltos ? "Cabe no seu limite, mas olha os juros" : doGuardado <= 0 && semDestino > 0 ? "Cabe no dinheiro que ainda não tem destino" : "Cabe sem atrasar o que importa",
    explicacao: maiorAtraso
      ? `${maiorAtraso.nome} atrasa só 1 mês.`
      : temMetas
        ? algumaAtrasada
          ? "Essa compra não muda o prazo das suas metas."
          : "Suas metas continuam no prazo."
        : base.regra90 === false
          ? "Cabe no que vocês colocam na conta conjunta."
          : "Seus gastos continuam dentro da regra dos 90%.",
    linhas,
    sugestao: null,
    comparacao,
    custoJuros,
    alertaJuros,
    comprometimento: comprometimento(comprometido + parcela),
    conta,
  };
}

export type CompraDecidida = { valor: number; modo: "vista" | "parcelado"; parcelas: number; criadaEm: Date };
export type GastoLancado = { valor: number; criadoEm: Date };

/** Folga pro relógio: o gasto lançado logo antes de tocar "Vou comprar" ainda é a mesma compra. */
export const FOLGA_LANCAMENTO_MS = 30 * 60_000;

/** Até quantos meses atrás uma compra parcelada decidida ainda pode estar sendo paga (o máximo que o app simula). */
export const MAX_PARCELAS = 48;

const ehParcelada = (d: CompraDecidida) => d.modo === "parcelado" && d.parcelas > 1;

/** O lançamento que mostra que a compra já está nos números: o valor à vista, ou uma parcela. */
export function valorDoLancamentoEsperado(d: CompraDecidida): number {
  return ehParcelada(d) ? d.valor / d.parcelas : d.valor;
}

/** Tolerância pra reconhecer o lançamento: 1% (arredondamento da loja), no mínimo R$ 1. */
export function toleranciaDoLancamento(esperado: number): number {
  return Math.max(1, esperado * 0.01);
}

/** Meses de calendário, no horário de Brasília, entre o mês da decisão e o mês de `agora`. */
function mesesDesde(criadaEm: Date, agora: Date): number {
  const br = (d: Date) => new Date(d.getTime() - 3 * 3_600_000);
  const a = br(criadaEm);
  const b = br(agora);
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}

/**
 * A compra decidida ainda pesa no mês de `agora`? À vista, só no mês em que foi decidida (no mês
 * seguinte ela já saiu, ou virou lançamento). Parcelada, enquanto durarem as parcelas: a geladeira
 * em 12x decidida no dia 28 não pode sumir da conta no dia 1 só porque o mês virou.
 */
export function compraDecididaEmAberto(d: CompraDecidida, agora: Date): boolean {
  const meses = mesesDesde(d.criadaEm, agora);
  if (meses < 0) return true;
  return ehParcelada(d) ? meses < d.parcelas : meses === 0;
}

/**
 * Das compras que ela decidiu fazer ("Vou comprar"), as que ainda não viraram lançamento: um
 * gasto criado depois da decisão, com o valor da compra (à vista) ou da parcela (parcelado),
 * quer dizer que a compra já está nos números e não pode contar duas vezes. Cada gasto só
 * responde por uma compra.
 *
 * Parcelada que já teve uma parcela lançada (neste mês ou antes) também sai: a fatura dela está
 * sendo importada, então as parcelas já aparecem no gasto do mês e na média dos meses fechados.
 * Com `agora`, também saem as à vista de meses anteriores e as parceladas que já terminaram.
 */
export function comprasAindaNaoLancadas(decididas: CompraDecidida[], gastos: GastoLancado[], agora?: Date): { vista: number; parcelaMensal: number } {
  const usados = new Set<number>();
  let vista = 0;
  let parcelaMensal = 0;
  for (const d of [...decididas].sort((a, b) => a.criadaEm.getTime() - b.criadaEm.getTime())) {
    if (!(d.valor > 0)) continue;
    if (agora && !compraDecididaEmAberto(d, agora)) continue;
    const esperado = valorDoLancamentoEsperado(d);
    const i = gastos.findIndex(
      (g, j) => !usados.has(j) && g.criadoEm.getTime() >= d.criadaEm.getTime() - FOLGA_LANCAMENTO_MS && Math.abs(g.valor - esperado) <= toleranciaDoLancamento(esperado),
    );
    if (i >= 0) {
      usados.add(i);
      continue;
    }
    if (ehParcelada(d)) parcelaMensal += esperado;
    else vista += esperado;
  }
  return { vista, parcelaMensal };
}
