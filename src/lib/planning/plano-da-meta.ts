import type { EstadoDaAssinatura } from "@/lib/assinaturas/regra";
import { nomeBase } from "@/lib/contas/assinaturas";
import { chaveRaioX } from "@/lib/decisoes/raio-x";
import { parseInstallment } from "@/lib/entries/recurrence";
import { pareceEstorno } from "@/lib/import/estorno";
import { marcaDaDescricao, normalizarDescricao } from "@/lib/marcas/marca";
import { MESES_CURTOS, TAXA_PADRAO_DAS_METAS, porMesDaNovaMeta } from "@/lib/metas/projecao";
import { prazoQueCabe, type PrazoSugerido } from "@/lib/metas/prazo-que-cabe";
import { formatMoney } from "@/lib/money";
import { ehNaoGasto } from "./nao-e-gasto";
import { NUNCA_SUGERIR } from "./remanejo";

/**
 * "Como vou juntar?" (16/10/2026, protótipo plano-da-meta.html aprovado pela Dani com condições).
 *
 * Um botão nas Metas que monta um plano com os gastos da pessoa: quanto a meta pede por mês,
 * quanto já sobra, e "coisinhas" dos gastos dela para reduzir até a meta caber. Ela escolhe.
 *
 * A REGRA, inteira, aqui:
 *
 * 1. Quanto a meta pede por mês: `porMesDaNovaMeta` (a mesma conta da folha da meta).
 * 2. Quanto sobra hoje por mês: renda média dos 12 meses fechados (`mediaDaRenda`) menos o gasto
 *    típico dos meses fechados (`getTypicalMonthlyExpense`) menos os aportes já combinados (o
 *    "por mês" das outras metas em andamento e o da reserva enquanto ela não está completa). A
 *    meta que está sendo planejada nunca entra nos aportes (contaria duas vezes). A sobra é
 *    arredondada para baixo de R$ 10 em R$ 10, e o que falta é o que a meta pede menos ela.
 * 3. Coisinhas, só dos lançamentos de quem olha, nos 3 meses fechados:
 *    - assinaturas que ela marcou para cancelar ("Vou cancelar" no Raio-X ou "Não uso" no Dinheiro
 *      perdido), pelo estado único de lib/assinaturas, e que cobraram em algum dos meses;
 *    - delivery (subcategoria Delivery ou marca: iFood, Rappi, Uber Eats, Zé Delivery...), uma
 *      coisinha por marca;
 *    - corrida de app (subcategoria Aplicativo ou Uber e 99, nunca ônibus e metrô);
 *    - compras de loja e e-commerce (Shein, Shopee, Mercado Livre, Amazon, Renner...);
 *    - lazer sem streaming (e sem nenhuma assinatura).
 *    Nunca: Moradia, Saúde, Educação, Impostos, mercado, transporte público, contas fixas,
 *    parcelas (já estão compradas), o que não é gasto (aplicação, pagamento de fatura) e
 *    transferência para pessoa.
 * 4. O valor de cada coisinha é a MEDIANA dos meses fechados com dados (mês sem gasto nela conta
 *    zero). Só vira sugestão com pelo menos R$ 30 por mês e presença em pelo menos 2 dos 3 meses
 *    (com 2 meses de dados, nos 2). A sugestão reduz pela metade, arredondada para cima de R$ 10 em
 *    R$ 10. A assinatura é a exceção: ou fica ou cancela, e entra com qualquer valor porque foi
 *    ela mesma que marcou.
 * 5. A ordem é a do remanejo (memória regra-remanejo-prioridade): desejo primeiro (assinaturas,
 *    depois compras e lazer, o de maior economia antes), dia a dia depois (delivery e corrida,
 *    com a etiqueta "do dia a dia"). No casal simples, o gasto da casa vai depois do que é só dela.
 * 6. Quando as coisinhas não fecham: mais prazo (`prazoQueCabe`) e meta menor (o maior valor, de
 *    R$ 100 em R$ 100, que cabe no prazo dela). Ver os limites em LIMITES.
 *
 * Puro, sem banco: quem chama traz a renda, o gasto típico, os aportes, os lançamentos e as
 * assinaturas com o estado único já resolvido.
 */

/* ---------------------------------------------------------------- tipos */

export type LancamentoDoPlano = {
  ano: number;
  mes: number;
  /** Positivo, na moeda do perfil. Negativo (estorno) abate do mês. */
  valor: number;
  /** A categoria-mãe (MORADIA, LAZER...) ou null na categoria criada por ela. */
  categoria: string | null;
  /** A categoria criada por ela, quando é o caso. */
  categoriaPropria?: { nome: string; essencial?: boolean } | null;
  subcategoria: string | null;
  descricao: string | null;
  /** Casal simples: gasto da casa (a decisão de reduzir é dos dois). */
  daCasa?: boolean;
  /** Conta fixa: "Repetir todo mês" (recurrenceId) ou o "Paguei" de uma conta das Recorrentes. */
  fixa?: boolean;
};

