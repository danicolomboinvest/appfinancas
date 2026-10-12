import type { ParentCategory } from "@prisma/client";
import { chaveCobre, chaveDoComerciante, chaveUtil } from "@/lib/import/comerciante";
import { marcaDaDescricao, normalizarDescricao } from "@/lib/marcas/marca";
import { nomeLegivel } from "@/lib/decisoes/raio-x";
import { comercianteDe, ehParcela, type LancamentoParaCacar } from "@/lib/dinheiro-perdido/detectar";

/**
 * Contas do histórico (12/10/2026, pedido da Dani): "quando a pessoa sobe o extrato, eu queria que
 * você mesmo identificasse as contas recorrentes, o Vivo, e já colocasse em contas com a data de
 * vencimento". O app acha no extrato o que é CONTA (telefone, internet, luz, água, gás, aluguel,
 * condomínio, plano de saúde, escola, academia, contabilidade, seguro, boleto mensal de prestador)
 * e devolve com valor e dia deduzidos do histórico. Quem grava é o repositório.
 *
 * Não é conta: parcela (qualquer N/T), Pix para pessoa (salvo aluguel e condomínio escritos),
 * investimento, fatura do cartão, compra do dia a dia (mercado, delivery, Uber), tarifa do banco e
 * assinatura digital (Netflix, Spotify: elas já aparecem em "Assinaturas" na mesma tela).
 *
 * Puro, sem banco.
 */

export type TipoDeConta =
  | "telefone" | "internet" | "luz" | "agua" | "gas" | "aluguel" | "condominio" | "saude" | "escola"
  | "academia" | "contabilidade" | "seguro" | "prestador";

export type ContaAchada = {
  /** Quem cobra, na chave estável do motor ("m:vivo", "contabilidade alfa"): casa com a recusa. */
  chave: string;
  tipo: TipoDeConta;
  nome: string;
  /** O valor da conta: o último (fixa) ou a média dos últimos 3 meses (luz, água, gás, ou varia). */
  valor: number;
  aproximado: boolean;
  /** Dia do vencimento (1 a 31). */
  dia: number;
  categoria: ParentCategory | null;
  /** Em quantos meses apareceu. */
  meses: number;
  /** Os meses ("AAAA-MM") em que a conta foi cobrada: é o que diz se a deste mês já saiu. */
  mesesCobrados: string[];
};

/** Conta clara: 2 meses bastam. As outras precisam de 3. */
const FORTES = new Set<TipoDeConta>(["telefone", "internet", "luz", "agua", "gas", "aluguel", "condominio", "saude", "escola"]);
/** O valor muda todo mês de verdade: aceita variação grande e usa a média dos últimos 3. */
const VARIAVEIS = new Set<TipoDeConta>(["luz", "agua", "gas"]);

const NOME_DO_TIPO: Record<TipoDeConta, string> = {
  telefone: "Celular", internet: "Internet", luz: "Luz", agua: "Água", gas: "Gás", aluguel: "Aluguel", condominio: "Condomínio",
  saude: "Plano de saúde", escola: "Escola", academia: "Academia", contabilidade: "Contabilidade", seguro: "Seguro", prestador: "Conta",
};

/**
 * Quem é quem pelo texto do extrato (sem acento, minúsculo). A ordem importa: plano de saúde antes
 * de seguro ("Porto Seguro Saúde", "Bradesco Saúde"), condomínio antes de aluguel.
 */
