import { chaveDoComerciante, chaveUtil } from "@/lib/import/comerciante";
import { marcaDaDescricao, normalizarDescricao } from "@/lib/marcas/marca";
import { parseInstallment } from "@/lib/entries/recurrence";

/**
 * Dinheiro perdido (versão B aprovada em 12/10/2026): o app caça sozinho, nos lançamentos que a
 * pessoa já tem, o que escapa todo mês, e mostra quanto custa no ano. Quatro tipos:
 *
 * 1. Assinatura: a mesma cobrança, uma vez por mês, de um serviço (logo do catálogo quando tem).
 * 2. Cobrança repetida: o mesmo comerciante, o mesmo valor, em até 3 dias. Mercado, padaria,
 *    café e transporte ficam de fora (é normal passar duas vezes), e parcela também.
 * 3. Tarifa e seguro: pacote de serviços, anuidade, seguro, IOF, juros e multa, pelo nome.
 * 4. Aumentou: a mesma assinatura, mais cara que a mediana dos meses de antes (régua do Rocket
 *    Money: só acima de R$ 2 E de 5%, para não avisar centavo).
 *
 * O app nunca diz "indevida": não sabe se a pessoa usa o serviço nem se foram dois pedidos. Quem
 * decide é ela, e a decisão fica guardada pela `chave` (estável entre um extrato e outro).
 *
 * Puro, sem banco: recebe os lançamentos, devolve os achados.
 */

export type LancamentoParaCacar = {
  id: string;
  descricao: string | null;
  /** Sempre positivo, na moeda do perfil. */
  valor: number;
  /** "AAAA-MM-DD" (o dia de verdade), ou null no lançamento antigo sem data. */
  data: string | null;
  ano: number;
  mes: number;
  tipo: "INCOME" | "EXPENSE" | "INVESTMENT_CONTRIBUTION";
  categoria: string | null;
  subcategoria: string | null;
  /** Lote de importação: o mesmo gasto em dois lotes no mesmo dia é importação dupla, não cobrança dupla. */
  lote?: string | null;
};

export type TipoDeAchado = "assinatura" | "repetida" | "tarifa" | "aumento";
export type TipoDeTarifa = "pacote" | "anuidade" | "seguro" | "iof" | "juros";

export type Achado = {
  /** Chave estável: é por ela que a decisão da pessoa fica guardada. */
  chave: string;
  tipo: TipoDeAchado;
  /** O que a carta mostra no título ("Netflix", "iFood, 2 vezes", "Tarifa de pacote, Itaú"). */
  nome: string;
  /** Quem cobrou, curto ("iFood", "Itaú"): vai na mensagem de estorno. */
  quem: string;
  /** Texto que acha o logo (LogoDoLancamento). */
  descricaoDoLogo: string;
  /** Por mês (assinatura, tarifa que se repete, aumento = a diferença). */
  mensal: number | null;
  /** De uma vez (cobrança repetida, tarifa avulsa). */
  unico: number | null;
  /** O número grande da carta: mensal × 12, ou o de uma vez. */
  anual: number;
  /** Dia do mês em que costuma cair (assinatura e tarifa). */
  dia: number | null;
  /** Há quantos meses aparece. */
  meses: number;
  /** Aumento: antes x agora. */
  antes?: number;
  agora?: number;
  /** Cobrança repetida e tarifa avulsa: os dias ("AAAA-MM-DD") e o valor de cada cobrança. */
  datas?: string[];
  valorDaCobranca?: number;
  tarifa?: TipoDeTarifa;
  /** Comerciante normalizado: é o que reconhece o estorno quando ele cai como crédito. */
  comerciante: string;
  ultimaData: string | null;
  lancamentos: string[];
};

export type ResultadoDaCaca = {
  achados: Achado[];
  /** Para o "nada achado": quantos lançamentos o app olhou no último mês com dado, e qual. */
  conferidos: { quantos: number; ano: number; mes: number } | null;
};