export type AssinaturaDoPlano = {
  nome: string;
  /** Quanto cobra por mês. */
  mensal: number;
  estado: EstadoDaAssinatura;
  /** As marcas da regra única ("c:", "n:", "r:"): servem para juntar repetidas e tirar dos outros grupos. */
  marcas: string[];
  /** Em quantos dos meses fechados do plano ela cobrou. */
  mesesCobrados: number;
  /** O logo, quando o catálogo conhece. */
  marca?: string | null;
  daCasa?: boolean;
};

export type EntradaDoPlano = {
  hoje: Date;
  perfil: { tipo: string; moeda: string };
  meta: { alvo: number; guardado: number; prazo: Date | null; taxaAnual?: number | null };
  /** Média mensal da renda (12 meses fechados), ou null sem renda lançada. */
  rendaMedia: number | null;
  /** De quantos meses é essa média (1 a 12). */
  rendaMeses?: number;
  /** Gasto típico dos meses fechados, ou null sem nenhum. */
  gastoTipico: { media: number; meses: number } | null;
  /** O "por mês" que ela já combinou nas outras metas e na reserva. */
  aportesCombinados: number;
  /** Lançamentos de GASTO de quem olha, pelo menos os 3 meses fechados. */
  lancamentos: LancamentoDoPlano[];
  assinaturas: AssinaturaDoPlano[];
};

export type TipoDaCoisinha = "assinatura" | "delivery" | "corrida" | "compras" | "lazer";

export type Coisinha = {
  id: string;
  tipo: TipoDaCoisinha;
  nome: string;
  /** O slug do logo (catálogo de marcas), ou null: a tela usa o ícone do tipo. */
  marca: string | null;
  /** Quanto é hoje por mês (a mediana; na assinatura, a cobrança). */
  hoje: number;
  /** O novo teto por mês (0 = cancelar). */
  para: number;
  economia: number;
  acao: "cancelar" | "reduzir";
  /** 1 = desejo, 2 = do dia a dia (delivery e corrida). */
  nivel: 1 | 2;
  /** Em quantos dos meses fechados apareceu. */
  meses: number;
  /** Quantas vezes por mês, na mediana (pedidos, corridas, compras). */
  vezesPorMes: number;
  /** As lojas por trás de "Compras" (só nomes de marca do catálogo). */
  lojas: string[];
  daCasa: boolean;
};

export type MotivoSemPlano = "empresa" | "moeda" | "meta_concluida";

export type Situacao =
  /** O que sobra já paga a meta: nem precisa de plano. */
  | "ja_cabe"
  /** As coisinhas fecham o que falta. */
  | "fecha"
  /** Nem com todas as coisinhas: aparecem as alternativas. */
  | "nao_fecha"
  /** Nenhuma coisinha: só as alternativas. */
  | "sem_coisinhas"
  /** Menos de 2 meses fechados com gasto: só o que a meta pede. */
  | "poucos_dados"
  /** Meta sem data: o plano diz quando chega com a sobra e com as coisinhas. */
  | "sem_prazo";

export type Alternativas = {
  /** Chegar mais tarde guardando o que dá; null quando passa do limite. */
  prazo: (PrazoSugerido & { porMes: number }) | null;
  /** Meta menor no mesmo prazo; null quando fica pequena demais. */
  metaMenor: { alvo: number; porMes: number } | null;
  /**
   * Quando nem prazo nem meta menor cabem nos limites: guardar o que dá por mês (de R$ 10 em R$ 10)
   * e o app refaz a conta depois. Null quando não sobra nada.
   */
  oQueDa: number | null;
};

export type PlanoDaMeta =
  | { mostra: false; motivo: MotivoSemPlano }
  | {
      mostra: true;
      situacao: Situacao;
      /** "out/2027", ou null sem prazo. */
      prazoTexto: string | null;
      /** O que a meta pede por mês (null sem prazo). */
      pede: number | null;
      /** A sobra de hoje (renda - gasto - aportes), sem arredondar; null sem renda ou sem gasto. */
      sobraBruta: number | null;
      /** A sobra que entra na conta: de R$ 10 em R$ 10, nunca negativa. */
      sobra: number;
      /** Quanto falta achar por mês (0 quando já cabe). */
      falta: number;
      coisinhas: Coisinha[];
      /** Soma de todas as coisinhas. */
      achado: number;
      /** Quantas coisinhas, na ordem, fecham (0 quando não fecha ou nem precisa). */
      fechaCom: number;
      /** Para o caso de todas as coisinhas juntas (null quando fecha ou já cabe). */
      alternativas: Alternativas | null;
      /** Sem prazo: quando chega com a sobra, e com sobra + coisinhas. */
      semPrazo: { comSobra: PrazoSugerido | null; comCoisinhas: PrazoSugerido | null } | null;
      avisos: AvisoDoPlano[];
      mesesDeDados: number;
    };