const PELO_EXTRATO: [TipoDeConta, RegExp][] = [
  ["saude", /\b(plano de saude|bradesco saude|sulamerica saude|porto seguro saude|notredame|notre dame intermedica|intermedica|hapvida|prevent senior|golden cross|odontoprev|amil|unimed|assim saude|care plus|sami saude|alice saude|qsaude|seguros unimed)\b/],
  ["luz", /\b(enel|cpfl|cemig|copel|light s a|light sa|light energia|conta light|eletropaulo|celesc|coelba|celpe|cosern|coelce|energisa|equatorial|neoenergia|elektro|rge sul|edp|ceee|amazonas energia|energia eletrica|distribuidora de energia|cia energetica)\b/],
  ["agua", /\b(sabesp|sanepar|copasa|cedae|embasa|compesa|caesb|casan|corsan|cagece|saneago|aguas do|aguas de|agua e esgoto|saneamento|daae|saae|cesan|deso|caern|cagepa|aegea|iguá|igua saneamento)\b/],
  ["gas", /\b(comgas|naturgy|gas natural|gasmig|bahiagas|copergas|sulgas|scgas|compagas)\b/],
  ["telefone", /\b(vivo|telefonica|claro movel|claro s a|claro sa|tim s a|tim sa|tim brasil|tim celular|tim movel|oi movel|oi s a|telemar|nextel|algar telecom|surf telecom)\b/],
  ["internet", /\b(internet|fibra|banda larga|provedor|net servicos|net virtua|claro net|claro fibra|oi fibra|vivo fibra|brisanet|desktop sa|desktop s a|ligga|vero internet|sky brasil|sky servicos|sky tv|starlink)\b/],
  ["condominio", /\b(condominio|condominial|cond res|cond edif|edificio|residencial|administradora de condominios|lello|auxiliadora predial)\b/],
  ["aluguel", /\b(aluguel|alugueis|aluguer|imobiliaria|quintoandar|quinto andar|locacao residencial|locacao de imovel)\b/],
  ["escola", /\b(escola|colegio|faculdade|universidade|mensalidade escolar|educacional|ensino|creche|bercario|instituto de educacao|centro universitario)\b/],
  ["academia", /\b(smart fit|smartfit|academia|bluefit|bodytech|selfit|totalpass|gympass|wellhub|crossfit|pilates)\b/],
  ["contabilidade", /\b(contabil|contabilidade|contabeis|contador|contadora|escritorio contabil)\b/],
  ["seguro", /\b(seguro|seguros|seguradora|porto seguro|azul seguros|tokio marine|mapfre|liberty seguros|allianz|hdi seguros|youse|zurich)\b/],
];

/** O que a pessoa escreve no nome de uma conta ("Luz", "Celular", "Plano de saúde"): casa a cadastrada com a achada. */
const PELO_NOME: [TipoDeConta, RegExp][] = [
  ["saude", /\b(plano de saude|plano|convenio|saude|odonto)\b/],
  ["luz", /\b(luz|energia|eletrica)\b/],
  ["agua", /\b(agua|esgoto)\b/],
  ["gas", /\b(gas)\b/],
  ["telefone", /\b(celular|telefone|tel|chip|movel)\b/],
  ["internet", /\b(internet|wifi|wi fi|fibra|tv)\b/],
  ["condominio", /\b(condominio|cond)\b/],
  ["aluguel", /\b(aluguel|apartamento|ape|casa)\b/],
  ["escola", /\b(escola|colegio|faculdade|curso|mensalidade)\b/],
  ["academia", /\b(academia|pilates|crossfit|treino)\b/],
  ["contabilidade", /\b(contabilidade|contador|contadora|contabil)\b/],
  ["seguro", /\b(seguro)\b/],
];

/** A subcategoria do lançamento (o dicionário do app) também diz o tipo. */
const PELA_SUBCATEGORIA: [TipoDeConta, RegExp][] = [
  ["saude", /plano de sa[uú]de|plano odonto|conv[eê]nio/i],
  ["luz", /^(luz|energia)/i],
  ["agua", /^[aá]gua/i],
  ["gas", /^g[aá]s( encanado| natural)?$/i],
  ["telefone", /celular|telefone/i],
  ["internet", /internet|tv por assinatura|tv a cabo/i],
  ["condominio", /condom/i],
  ["aluguel", /aluguel/i],
  ["escola", /escola|faculdade|mensalidade escolar|creche/i],
  ["academia", /academia/i],
  ["contabilidade", /contab/i],
];

/** Marca do catálogo que já diz o tipo. */
const PELA_MARCA: Record<string, TipoDeConta> = {
  vivo: "telefone", claro: "telefone", tim: "telefone", oi: "telefone", sky: "internet",
  enel: "luz", cpfl: "luz", light: "luz", cemig: "luz", sabesp: "agua", comgas: "gas",
  unimed: "saude", amil: "saude", sulamerica: "saude", hapvida: "saude", smartfit: "academia", wellhub: "academia",
};