/* ---------------------------------------------------------------- regras */

/** Serviços de assinatura do catálogo de marcas (o resto do catálogo é loja, banco, mercado). */
const SERVICOS = new Set([
  "netflix", "spotify", "primevideo", "appletv", "youtube", "icloud", "openai", "amazonprime", "applemusic", "paramountplus",
  "globoplay", "disneyplus", "hbomax", "deezer", "googleone", "youtubepremium", "smartfit", "wellhub", "amazonmusic",
  "duolingo", "canva", "adobe", "tinder", "microsoft365", "sky", "vivo", "claro", "tim", "oi", "apple", "google", "semparar",
]);
/** Palavras que dizem "isto é assinatura" mesmo sem marca conhecida. */
const PALAVRA_DE_ASSINATURA = /\b(assinatura|mensalidade|subscription|clube|club|premium|plano mensal|recorrente|uber one)\b/;
const SUB_DE_ASSINATURA = /streaming|assinatura|software|mensalidade|internet|telefone/i;

/** Essencial não é "assinatura esquecida": aluguel, escola, plano de saúde, imposto. */
const ESSENCIAIS = new Set(["MORADIA", "EDUCACAO", "IMPOSTOS", "SAUDE"]);
const ACADEMIA = /smart\s*fit|academia|gympass|wellhub|bluefit|bodytech|selfit|totalpass/;

/**
 * Dia a dia: passar duas vezes no mercado, na padaria ou no Uber com o mesmo valor é normal. Fica
 * fora da cobrança repetida (o iFood não: dois pedidos iguais em dias seguidos vale conferir).
 */
const SUB_DIA_A_DIA = /supermercado|mercado|padaria|lanche|caf[eé]|transporte|combust[ií]vel|estacionamento|ped[aá]gio|motoboy|aplicativo|feira|a[cç]ougue/i;
const PALAVRA_DIA_A_DIA =
  /\b(mercado|supermercado|supermercados|atacadao|assai|hortifruti|sacolao|padaria|panificadora|panificacao|cafe|cafeteria|lanchonete|acougue|feira|posto|combustivel|estacionamento|estapar|onibus|metro|bilhete unico|sptrans|uber|99|cabify|pedagio|sem parar|conectcar|veloe|farmacia|drogaria|drogasil|raia)\b/;
const MARCAS_DIA_A_DIA = new Set(["uber", "99", "carrefour", "assai", "atacadao", "extra", "dia", "shell", "ipiranga", "drogasil", "paguemenos", "semparar"]);

/**
 * Viagem e imposto: passagem parcelada sem "parcela" na descrição (a Iberia cobrando o mesmo valor
 * todo mês) e a guia do Simples paga duas vezes no mês são outra conversa, não dinheiro perdido.
 */
const VIAGEM_OU_IMPOSTO =
  /\b(lineas aereas|linhas aereas|airlines|airways|air france|iberia|tap air|latam|gol linhas|azul linhas|voegol|voeazul|decolar|booking|airbnb|hotel|hoteis|simples nacional|das mei|darf|gps inss|imposto|ipva|iptu|detran|licenciamento)\b/;
const MARCAS_VIAGEM = new Set(["latam", "gol", "azul", "booking", "airbnb"]);

/** Dinheiro que não é gasto: aplicação, resgate, fatura paga, conta própria. */
const NAO_E_GASTO =
  /\b(aplicacao|resgate|caixinha|rdb|cdb|tesouro|pagamento de fatura|pagamento fatura|pgto fatura|pag fatura|fatura do cartao|fatura cartao|mesma titularidade|entre contas|conta propria|transferencia entre contas|investimento)\b/;
/** CPF mascarado: transferência para uma PESSOA (ou para ela mesma em outro banco). */
const CPF = /[•*]{3}\.?\s*\d{3}|\d{3}\.\d{3}\.\d{3}-\d{2}/;
const TRANSFERENCIA = /\b(pix|ted|doc|transf|transferencia)\b/;
const PARCELA = /\bparc(ela)?(?=\b|\d)|\bprestacao\b/;