export type AvisoDoPlano = "sem_renda" | "renda_de_um_mes" | "sobra_negativa" | "dois_meses" | "prazo_vencido";

/* ---------------------------------------------------------------- limites */

export const LIMITES = {
  /** Coisinha que reduz: pelo menos isso por mês. */
  minimoPorMes: 30,
  /** E em pelo menos tantos dos meses fechados (com menos meses de dados, em todos). */
  minimoDeMeses: 2,
  /** Meses fechados que o plano olha. */
  meses: 3,
  /** Meses fechados com gasto para ter plano. */
  minimoDeMesesDeDados: 2,
} as const;

/* ---------------------------------------------------------------- utilitários */

const reais = (v: number) => Math.round(v * 100) / 100;
const baixo10 = (v: number) => Math.floor(v / 10) * 10;
/** A metade, arredondada para cima de R$ 10 em R$ 10. */
export const metadeArredondada = (v: number) => Math.ceil(v / 2 / 10) * 10;

function mediana(v: number[]): number {
  if (v.length === 0) return 0;
  const o = [...v].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

/** Os N meses fechados antes do mês de `hoje`, do mais antigo ao mais recente. */
export function mesesFechados(hoje: Date, n: number = LIMITES.meses): { ano: number; mes: number }[] {
  const out: { ano: number; mes: number }[] = [];
  for (let i = n; i >= 1; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    out.push({ ano: d.getFullYear(), mes: d.getMonth() + 1 });
  }
  return out;
}

const texto = (d: string | null | undefined) => ` ${normalizarDescricao(d ?? "")} `;

/* ---------------------------------------------------------------- quem é cada lançamento */

/** Delivery: marca conhecida (o nome que aparece) ou a subcategoria. */
const DELIVERY: { re: RegExp; id: string; nome: string; marca: string | null }[] = [
  { re: / uber ?eats /, id: "ubereats", nome: "Uber Eats", marca: null },
  { re: / (ifood|ifd) /, id: "ifood", nome: "iFood", marca: "ifood" },
  { re: / rappi /, id: "rappi", nome: "Rappi", marca: "rappi" },
  { re: / 99 ?food /, id: "99food", nome: "99Food", marca: null },
  { re: / ze delivery /, id: "zedelivery", nome: "Zé Delivery", marca: null },
  { re: / aiqfome /, id: "aiqfome", nome: "aiqfome", marca: null },
  { re: / keeta /, id: "keeta", nome: "Keeta", marca: null },
];

/** Corrida de app. Ônibus, metrô e trem nunca (são transporte público). */
const CORRIDA: { re: RegExp; nome: string }[] = [
  { re: / uber /, nome: "Uber" },
  { re: / 99 ?(app|pop|taxi|taxis|tecnologia|ride|corridas?) | 99app | 99pop /, nome: "99" },
  { re: / (indrive|indriver|cabify) /, nome: "inDrive" },
];
const TRANSPORTE_PUBLICO = / (onibus|metro|trem|bilhete unico|sptrans|riocard|cptm|brt|passagem) /;

/** Lojas e e-commerce (slugs do catálogo de marcas) e as que o catálogo não tem logo. */
const LOJAS = new Set(["shein", "shopee", "amazon", "mercadolivre", "magalu", "americanas", "aliexpress", "casasbahia", "renner", "riachuelo", "cea", "zara", "netshoes", "centauro", "havaianas", "sephora", "natura", "oboticario"]);
const LOJAS_SEM_LOGO: { re: RegExp; nome: string }[] = [
  { re: / temu /, nome: "Temu" },
  { re: / (hering|marisa|pernambucanas) /, nome: "Loja de roupa" },
];
/** Categoria criada por ela que é compra (Roupas, Compras, Beleza...). */
const CATEGORIA_DE_COMPRAS = /\b(compras?|roupas?|shopping|vestuario|acessorios)\b/;
/** O que não é compra de loja mesmo vindo da loja: mercado e farmácia. */
const SUB_ESSENCIAL = new Set(["Supermercado", "Farmácia", "Transporte público", "Combustível"]);

/** Streaming e as assinaturas clássicas: nunca entram no lazer (seriam cortadas pela metade). */
const MARCAS_DE_ASSINATURA = new Set(["netflix", "spotify", "primevideo", "appletv", "youtube", "icloud", "openai", "amazonprime", "applemusic", "paramountplus", "globoplay", "disneyplus", "hbomax", "deezer", "googleone", "youtubepremium", "amazonmusic", "duolingo", "canva", "adobe", "tinder", "sky", "microsoft365", "wellhub", "smartfit"]);

const ehParcela = (d: string | null) => !!d && (/\bparc(ela)?(?=\b|\d)/i.test(d) || parseInstallment(d) !== null);
/** Pix, TED e transferência para uma pessoa não é "coisinha" (pode ser aluguel, mesada, dívida). */
const ehTransferencia = (t: string) => / (pix|ted|doc|transferencia|transf) /.test(t);
/** Marcas do catálogo que são o JEITO de pagar, não a loja: "Pix enviado" não é compra em loja. */
const MEIOS_DE_PAGAMENTO = new Set(["pix", "visa", "mastercard", "elo", "mercadopago", "picpay", "nubank"]);

/** Até 15% de diferença ainda é a cobrança da assinatura (a mesma folga do Raio-X). */
const FOLGA_DA_ASSINATURA = 0.15;

type Grupo = { tipo: Exclude<TipoDaCoisinha, "assinatura">; id: string; nome: string; marca: string | null; nivel: 1 | 2 };

/**
 * As cobranças de assinatura conhecidas, pela chave do Raio-X: chave -> valores por mês. Um
 * lançamento só é "da assinatura" quando a chave bate E o valor também (até 15%): o "iFood Clube"
 * marcado para cancelar não pode levar junto todos os pedidos do iFood.
 */
export type CobrancasDeAssinatura = ReadonlyMap<string, readonly number[]>;

export function cobrancasDeAssinatura(assinaturas: readonly AssinaturaDoPlano[]): Map<string, number[]> {
  const m = new Map<string, number[]>();
  for (const a of assinaturas) {
    for (const marca of a.marcas) {
      if (!marca.startsWith("r:")) continue;
      const k = marca.slice(2);
      m.set(k, [...(m.get(k) ?? []), a.mensal]);
    }
  }
  return m;
}

function ehCobrancaDeAssinatura(l: LancamentoDoPlano, cobrancas: CobrancasDeAssinatura): boolean {
  if (!l.descricao) return false;
  const valores = cobrancas.get(chaveRaioX(l.descricao));
  if (!valores) return false;
  return valores.some((v) => v > 0 && Math.abs(Math.abs(l.valor) - v) <= v * FOLGA_DA_ASSINATURA);
}

/**
 * Em que coisinha este lançamento entra (null = em nenhuma). `cobrancas`: as assinaturas
 * conhecidas (todas, não só as para cancelar), para nenhuma ser cortada pela metade como lazer.
 */
export function grupoDoLancamento(l: LancamentoDoPlano, cobrancas: CobrancasDeAssinatura = new Map()): Grupo | null {
  if (l.categoria && NUNCA_SUGERIR.has(l.categoria)) return null;
  if (!l.categoria && l.categoriaPropria?.essencial) return null;
  if (l.fixa) return null;
  if (ehNaoGasto({ subcategory: l.subcategoria, description: l.descricao })) return null;
  if (ehParcela(l.descricao)) return null;
  if (l.subcategoria && SUB_ESSENCIAL.has(l.subcategoria)) return null;
  if (l.subcategoria === "Streaming") return null;
  if (ehCobrancaDeAssinatura(l, cobrancas)) return null;
  const t = texto(l.descricao);
  const achada = marcaDaDescricao(l.descricao);
  const marca = achada && !MEIOS_DE_PAGAMENTO.has(achada.slug) ? achada : null;
  if (marca && MARCAS_DE_ASSINATURA.has(marca.slug)) return null;

  // Delivery: pela marca em qualquer categoria que pode (Uber Eats em Transporte ainda é comida),
  // ou pela subcategoria.
  const d = DELIVERY.find((x) => x.re.test(t));
  if (d) return { tipo: "delivery", id: `delivery:${d.id}`, nome: d.nome, marca: d.marca, nivel: 2 };
  if (l.categoria === "ALIMENTACAO" && l.subcategoria === "Delivery") return { tipo: "delivery", id: "delivery:outros", nome: "Delivery", marca: null, nivel: 2 };

  // Corrida de app (nunca ônibus, metrô e trem).
  if (l.categoria === "TRANSPORTE" || l.categoria === "OUTROS" || l.categoria === null) {
    if (!TRANSPORTE_PUBLICO.test(t) && (CORRIDA.some((c) => c.re.test(t)) || (l.categoria === "TRANSPORTE" && l.subcategoria === "Aplicativo"))) {
      return { tipo: "corrida", id: "corrida", nome: "Corridas de app", marca: null, nivel: 2 };
    }
  }
  // O resto de Alimentação (mercado, restaurante, padaria) e de Transporte não entra.
  if (l.categoria === "TRANSPORTE" || l.categoria === "ALIMENTACAO") return null;

  // Compras de loja e e-commerce: a marca da loja, ou a categoria dela de compras (sem Pix para
  // pessoa, que pode ser qualquer coisa).
  if ((marca && LOJAS.has(marca.slug)) || LOJAS_SEM_LOGO.some((x) => x.re.test(t))) {
    return { tipo: "compras", id: "compras", nome: "Compras", marca: null, nivel: 1 };
  }
  if (ehTransferencia(t)) return null;
  if (!l.categoria && l.categoriaPropria && CATEGORIA_DE_COMPRAS.test(normalizarDescricao(l.categoriaPropria.nome))) {
    return { tipo: "compras", id: "compras", nome: "Compras", marca: null, nivel: 1 };
  }

  // Lazer sem streaming (e sem viagem: é planejada, não hábito do mês).
  if (l.categoria === "LAZER" && l.subcategoria !== "Viagens") {
    return { tipo: "lazer", id: "lazer", nome: "Lazer", marca: null, nivel: 1 };
  }
  return null;
}

/** O nome das lojas por trás de "Compras" (só marcas do catálogo, nunca a descrição). */
function nomeDaLoja(d: string | null): string | null {
  const m = marcaDaDescricao(d);
  if (m && LOJAS.has(m.slug)) return m.nome;
  const t = texto(d);
  return LOJAS_SEM_LOGO.find((x) => x.re.test(t))?.nome ?? null;
}

/** O nome da corrida pelas marcas que apareceram: "Uber e 99", "Uber", "Corridas de app". */
function nomeDaCorrida(descricoes: (string | null)[]): string {
  const nomes = new Set<string>();
  for (const d of descricoes) {
    const t = texto(d);
    const c = CORRIDA.find((x) => x.re.test(t));
    if (c) nomes.add(c.nome);
  }
  const l = CORRIDA.map((c) => c.nome).filter((n) => nomes.has(n));
  if (l.length === 1) return l[0];
  if (l.length === 2) return `${l[0]} e ${l[1]}`;
  return "Corridas de app";
}

/* ---------------------------------------------------------------- as coisinhas */

/**
 * As coisinhas dos gastos, já na ordem do plano. Sem nenhuma, lista vazia.
 */
export function coisinhasDosGastos(e: Pick<EntradaDoPlano, "hoje" | "lancamentos" | "assinaturas">): { coisinhas: Coisinha[]; mesesDeDados: number } {
  const janela = mesesFechados(e.hoje);
  const chaveDoMes = (a: number, m: number) => a * 12 + m;
  const naJanela = new Set(janela.map((m) => chaveDoMes(m.ano, m.mes)));
  const lancs = e.lancamentos.filter((l) => naJanela.has(chaveDoMes(l.ano, l.mes)));
  // Mês com dados: algum gasto lançado nele.
  const comDados = janela.filter((m) => lancs.some((l) => l.ano === m.ano && l.mes === m.mes && l.valor > 0));
  const mesesDeDados = comDados.length;
  const minimoDeMeses = Math.min(LIMITES.minimoDeMeses, mesesDeDados);

  const cobrancas = cobrancasDeAssinatura(e.assinaturas);

  type Acc = { g: Grupo; porMes: Map<number, number>; vezes: Map<number, number>; descricoes: (string | null)[]; lojas: Map<string, number>; daCasa: number; total: number };
  const grupos = new Map<string, Acc>();
  for (const l of lancs) {
    const g = grupoDoLancamento(l, cobrancas);
    if (!g) continue;
    // Estorno ou reembolso lançado como gasto positivo abate o mês, não soma.
    const valor = l.valor > 0 && pareceEstorno(l.descricao) ? -l.valor : l.valor;
    const acc: Acc = grupos.get(g.id) ?? { g, porMes: new Map(), vezes: new Map(), descricoes: [], lojas: new Map(), daCasa: 0, total: 0 };
    const k = chaveDoMes(l.ano, l.mes);
    acc.porMes.set(k, (acc.porMes.get(k) ?? 0) + valor);
    if (valor > 0) acc.vezes.set(k, (acc.vezes.get(k) ?? 0) + 1);
    acc.descricoes.push(l.descricao);
    const loja = g.tipo === "compras" ? nomeDaLoja(l.descricao) : null;
    if (loja) acc.lojas.set(loja, (acc.lojas.get(loja) ?? 0) + valor);
    if (l.daCasa) acc.daCasa += valor;
    acc.total += valor;
    grupos.set(g.id, acc);
  }

  const out: Coisinha[] = [];
  for (const acc of grupos.values()) {
    const valores = comDados.map((m) => Math.max(0, acc.porMes.get(chaveDoMes(m.ano, m.mes)) ?? 0));
    const meses = valores.filter((v) => v > 0).length;
    // Um pagamento só por mês, com o mesmo valor (até 15%): é mensalidade fixa (clube, aula), não
    // hábito. Não dá para "reduzir pela metade".
    const vezes = comDados.map((m) => acc.vezes.get(chaveDoMes(m.ano, m.mes)) ?? 0);
    const positivos = valores.filter((v) => v > 0);
    if ((acc.g.tipo === "lazer" || acc.g.tipo === "compras") && meses >= 2 && vezes.every((v) => v <= 1) && Math.max(...positivos) <= Math.min(...positivos) * (1 + FOLGA_DA_ASSINATURA)) continue;
    const hoje = Math.round(mediana(valores));
    if (meses < minimoDeMeses || hoje < LIMITES.minimoPorMes) continue;
    const para = metadeArredondada(hoje);
    const economia = hoje - para;
    if (economia <= 0) continue;
    const vezesPorMes = Math.round(mediana(comDados.map((m) => acc.vezes.get(chaveDoMes(m.ano, m.mes)) ?? 0)));
    const lojas = [...acc.lojas.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n);
    out.push({
      id: acc.g.id,
      tipo: acc.g.tipo,
      nome: acc.g.tipo === "corrida" ? nomeDaCorrida(acc.descricoes) : acc.g.nome,
      marca: acc.g.tipo === "corrida" ? marcaDaCorrida(acc.descricoes) : acc.g.marca,
      hoje,
      para,
      economia,
      acao: "reduzir",
      nivel: acc.g.nivel,
      meses,
      vezesPorMes,
      lojas,
      daCasa: acc.total > 0 && acc.daCasa / acc.total > 0.5,
    });
  }

  // Assinaturas que ela marcou para cancelar e que ainda cobram. A mesma assinatura (marca em
  // comum ou o mesmo nome) entra uma vez só.
  const assinaturas: Coisinha[] = [];
  const vistas: { marcas: string[]; nome: string }[] = [];
  const candidatas = e.assinaturas.filter((a) => a.estado === "para_cancelar" && a.mesesCobrados > 0 && a.mensal > 0).sort((a, b) => b.mensal - a.mensal);
  for (const a of candidatas) {
    const nb = nomeBase(a.nome);
    if (vistas.some((v) => v.nome === nb || v.marcas.some((m) => a.marcas.includes(m)))) continue;
    vistas.push({ marcas: a.marcas, nome: nb });
    const mensal = reais(a.mensal);
    assinaturas.push({
      id: `assinatura:${nb || assinaturas.length}`,
      tipo: "assinatura",
      nome: a.nome,
      marca: a.marca ?? null,
      hoje: mensal,
      para: 0,
      economia: mensal,
      acao: "cancelar",
      nivel: 1,
      meses: a.mesesCobrados,
      vezesPorMes: 1,
      lojas: [],
      daCasa: !!a.daCasa,
    });
  }

  // Ordem do remanejo: desejo (assinaturas, depois o de maior economia), dia a dia depois. O que
  // é da casa vai depois do que é só dela, dentro do mesmo nível.
  const porEconomia = (a: Coisinha, b: Coisinha) => Number(a.daCasa) - Number(b.daCasa) || b.economia - a.economia;
  const nivel1 = out.filter((c) => c.nivel === 1).sort(porEconomia);
  const nivel2 = out.filter((c) => c.nivel === 2).sort(porEconomia);
  // A assinatura com a mesma marca de outra coisinha ("iFood" o clube e "iFood" os pedidos) leva
  // "(assinatura)" no nome: duas linhas iguais com valores diferentes confundem.
  const marcasDosGastos = new Set(out.map((c) => c.marca).filter(Boolean));
  for (const a of assinaturas) if (a.marca && (marcasDosGastos.has(a.marca) || [...marcasDosGastos].some((m) => (m as string).split("+").includes(a.marca as string)))) a.nome = `${a.nome} (assinatura)`;
  return { coisinhas: [...assinaturas.sort(porEconomia), ...nivel1, ...nivel2], mesesDeDados };
}

function marcaDaCorrida(descricoes: (string | null)[]): string | null {
  const nomes = new Set(descricoes.map((d) => CORRIDA.find((x) => x.re.test(texto(d)))?.nome).filter(Boolean));
  if (nomes.size === 1 && nomes.has("Uber")) return "uber";
  if (nomes.size === 1 && nomes.has("99")) return "99";
  if (nomes.size === 2 && nomes.has("Uber") && nomes.has("99")) return "uber+99";
  return null;
}

/* ---------------------------------------------------------------- as alternativas */

export const textoDoPrazo = (d: Date) => `${MESES_CURTOS[d.getMonth()]}/${d.getFullYear()}`;

/**
 * Quando não fecha, guardando `disponivel` por mês: chegar mais tarde, ou uma meta menor no mesmo
 * prazo. Cada uma some quando passa do limite (LIMITES_DAS_ALTERNATIVAS).
 */
export function alternativasPara(meta: EntradaDoPlano["meta"], disponivel: number, hoje: Date): Alternativas {
  const taxa = meta.taxaAnual ?? TAXA_PADRAO_DAS_METAS;
  if (!(disponivel > 0) || !meta.prazo) return { prazo: null, metaMenor: null, oQueDa: null };
  const p = prazoQueCabe({ alvo: meta.alvo, guardado: meta.guardado, porMes: disponivel, taxaAnual: taxa, hoje });
  let prazo: Alternativas["prazo"] = null;
  if (p) {
    const data = new Date(p.ano, p.mes - 1, 1, 12);
    const porMes = porMesDaNovaMeta(meta.alvo, data, hoje, taxa, meta.guardado);
    const escolhido = (meta.prazo.getFullYear() - hoje.getFullYear()) * 12 + meta.prazo.getMonth() - hoje.getMonth();
    const teto = Math.min(LIMITES_DAS_ALTERNATIVAS.prazoMaximoEmMeses, Math.max(1, escolhido) * LIMITES_DAS_ALTERNATIVAS.prazoMaximoEmVezes);
    if (p.meses <= teto) prazo = { ...p, porMes };
  }
  // Meta menor: o maior alvo, de R$ 100 em R$ 100, que cabe no prazo dela com o disponível.
  const cabe = (alvo: number) => porMesDaNovaMeta(alvo, meta.prazo as Date, hoje, taxa, meta.guardado) <= disponivel;
  let lo = Math.ceil(meta.guardado / 100) * 100;
  let hi = Math.floor(meta.alvo / 100) * 100;
  let melhor: number | null = null;
  while (lo <= hi) {
    const meio = Math.floor((lo + hi) / 200) * 100;
    if (cabe(meio)) {
      melhor = meio;
      lo = meio + 100;
    } else hi = meio - 100;
  }
  let metaMenor: Alternativas["metaMenor"] = null;
  if (melhor !== null && melhor < meta.alvo && melhor > meta.guardado) {
    const ok = melhor >= meta.alvo * LIMITES_DAS_ALTERNATIVAS.metaMenorMinima && melhor >= LIMITES_DAS_ALTERNATIVAS.metaMenorEmReais;
    if (ok) metaMenor = { alvo: melhor, porMes: porMesDaNovaMeta(melhor, meta.prazo, hoje, taxa, meta.guardado) };
  }
  const oQueDa = !prazo && !metaMenor && baixo10(disponivel) > 0 ? baixo10(disponivel) : null;
  return { prazo, metaMenor, oQueDa };
}

export const LIMITES_DAS_ALTERNATIVAS = {
  /** Prazo que cabe só até 10 anos a partir de hoje... */
  prazoMaximoEmMeses: 120,
  /** ...e até 3 vezes o prazo que ela escolheu (R$ 5 mil em 12 meses não vira 7 anos). */
  prazoMaximoEmVezes: 3,
  /** Meta menor só quando fica com pelo menos metade da original. */
  metaMenorMinima: 0.5,
  /** E pelo menos R$ 200. */
  metaMenorEmReais: 200,
} as const;

/* ---------------------------------------------------------------- o plano */

export function planoDaMeta(e: EntradaDoPlano): PlanoDaMeta {
  if (/empresa/i.test(e.perfil.tipo)) return { mostra: false, motivo: "empresa" };
  if ((e.perfil.moeda || "BRL").toUpperCase() !== "BRL") return { mostra: false, motivo: "moeda" };
  if (!(e.meta.alvo > e.meta.guardado)) return { mostra: false, motivo: "meta_concluida" };

  const taxa = e.meta.taxaAnual ?? TAXA_PADRAO_DAS_METAS;
  // Prazo que já passou (ou é o mês de hoje) não dá conta de "por mês": vira meta sem prazo.
  const fimDoMes = new Date(e.hoje.getFullYear(), e.hoje.getMonth() + 1, 1);
  const prazoVencido = !!e.meta.prazo && e.meta.prazo < fimDoMes;
  const prazo = prazoVencido ? null : e.meta.prazo;
  const pede = prazo ? porMesDaNovaMeta(e.meta.alvo, prazo, e.hoje, taxa, e.meta.guardado) : null;
  const prazoTexto = prazo ? textoDoPrazo(prazo) : null;

  const avisos: AvisoDoPlano[] = [];
  if (prazoVencido) avisos.push("prazo_vencido");
  const temRenda = e.rendaMedia !== null && e.rendaMedia > 0;
  if (!temRenda) avisos.push("sem_renda");
  else if (e.rendaMeses === 1) avisos.push("renda_de_um_mes");
  // A sobra: renda menos gasto, e os aportes combinados saem dela até zerar. Um combinado maior que
  // a sobra (meta com prazo impossível, 630 vezes a renda numa conta real) nunca deixa a sobra
  // negativa sozinho: ele só ocupa tudo o que sobra.
  const livre = temRenda && e.gastoTipico ? reais((e.rendaMedia as number) - e.gastoTipico.media) : null;
  const sobraBruta = livre === null ? null : livre > 0 ? reais(livre - Math.min(livre, Math.max(0, e.aportesCombinados))) : livre;
  if (livre !== null && livre < 0) avisos.push("sobra_negativa");
  // Sobra negativa conta zero: o plano não promete tapar o buraco do mês (na validação de 16/10,
  // quase sempre era renda lançada pela metade ou Pix para conta própria, não gasto de verdade).
  const sobra = sobraBruta !== null && sobraBruta > 0 ? baixo10(sobraBruta) : 0;

  const { coisinhas, mesesDeDados } = coisinhasDosGastos(e);
  if (mesesDeDados === 2) avisos.push("dois_meses");
  const base = { mostra: true as const, prazoTexto, pede, sobraBruta, sobra, avisos, mesesDeDados };

  // Com menos de 2 meses fechados de gasto, nada do que vem dos gastos é confiável (nem a sobra).
  const poucos = !e.gastoTipico || mesesDeDados < LIMITES.minimoDeMesesDeDados;
  if (poucos) {
    return { ...base, situacao: "poucos_dados", falta: pede ?? 0, sobra: 0, sobraBruta: null, coisinhas: [], achado: 0, fechaCom: 0, alternativas: null, semPrazo: null };
  }
  if (pede === null) {
    // Sem prazo: quando chega com o que sobra, e com sobra + todas as coisinhas.
    const achado = reais(coisinhas.reduce((s, c) => s + c.economia, 0));
    const chega = (porMes: number) => {
      const p = porMes > 0 ? prazoQueCabe({ alvo: e.meta.alvo, guardado: e.meta.guardado, porMes, taxaAnual: taxa, hoje: e.hoje }) : null;
      return p && p.meses <= LIMITES_DAS_ALTERNATIVAS.prazoMaximoEmMeses ? p : null;
    };
    const comSobra = chega(sobra);
    const comTudo = achado > 0 ? chega(sobra + achado) : null;
    // Só mostra a data com as coisinhas quando ela chega antes da data com a sobra.
    const comCoisinhas = comTudo && (!comSobra || comTudo.meses < comSobra.meses) ? comTudo : null;
    return { ...base, situacao: "sem_prazo", falta: 0, coisinhas, achado, fechaCom: 0, alternativas: null, semPrazo: { comSobra, comCoisinhas } };
  }

  if (sobraBruta !== null && sobraBruta >= pede) {
    return { ...base, situacao: "ja_cabe", falta: 0, coisinhas: [], achado: 0, fechaCom: 0, alternativas: null, semPrazo: null };
  }
  const falta = Math.max(0, pede - sobra);

  const achado = reais(coisinhas.reduce((s, c) => s + c.economia, 0));
  let soma = 0;
  let fechaCom = 0;
  for (let i = 0; i < coisinhas.length; i++) {
    soma += coisinhas[i].economia;
    if (soma >= falta - 1e-9) {
      fechaCom = i + 1;
      break;
    }
  }
  if (coisinhas.length === 0) {
    return { ...base, situacao: "sem_coisinhas", falta, coisinhas, achado: 0, fechaCom: 0, alternativas: alternativasPara(e.meta, sobra, e.hoje), semPrazo: null };
  }
  if (fechaCom > 0) return { ...base, situacao: "fecha", falta, coisinhas, achado, fechaCom, alternativas: null, semPrazo: null };
  return { ...base, situacao: "nao_fecha", falta, coisinhas, achado, fechaCom: 0, alternativas: alternativasPara(e.meta, sobra + achado, e.hoje), semPrazo: null };
}

/* ---------------------------------------------------------------- a frase */

/** O dinheiro da frase: o formatador do app (o plano só aparece em real), sem centavo quando é redondo. */
const dinheiro = (v: number) => formatMoney(v, "BRL", { round: Number.isInteger(Math.round(v * 100) / 100) });

/**
 * A frase do topo do plano, sem conta armada (pedido da Dani, 16/10/2026: "R$ 400 menos R$ 0"
 * ficou estranho). Uma frase só, com o número do que falta.
 */
export function fraseDoPlano(p: PlanoDaMeta): string | null {
  if (!p.mostra) return null;
  switch (p.situacao) {
    case "ja_cabe":
      return `O que sobra hoje já paga essa meta até ${p.prazoTexto}.`;
    case "sem_prazo":
      return p.semPrazo?.comSobra ? `Com o que sobra hoje, você chega em ${p.semPrazo.comSobra.texto}.` : "Escolha uma data para ver quanto guardar por mês.";
    case "poucos_dados":
      return `Para chegar até ${p.prazoTexto}, faltam ${dinheiro(p.falta)} por mês.`;
    default:
      return `Para chegar até ${p.prazoTexto}, faltam ${dinheiro(p.falta)} por mês.`;
  }
}