/** Seguro do cartão, prestamista, perda e roubo: é tarifa do banco (o Dinheiro perdido cuida), não conta. */
const SEGURO_DO_BANCO = /\b(seg cartao|seguro cartao|seguro do cartao|prot cartao|protecao (do )?cartao|cartao protegido|perda e roubo|prestamista|seguro conta|seguro pix|bolsa protegida)\b/;
/** Dinheiro que não é gasto: aplicação, resgate, fatura do cartão, conta própria. */
const NAO_E_GASTO =
  /\b(aplicacao|resgate|caixinha|rdb|cdb|lci|lca|tesouro|pagamento de fatura|pagamento fatura|pgto fatura|pag fatura|fatura do cartao|fatura cartao|fatura nubank|mesma titularidade|entre contas|conta propria|transferencia entre contas|investimento|corretora|previdencia)\b/;
/** Tarifa do banco, juros, IOF: o Dinheiro perdido cuida. */
const TARIFA = /\b(tarifa|tarifas|anuidade|cesta de servicos|pacote de servicos|iof|juros|multa|encargos?|mora|rotativo)\b/;
const CPF = /[•*]{3}\.?\s*\d{3}|\d{3}\.\d{3}\.\d{3}-\d{2}/;
const TRANSFERENCIA = /\b(pix|ted|doc|transf|transferencia)\b/;
const BOLETO = /\b(boleto|bloqueto|titulo|pagamento de conta|pag conta|pagto conta|debito automatico|deb automatico|deb aut)\b/;
/** Dia a dia: mercado, delivery, transporte. Mesmo com o mesmo valor todo mês, não é conta. */
const DIA_A_DIA =
  /\b(mercado|supermercado|supermercados|atacadao|assai|hortifruti|padaria|panificadora|cafe|cafeteria|lanchonete|restaurante|acougue|feira|posto|combustivel|estacionamento|ifood|ifd|rappi|uber|99|cabify|pedagio|sem parar|conectcar|veloe|farmacia|drogaria|drogasil|raia|mcdonalds|burger king)\b/;
/** Assinatura digital: já está em "Assinaturas" na mesma tela. */
const ASSINATURAS_DIGITAIS = new Set([
  "netflix", "spotify", "primevideo", "appletv", "youtube", "icloud", "openai", "amazonprime", "applemusic", "paramountplus",
  "globoplay", "disneyplus", "hbomax", "deezer", "googleone", "youtubepremium", "amazonmusic", "duolingo", "canva", "adobe",
  "tinder", "microsoft365", "apple", "google", "udemy", "coursera", "ifood", "rappi", "uber", "99", "mercadolivre", "amazon",
]);

const MESMO_VALOR = 1.02;
/** Conta fixa que mudou um pouco (reajuste, uma ligação a mais): entra como aproximada. */
const VARIACAO_FIXA = 1.35;
/** Boleto de prestador e conta pela categoria: precisa ser estável de verdade. */
const VARIACAO_PRESTADOR = 1.15;
/** Luz no verão pode dobrar. Mais que 4x já não parece a mesma conta. */
const VARIACAO_VARIAVEL = 4;

const mesDe = (l: { ano: number; mes: number }) => l.ano * 12 + (l.mes - 1);
const mesIso = (m: number) => `${Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, "0")}`;
const mediana = (v: number[]) => {
  const o = [...v].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};
const r2 = (v: number) => Math.round(v * 100) / 100;
const faixa = (v: number[]) => (v.length ? Math.max(...v) / Math.max(0.01, Math.min(...v)) : 1);

function primeiroQueCasa<T>(regras: [T, RegExp][], texto: string): T | null {
  for (const [tipo, re] of regras) if (re.test(texto)) return tipo;
  return null;
}