/** Tarifa e seguro, pelo nome no extrato. A ordem importa: o primeiro que casa decide. */
const TARIFAS: { tipo: TipoDeTarifa; re: RegExp; nome: string }[] = [
  { tipo: "anuidade", re: /\banuidade\b/, nome: "Anuidade do cartão" },
  { tipo: "seguro", re: /\b(seguro|seg cartao|prot cartao|protecao (do )?cartao|cartao protegido|perda e roubo|prestamista|assistencia)\b/, nome: "Seguro" },
  { tipo: "iof", re: /\biof\b/, nome: "IOF" },
  { tipo: "juros", re: /\b(juros|multa|encargos?|mora|rotativo)\b/, nome: "Juros e multa" },
  {
    tipo: "pacote",
    re: /\b(tarifa|tarifas|tar pacote|cesta de servicos|cesta servicos|pacote de servicos|pacote servicos|pacote padronizado|manutencao de conta|mensalidade pacote|taxa de manutencao|tar manut)\b/,
    nome: "Tarifa de pacote",
  },
];

/** Régua do aumento: só acima de R$ 2 E de 5% (não avisar centavo nem reajuste de câmbio miúdo). */
const AUMENTO_MIN_REAIS = 2;
const AUMENTO_MIN_PCT = 0.05;
/** Até 15% de diferença ainda é "o mesmo valor todo mês" (câmbio, imposto). */
const MESMO_VALOR = 0.15;
const REPETIDA_DIAS = 3;
const REPETIDA_MIN = 10;

/* ---------------------------------------------------------------- utilidades */

const mesDe = (l: { ano: number; mes: number }) => l.ano * 12 + (l.mes - 1);
const mediana = (v: number[]) => {
  const o = [...v].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};