/** O tipo de conta de um lançamento, ou null se não parece conta. */
export function tipoDoLancamento(l: Pick<LancamentoParaCacar, "descricao" | "categoria" | "subcategoria">): TipoDeConta | null {
  const t = normalizarDescricao(l.descricao ?? "");
  const marca = marcaDaDescricao(l.descricao);
  if (marca && PELA_MARCA[marca.slug]) {
    // Claro e Vivo também vendem internet: "Vivo Fibra" é internet.
    const tipo = PELA_MARCA[marca.slug];
    return tipo === "telefone" && /\b(fibra|internet|net|banda larga|tv)\b/.test(t) ? "internet" : tipo;
  }
  const pelo = primeiroQueCasa(PELO_EXTRATO, t);
  if (pelo === "seguro" && SEGURO_DO_BANCO.test(t)) return null;
  if (pelo) return pelo;
  return primeiroQueCasa(PELA_SUBCATEGORIA, l.subcategoria ?? "");
}

/** O tipo pelo nome que a pessoa deu à conta ("Luz", "Celular da Ana"), ou pelo nome da marca. */
export function tipoDoNome(nome: string): TipoDeConta | null {
  const marca = marcaDaDescricao(nome);
  if (marca && PELA_MARCA[marca.slug]) return PELA_MARCA[marca.slug];
  const t = normalizarDescricao(nome);
  return primeiroQueCasa(PELO_EXTRATO, t) ?? primeiroQueCasa(PELO_NOME, t);
}

type Candidato = LancamentoParaCacar & { tipoDaConta: TipoDeConta | null; pessoa: boolean };

/** O lançamento pode ser conta? Devolve o tipo (ou null para "talvez prestador") e se é Pix para pessoa. */
function candidato(l: LancamentoParaCacar): Candidato | null {
  if (l.tipo !== "EXPENSE" || !(l.valor > 0) || !l.descricao) return null;
  if (l.categoria === "IMPOSTOS" || l.categoria === "ALIMENTACAO" || l.categoria === "TRANSPORTE") return null;
  if (l.subcategoria === "Investimento") return null;
  const t = normalizarDescricao(l.descricao);
  if (NAO_E_GASTO.test(t) || TARIFA.test(t) || ehParcela(l)) return null;
  const marca = marcaDaDescricao(l.descricao);
  if (marca && ASSINATURAS_DIGITAIS.has(marca.slug)) return null;
  const tipo = tipoDoLancamento(l);
  if (!tipo && DIA_A_DIA.test(t)) return null;
  const pessoa = CPF.test(l.descricao);
  // Pix para pessoa: só aluguel e condomínio escritos no extrato ou na subcategoria contam.
  if (pessoa && tipo !== "aluguel" && tipo !== "condominio") return null;
  // Pix ou TED para quem não é conta conhecida: transferência, não conta.
  if (!tipo && TRANSFERENCIA.test(t)) return null;
  // Sem tipo, só boleto mensal de prestador ou conta da casa/saúde/escola pela categoria.
  if (!tipo && !BOLETO.test(t) && !(l.categoria === "MORADIA" || l.categoria === "SAUDE" || l.categoria === "EDUCACAO")) return null;
  return { ...l, tipoDaConta: tipo, pessoa };
}

/**
 * O dia do vencimento: o dia mais frequente. Empate (ou tudo espalhado por fim de semana, 10, 11,
 * 12): o mais cedo do grupo que junta mais cobranças em 3 dias.
 */
export function diaDoVencimento(dias: number[]): number | null {
  if (dias.length === 0) return null;
  const vezes = new Map<number, number>();
  for (const d of dias) vezes.set(d, (vezes.get(d) ?? 0) + 1);
  const grupo = (d: number) => dias.filter((x) => x >= d && x <= d + 3).length;
  return [...vezes.keys()].sort((a, b) => vezes.get(b)! - vezes.get(a)! || grupo(b) - grupo(a) || a - b)[0];
}

/** Acha as contas nos lançamentos (o ideal: os últimos 6 meses). Da maior para a menor. */
export function acharContas(lancamentos: LancamentoParaCacar[]): ContaAchada[] {
  if (lancamentos.length === 0) return [];
  const ultimoMes = Math.max(...lancamentos.map(mesDe));
  const grupos = new Map<string, { itens: Candidato[]; nome: string }>();
  for (const l of lancamentos) {
    const c = candidato(l);
    if (!c) continue;
    const quem = comercianteDe(l);
    if (!quem.chave || (!quem.chave.startsWith("m:") && !chaveUtil(quem.chave))) continue;
    const g = grupos.get(quem.chave) ?? { itens: [], nome: quem.nome };
    g.itens.push(c);
    grupos.set(quem.chave, g);
  }

  const out: ContaAchada[] = [];
  for (const [chave, g] of grupos) {
    // O tipo do grupo: o que mais aparece nas cobranças (uma linha sem subcategoria não desfaz o resto).
    const contagem = new Map<TipoDeConta, number>();
    for (const l of g.itens) if (l.tipoDaConta) contagem.set(l.tipoDaConta, (contagem.get(l.tipoDaConta) ?? 0) + 1);
    const tipo: TipoDeConta = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "prestador";
    const forte = FORTES.has(tipo);

    const porMes = new Map<number, Candidato[]>();
    for (const l of g.itens) porMes.set(mesDe(l), [...(porMes.get(mesDe(l)) ?? []), l]);
    const umaPorMes = [...porMes.values()].filter((v) => v.length === 1).length >= porMes.size * 0.75;
    // Valor do mês: a cobrança mais perto da mediana (a outra é avulsa). Conta clara com duas
    // linhas todo mês (dois celulares na Vivo) soma as duas.
    const tipica = mediana(g.itens.map((l) => l.valor));
    const doMes = new Map<number, { valor: number; itens: Candidato[] }>();
    for (const [m, v] of porMes) {
      if (umaPorMes || v.length === 1) {
        const escolhida = [...v].sort((a, b) => Math.abs(a.valor - tipica) - Math.abs(b.valor - tipica))[0];
        doMes.set(m, { valor: escolhida.valor, itens: [escolhida] });
      } else if (forte) {
        doMes.set(m, { valor: v.reduce((s, l) => s + l.valor, 0), itens: v });
      }
    }
    if (doMes.size === 0) continue;
    const meses = [...doMes.keys()].sort((a, b) => a - b);
    const ultimo = meses[meses.length - 1];
    if (meses.length < (forte ? 2 : 3)) continue;
    // Todo mês (um buraco aqui e ali passa: o extrato de um mês pode não ter sido importado).
    if (meses.length < (ultimo - meses[0] + 1) * 0.75) continue;
    // Parou de cobrar: já não é conta.
    if (ultimo < ultimoMes - 1) continue;

    const valores = meses.map((m) => doMes.get(m)!.valor);
    const ultimos3 = valores.slice(-3);
    const media3 = ultimos3.reduce((s, v) => s + v, 0) / ultimos3.length;
    let valor: number;
    let aproximado: boolean;
    if (VARIAVEIS.has(tipo)) {
      if (faixa(ultimos3) > VARIACAO_VARIAVEL) continue;
      aproximado = faixa(ultimos3) > MESMO_VALOR;
      valor = aproximado ? media3 : valores[valores.length - 1];
    } else if (faixa(valores.slice(-2)) <= MESMO_VALOR) {
      // Reajuste: o último valor se repetiu, é o de agora.
      valor = valores[valores.length - 1];
      aproximado = false;
    } else if (faixa(ultimos3) <= (forte || tipo === "academia" || tipo === "contabilidade" || tipo === "seguro" ? VARIACAO_FIXA : VARIACAO_PRESTADOR)) {
      valor = media3;
      aproximado = true;
    } else {
      continue;
    }

    const cobrancas = meses.flatMap((m) => doMes.get(m)!.itens);
    const dias = cobrancas.map((l) => (l.data ? Number(l.data.slice(8, 10)) : null)).filter((d): d is number => d !== null);
    const dia = diaDoVencimento(dias);
    if (dia === null) continue;

    const exemplo = doMes.get(ultimo)!.itens[0];
    const marca = marcaDaDescricao(exemplo.descricao);
    // Pix para o dono do apartamento: o nome é "Aluguel", não o nome da pessoa.
    const nome = cobrancas.some((l) => l.pessoa)
      ? NOME_DO_TIPO[tipo]
      : marca && !marca.baixa
        ? marca.nome
        : nomeLegivel(exemplo.descricao ?? g.nome) || NOME_DO_TIPO[tipo];
    const categorias = cobrancas.map((l) => l.categoria).filter((c): c is string => Boolean(c));
    const categoria = (categorias.length ? modaDe(categorias) : null) as ParentCategory | null;
    out.push({ chave, tipo, nome: nome.slice(0, 80), valor: r2(valor), aproximado, dia, categoria, meses: meses.length, mesesCobrados: meses.map(mesIso) });
  }
  return out.sort((a, b) => b.valor - a.valor);
}