const centavos = (v: number) => Math.round(v * 100);
const diaDe = (data: string | null) => (data ? Number(data.slice(8, 10)) : null);
const diasEntre = (a: string, b: string) => Math.round(Math.abs(Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000);
const r2 = (v: number) => Math.round(v * 100) / 100;

function textoDe(l: LancamentoParaCacar): string {
  return normalizarDescricao(l.descricao ?? "");
}

/** Linha que não é gasto de verdade: aplicação, fatura paga, Pix para pessoa (inclusive ela mesma). */
function naoEGasto(l: LancamentoParaCacar): boolean {
  if (l.tipo !== "EXPENSE") return true;
  if (!(l.valor > 0) || !l.descricao) return true;
  const t = textoDe(l);
  if (l.categoria === "IMPOSTOS" || VIAGEM_OU_IMPOSTO.test(t)) return true;
  const marca = marcaDaDescricao(l.descricao);
  if (marca && MARCAS_VIAGEM.has(marca.slug)) return true;
  if (l.subcategoria === "Investimento" || NAO_E_GASTO.test(t)) return true;
  // Transferência para pessoa: CPF mascarado, ou Pix/TED sem marca nenhuma de serviço.
  if (CPF.test(l.descricao)) return true;
  return false;
}

export function ehParcela(l: LancamentoParaCacar): boolean {
  if (!l.descricao) return false;
  if (PARCELA.test(textoDe(l))) return true;
  // Aqui vale qualquer "N/T" que seja parcela possível, não só o "confiante": "Cia Marítima (1/3)"
  // (o formato que a importação grava) virava assinatura de R$ 5 mil por ano (12/10/2026, conta da
  // Dani). Errar para o lado de não mostrar: parcela não tem o que cortar.
  return parseInstallment(l.descricao) !== null;
}

function tarifaDe(l: LancamentoParaCacar): (typeof TARIFAS)[number] | null {
  const t = textoDe(l);
  // "Tarifa" de ônibus, metrô, pedágio é passagem, não tarifa de banco.
  if (/\b(onibus|metro|pedagio|passagem|sptrans|bilhete)\b/.test(t)) return null;
  for (const x of TARIFAS) if (x.re.test(t)) return x;
  if (/tarifa|taxas? banc|seguro|multas? e juros/i.test(l.subcategoria ?? "")) {
    if (/seguro/i.test(l.subcategoria ?? "")) return TARIFAS.find((x) => x.tipo === "seguro")!;
    if (/juros|multa/i.test(l.subcategoria ?? "")) return TARIFAS.find((x) => x.tipo === "juros")!;
    return TARIFAS.find((x) => x.tipo === "pacote")!;
  }
  return null;
}

/** Quem cobrou, numa chave: a marca do catálogo quando tem (o Netflix muda a descrição todo mês). */
export function comercianteDe(l: LancamentoParaCacar): { chave: string; nome: string; marca: ReturnType<typeof marcaDaDescricao> } {
  const marca = marcaDaDescricao(l.descricao);
  if (marca && !marca.baixa) return { chave: `m:${marca.slug}`, nome: marca.nome, marca };
  const c = chaveDoComerciante(l.descricao);
  if (marca && (!c || !chaveUtil(c))) return { chave: `m:${marca.slug}`, nome: marca.nome, marca };
  return { chave: c, nome: nomeLegivel(c, l.descricao ?? ""), marca };
}

/** "netflix com" → "Netflix"; sem nada útil, o começo da descrição. */
function nomeLegivel(chave: string, descricao: string): string {
  const base = chave && chaveUtil(chave) ? chave : descricao.trim().toLowerCase();
  const nome = base
    .split(" ")
    .filter(Boolean)
    .slice(0, 3)
    .map((p) => (p.length <= 3 && /\d/.test(p) ? p : p[0].toUpperCase() + p.slice(1)))
    .join(" ");
  return nome.slice(0, 40) || "Cobrança";
}

function ehDiaADia(l: LancamentoParaCacar, slug: string | null): boolean {
  if (l.categoria === "TRANSPORTE") return true;
  if (SUB_DIA_A_DIA.test(l.subcategoria ?? "")) return true;
  if (slug && MARCAS_DIA_A_DIA.has(slug)) return true;
  return PALAVRA_DIA_A_DIA.test(textoDe(l));
}

/* ---------------------------------------------------------------- 1 e 4: assinatura e aumento */

type Serie = { meses: Map<number, LancamentoParaCacar>; comerciante: string; nome: string; slug: string | null; descricao: string };

/**
 * Agrupa por comerciante e, dentro dele, em séries de "uma cobrança por mês". Quem cobra uma vez
 * por mês vira uma série só (é ela que mostra o aumento). Quem cobra várias vezes por mês (Google
 * com o YouTube e o Google One) é separado pelo valor, e cada valor estável vira uma série.
 */
function series(lancamentos: LancamentoParaCacar[]): Serie[] {
  const porComerciante = new Map<string, { itens: LancamentoParaCacar[]; nome: string; slug: string | null }>();
  for (const l of lancamentos) {
    const c = comercianteDe(l);
    if (!c.chave || (!c.chave.startsWith("m:") && !chaveUtil(c.chave))) continue;
    const g = porComerciante.get(c.chave) ?? { itens: [], nome: c.nome, slug: c.marca?.slug ?? null };
    g.itens.push(l);
    porComerciante.set(c.chave, g);
  }
  const out: Serie[] = [];
  for (const [comerciante, g] of porComerciante) {
    const porMes = new Map<number, LancamentoParaCacar[]>();
    for (const l of g.itens) porMes.set(mesDe(l), [...(porMes.get(mesDe(l)) ?? []), l]);
    const umaPorMes = [...porMes.values()].filter((v) => v.length === 1).length;
    const descricao = g.itens[g.itens.length - 1].descricao ?? g.nome;
    if (umaPorMes >= porMes.size * 0.75) {
      // Uma por mês: o mês com duas fica com a mais perto da mediana (a outra é compra avulsa).
      const tipica = mediana(g.itens.map((l) => l.valor));
      const meses = new Map<number, LancamentoParaCacar>();
      for (const [m, v] of porMes) meses.set(m, [...v].sort((a, b) => Math.abs(a.valor - tipica) - Math.abs(b.valor - tipica))[0]);
      out.push({ meses, comerciante, nome: g.nome, slug: g.slug, descricao });
      continue;
    }
    // Várias por mês: cada valor estável (±15%) é uma série; só vale a que tem uma por mês.
    const grupos: LancamentoParaCacar[][] = [];
    for (const l of [...g.itens].sort((a, b) => a.valor - b.valor)) {
      const alvo = grupos.find((gr) => Math.abs(l.valor - mediana(gr.map((x) => x.valor))) <= mediana(gr.map((x) => x.valor)) * MESMO_VALOR);
      if (alvo) alvo.push(l);
      else grupos.push([l]);
    }
    for (const gr of grupos) {
      const meses = new Map<number, LancamentoParaCacar[]>();
      for (const l of gr) meses.set(mesDe(l), [...(meses.get(mesDe(l)) ?? []), l]);
      if ([...meses.values()].some((v) => v.length > 1)) continue;
      out.push({ meses: new Map([...meses].map(([m, v]) => [m, v[0]])), comerciante: `${comerciante}#${centavos(mediana(gr.map((x) => x.valor)))}`, nome: g.nome, slug: g.slug, descricao });
    }
  }
  return out;
}

function acharAssinaturasEAumentos(gastos: LancamentoParaCacar[], ultimoMes: number): Achado[] {
  const candidatos = gastos.filter((l) => {
    if (ehParcela(l) || tarifaDe(l)) return false;
    const t = textoDe(l);
    const marca = marcaDaDescricao(l.descricao);
    const servico = Boolean(marca && SERVICOS.has(marca.slug));
    // Pix ou TED para quem não é serviço conhecido: pessoa, não assinatura.
    if (TRANSFERENCIA.test(t) && !servico) return false;
    if (l.categoria && ESSENCIAIS.has(l.categoria) && !servico && !ACADEMIA.test(t)) return false;
    if (ehDiaADia(l, marca?.slug ?? null) && !servico && !PALAVRA_DE_ASSINATURA.test(t)) return false;
    return true;
  });
  const out: Achado[] = [];
  for (const s of series(candidatos)) {
    const meses = [...s.meses.keys()].sort((a, b) => a - b);
    const ultimo = meses[meses.length - 1];
    // Sumiu: já foi cancelada (ou parou). Não é mais decisão.
    if (ultimo < ultimoMes - 1) continue;
    const exemplo = s.meses.get(ultimo)!;
    const t = textoDe(exemplo);
    const servico = (s.slug !== null && SERVICOS.has(s.slug)) || PALAVRA_DE_ASSINATURA.test(t) || SUB_DE_ASSINATURA.test(exemplo.subcategoria ?? "");
    // Serviço conhecido: 2 meses bastam. O resto precisa de 3 (padaria com o mesmo valor 2 vezes acontece).
    if (meses.length < (servico ? 2 : 3)) continue;
    // Todo mês: aparecer em junho, agosto e outubro é hábito, não mensalidade.
    if (meses.length < (ultimo - meses[0] + 1) * 0.75) continue;
    const valores = meses.map((m) => s.meses.get(m)!.valor);
    // Serviço conhecido aceita 15% de variação (câmbio, imposto); o resto precisa ser o mesmo
    // valor de verdade (assinatura cobra o valor exato; restaurante com conta parecida, não).
    const tolerancia = servico ? MESMO_VALOR : 0.02;
    const estavel = (v: number[]) => v.length > 0 && Math.max(...v) - Math.min(...v) <= mediana(v) * tolerancia;
    // Aumento: o primeiro mês em que o valor subiu de patamar e ficou lá até agora, com os meses
    // de antes no mesmo valor.
    let degrau = -1;
    for (let i = 1; i < valores.length; i += 1) {
      const antes = valores.slice(0, i);
      const depois = valores.slice(i);
      const base = mediana(antes);
      if (estavel(antes) && estavel(depois) && depois.every((v) => v - base >= AUMENTO_MIN_REAIS && v >= base * (1 + AUMENTO_MIN_PCT))) {
        degrau = i;
        break;
      }
    }
    const anteriores = degrau > 0 ? valores.slice(0, degrau) : valores;
    // Os meses de antes têm que ser "o mesmo valor": posto com R$ 120, 250, 180 não é assinatura.
    if (!estavel(anteriores)) continue;
    const base = mediana(anteriores);
    const dias = meses.map((m) => diaDe(s.meses.get(m)!.data)).filter((d): d is number => d !== null);
    const dia = dias.length ? mediana(dias) : null;
    const lancamentos = meses.map((m) => s.meses.get(m)!.id);
    const comum = {
      quem: s.nome,
      descricaoDoLogo: s.descricao,
      dia: dia === null ? null : Math.round(dia),
      meses: meses.length,
      comerciante: s.comerciante,
      ultimaData: exemplo.data,
      lancamentos,
    };
    // O aumento é notícia enquanto é recente: a partir do 3º mês no preço novo, vira a assinatura de sempre.
    if (degrau > 0 && valores.length - degrau <= 2) {
      const agora = valores[valores.length - 1];
      const diferenca = r2(agora - base);
      out.push({ ...comum, chave: `aumento:${s.comerciante}:${centavos(agora)}`, tipo: "aumento", nome: s.nome, mensal: diferenca, unico: null, anual: r2(diferenca * 12), antes: r2(base), agora: r2(agora) });
      continue;
    }
    const mensal = r2(degrau > 0 ? valores[valores.length - 1] : mediana(valores.slice(-3)));
    out.push({ ...comum, chave: `assinatura:${s.comerciante}`, tipo: "assinatura", nome: s.nome, mensal, unico: null, anual: r2(mensal * 12) });
  }
  return out;
}

/* ---------------------------------------------------------------- 2: cobrança repetida */

function acharRepetidas(gastos: LancamentoParaCacar[], ultimoMes: number): Achado[] {
  const grupos = new Map<string, LancamentoParaCacar[]>();
  for (const l of gastos) {
    if (!l.data || l.valor < REPETIDA_MIN || ehParcela(l) || tarifaDe(l)) continue;
    // Só o que é recente (o último mês com dado e o anterior): o resto já ficou para trás.
    if (mesDe(l) < ultimoMes - 1) continue;
    const t = textoDe(l);
    const c = comercianteDe(l);
    const slug = c.marca?.slug ?? null;
    if (TRANSFERENCIA.test(t) && !(slug && SERVICOS.has(slug))) continue;
    if (ehDiaADia(l, slug)) continue;
    if (!c.chave || (!c.chave.startsWith("m:") && !chaveUtil(c.chave))) continue;
    const k = `${c.chave}|${centavos(l.valor)}`;
    grupos.set(k, [...(grupos.get(k) ?? []), l]);
  }
  const out: Achado[] = [];
  for (const [k, itens] of grupos) {
    if (itens.length < 2) continue;
    const ordem = [...itens].sort((a, b) => a.data!.localeCompare(b.data!));
    // Pares de dias próximos (≤ 3 dias). O que se repete todo mês com o mesmo valor é assinatura, não repetida.
    for (let i = 1; i < ordem.length; i += 1) {
      const a = ordem[i - 1];
      const b = ordem[i];
      const dias = diasEntre(a.data!, b.data!);
      if (dias > REPETIDA_DIAS) continue;
      // Mesmo dia em lotes diferentes: o extrato entrou duas vezes no app, não o banco cobrou duas vezes.
      if (dias === 0 && a.lote && b.lote && a.lote !== b.lote) continue;
      const c = comercianteDe(b);
      const [comerciante] = k.split("|");
      out.push({
        chave: `repetida:${comerciante}:${centavos(b.valor)}:${b.data}`,
        tipo: "repetida",
        nome: `${c.nome}, 2 vezes`,
        quem: c.nome,
        descricaoDoLogo: b.descricao ?? c.nome,
        mensal: null,
        unico: r2(b.valor),
        anual: r2(b.valor),
        dia: null,
        meses: 1,
        datas: [a.data!, b.data!],
        valorDaCobranca: r2(b.valor),
        comerciante,
        ultimaData: b.data,
        lancamentos: [a.id, b.id],
      });
      i += 1; // o par já foi usado
    }
  }
  return out;
}

/* ---------------------------------------------------------------- 3: tarifa e seguro */

function acharTarifas(gastos: LancamentoParaCacar[], ultimoMes: number): Achado[] {
  const grupos = new Map<string, { tarifa: (typeof TARIFAS)[number]; banco: ReturnType<typeof marcaDaDescricao>; itens: LancamentoParaCacar[] }>();
  for (const l of gastos) {
    const tarifa = tarifaDe(l);
    if (!tarifa || ehParcela(l)) continue;
    const marca = marcaDaDescricao(l.descricao);
    const banco = marca && !marca.baixa ? marca : null;
    const k = `${tarifa.tipo}:${banco?.slug ?? ""}`;
    const g = grupos.get(k) ?? { tarifa, banco, itens: [] };
    g.itens.push(l);
    grupos.set(k, g);
  }
  const out: Achado[] = [];
  for (const [k, g] of grupos) {
    const porMes = new Map<number, LancamentoParaCacar[]>();
    for (const l of g.itens) porMes.set(mesDe(l), [...(porMes.get(mesDe(l)) ?? []), l]);
    const meses = [...porMes.keys()].sort((a, b) => a - b);
    const ultimo = meses[meses.length - 1];
    if (ultimo < ultimoMes - 1) continue;
    // "Seguro do cartão" quando o extrato diz cartão; "Seguro" sozinho nos outros.
    const doCartao = g.tarifa.tipo === "seguro" && g.itens.some((l) => /\bcartao\b/.test(textoDe(l)));
    const titulo = doCartao ? "Seguro do cartão" : g.tarifa.nome;
    const nome = g.banco ? `${titulo}, ${g.banco.nome}` : titulo;
    const quem = g.banco?.nome ?? "banco";
    const doUltimo = porMes.get(ultimo)!;
    const exemplo = doUltimo[doUltimo.length - 1];
    const dias = g.itens.map((l) => diaDe(l.data)).filter((d): d is number => d !== null);
    const comum = {
      tipo: "tarifa" as const,
      nome,
      quem,
      descricaoDoLogo: g.banco ? g.banco.nome : (exemplo.descricao ?? nome),
      tarifa: g.tarifa.tipo,
      comerciante: k,
      ultimaData: exemplo.data,
    };
    // Cobra em 2 meses ou mais (dos últimos): é por mês. Senão, foi uma vez.
    const recentes = meses.filter((m) => m >= ultimoMes - 3);
    if (recentes.length >= 2) {
      const totais = recentes.map((m) => porMes.get(m)!.reduce((s, l) => s + l.valor, 0));
      const mensal = r2(mediana(totais));
      out.push({ ...comum, chave: `tarifa:${k}`, mensal, unico: null, anual: r2(mensal * 12), dia: dias.length ? Math.round(mediana(dias)) : null, meses: meses.length, lancamentos: recentes.flatMap((m) => porMes.get(m)!.map((l) => l.id)) });
    } else {
      const total = r2(doUltimo.reduce((s, l) => s + l.valor, 0));
      const datas = doUltimo.map((l) => l.data).filter((d): d is string => d !== null).sort();
      out.push({ ...comum, chave: `tarifa:${k}:${ultimo}`, mensal: null, unico: total, anual: total, dia: null, meses: 1, datas, valorDaCobranca: doUltimo.length === 1 ? total : undefined, lancamentos: doUltimo.map((l) => l.id) });
    }
  }
  return out;
}

/* ---------------------------------------------------------------- tudo junto */

const ORDEM: Record<TipoDeAchado, number> = { repetida: 0, assinatura: 1, tarifa: 2, aumento: 3 };

/**
 * Caça nos lançamentos (o ideal: os últimos 6 meses). Devolve os achados do maior "por ano" para o
 * menor, e quantos lançamentos o último mês tinha (o "Conferi N lançamentos de setembro").
 */
export function cacarDinheiroPerdido(lancamentos: LancamentoParaCacar[]): ResultadoDaCaca {
  const gastos = lancamentos.filter((l) => !naoEGasto(l));
  if (lancamentos.length === 0) return { achados: [], conferidos: null };
  const ultimoMes = Math.max(...lancamentos.map(mesDe));
  const doUltimo = lancamentos.filter((l) => mesDe(l) === ultimoMes).length;
  const conferidos = { quantos: doUltimo, ano: Math.floor(ultimoMes / 12), mes: (ultimoMes % 12) + 1 };
  if (gastos.length === 0) return { achados: [], conferidos };
  const achados = [...acharRepetidas(gastos, ultimoMes), ...acharAssinaturasEAumentos(gastos, ultimoMes), ...acharTarifas(gastos, ultimoMes)];
  // A mesma linha não vira duas cartas: a repetida ganha da assinatura (é a mais urgente).
  const usadas = new Set<string>();
  const unicos: Achado[] = [];
  for (const a of achados.sort((x, y) => ORDEM[x.tipo] - ORDEM[y.tipo])) {
    if (a.tipo !== "assinatura" && a.tipo !== "aumento" && a.lancamentos.some((id) => usadas.has(id))) continue;
    a.lancamentos.forEach((id) => usadas.add(id));
    unicos.push(a);
  }
  return { achados: unicos.sort((a, b) => b.anual - a.anual || ORDEM[a.tipo] - ORDEM[b.tipo]), conferidos };
}

/**
 * O estorno caiu? Um crédito do mesmo comerciante, com o mesmo valor, depois da cobrança e até 90
 * dias depois. É o que soma no placar sozinho ("Quando o estorno cair no extrato, eu somo").
 */
export function estornoCaiu(achado: Pick<Achado, "comerciante" | "ultimaData" | "unico" | "valorDaCobranca" | "descricaoDoLogo">, lancamentos: LancamentoParaCacar[]): LancamentoParaCacar | null {
  const valor = achado.valorDaCobranca ?? achado.unico;
  if (!valor || !achado.ultimaData) return null;
  const marcaDoAchado = marcaDaDescricao(achado.descricaoDoLogo);
  for (const l of lancamentos) {
    if (l.tipo !== "INCOME" || !l.data || l.data < achado.ultimaData) continue;
    if (diasEntre(l.data, achado.ultimaData) > 90) continue;
    if (Math.abs(l.valor - valor) > 0.01) continue;
    const t = textoDe(l);
    const marca = marcaDaDescricao(l.descricao);
    const mesmo =
      (marcaDoAchado && marca && marca.slug === marcaDoAchado.slug) ||
      (achado.comerciante && !achado.comerciante.startsWith("m:") && chaveDoComerciante(l.descricao).startsWith(achado.comerciante.split(":").pop() ?? "\u0000")) ||
      /\b(estorno|estornado|devolucao|reembolso|cancelamento|credito de)\b/.test(t);
    if (mesmo) return l;
  }
  return null;
}