function modaDe(v: string[]): string {
  const n = new Map<string, number>();
  for (const x of v) n.set(x, (n.get(x) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/** A conta que a pessoa já tem (a cadastrada por ela ou uma achada antes). */
export type ContaExistente = { nome: string; valor: number | null; chaveDoHistorico?: string | null };

/**
 * A achada já está cadastrada? Pela chave (achada antes), pela marca ou pelo nome do comerciante
 * ("Vivo" cadastrada casa com a "VIVO SP" do extrato), ou pelo tipo com valor parecido ("Luz" de
 * R$ 150 casa com a Enel de R$ 162).
 */
export function jaCadastrada(achada: Pick<ContaAchada, "chave" | "nome" | "tipo" | "valor">, contas: ContaExistente[]): boolean {
  const marcaDaAchada = achada.chave.startsWith("m:") ? achada.chave.slice(2) : (marcaDaDescricao(achada.nome)?.slug ?? null);
  const comerciante = achada.chave.startsWith("m:") ? "" : achada.chave;
  for (const c of contas) {
    if (c.chaveDoHistorico && c.chaveDoHistorico === achada.chave) return true;
    const marca = marcaDaDescricao(c.nome);
    if (marcaDaAchada && marca && marca.slug === marcaDaAchada) return true;
    const k = chaveDoComerciante(c.nome);
    if (comerciante && k && chaveUtil(k) && (chaveCobre(k, comerciante) || chaveCobre(comerciante, k))) return true;
    if (normalizarDescricao(c.nome) === normalizarDescricao(achada.nome)) return true;
    if (achada.tipo !== "prestador" && tipoDoNome(c.nome) === achada.tipo) {
      if (c.valor === null) return true;
      const r = Math.max(c.valor, achada.valor) / Math.max(0.01, Math.min(c.valor, achada.valor));
      if (r <= 1.5) return true;
    }
  }
  return false;
}

/**
 * O próximo vencimento: o dia dela neste mês, se ainda não passou e a deste mês ainda não saiu no
 * extrato; senão, o do mês que vem. O dia 31 vira o último dia nos meses mais curtos.
 */
export function proximoVencimento(dia: number, hoje: Date, mesesCobrados: string[]): Date {
  const noMes = (ano: number, mes: number) => {
    const ultimo = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
    return new Date(Date.UTC(ano, mes, Math.min(dia, ultimo)));
  };
  const ano = hoje.getUTCFullYear();
  const mes = hoje.getUTCMonth();
  const deste = noMes(ano, mes);
  const jaSaiu = mesesCobrados.includes(`${ano}-${String(mes + 1).padStart(2, "0")}`);
  if (!jaSaiu && deste.getTime() >= hoje.getTime()) return deste;
  return noMes(ano, mes + 1);
}

/** A assinatura da tela ("Smart Fit") é a mesma cobrança de uma conta? Para não mostrar duas vezes. */
export function mesmaCobranca(nomeDaAssinatura: string, contas: ContaExistente[]): boolean {
  const marca = marcaDaDescricao(nomeDaAssinatura);
  const k = chaveDoComerciante(nomeDaAssinatura);
  return contas.some((c) => {
    const m = marcaDaDescricao(c.nome);
    if (marca && m && marca.slug === m.slug) return true;
    if (c.chaveDoHistorico && marca && c.chaveDoHistorico === `m:${marca.slug}`) return true;
    const kc = chaveDoComerciante(c.nome);
    return Boolean(k && kc && chaveUtil(k) && (k === kc || (c.chaveDoHistorico ?? "") === k));
  });
}
