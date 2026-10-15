/**
 * A regra única de "o que resolve cada aviso" (14/10/2026).
 *
 * A Dani: "eu coloquei ali para tirar de outras e colocar em Cuidado pessoal esse mês e parece que
 * não aconteceu nada quando eu vejo o resumo". Cada tela decidia sozinha se um aviso já tinha sido
 * respondido: o Orçamento lia a folha "O que fazer?", o Resumo novo lia só o "Agora não" dele, o
 * Foco e o Decidir liam o "Deixar assim" e o teto, o e-mail não lia nada. Resolver numa tela não
 * tirava o aviso das outras.
 *
 * Aqui mora a regra, e só aqui. Cada aviso tem um ASSUNTO estável (a categoria no mês, a meta, a
 * reserva...). Toda resposta da pessoa, em qualquer tela, vira uma `Resposta` sobre um assunto. A
 * tela pergunta `avisoResolvido(aviso, respostas)` e mostra ou esconde; nenhuma tela guarda regra
 * própria de "já respondido".
 *
 * Puro, sem banco e sem React (o cliente também importa). Quem lê as respostas do banco é
 * `respostas.ts`.
 */

/* ---------------------------------------------------------------- a volta */

/** Quanto a mais do que passava na hora da resposta faz o aviso voltar (50% a mais). */
export const VOLTA_COM = 1.5;
/** E nunca por menos que isso de diferença: R$ 10 que viram R$ 15 não é novidade. */
export const VOLTA_COM_PELO_MENOS = 50;

/**
 * A regra antiga, de quando a resposta guardava só quanto passava (sem o gasto da hora): o aviso
 * volta quando passa 50% a mais e pelo menos R$ 50 a mais do que passava. Sem valor (resposta
 * antiga, ou "não gastar mais nada"), segura o mês inteiro.
 */
export function respostaSeguraOAviso(passouNaHora: number | null | undefined, passouAgora: number): boolean {
  if (passouNaHora === null || passouNaHora === undefined || !(passouNaHora > 0)) return true;
  const limite = Math.max(passouNaHora * VOLTA_COM, passouNaHora + VOLTA_COM_PELO_MENOS);
  return passouAgora < limite;
}

/**
 * Quanto o gasto da categoria tem de crescer, desde a resposta, para o aviso voltar: metade do
 * tamanho do aviso na hora (quanto passava, quanto tinha subido), e pelo menos R$ 50. Com o plano
 * parado é exatamente a regra antiga (passar 50% a mais e R$ 50 a mais); com o plano mexido (ela
 * cobriu), conta o que ela gastou depois, não o plano novo.
 */
export function limiteDaVolta(excessoNaHora: number | null | undefined): number {
  return Math.max((VOLTA_COM - 1) * Math.max(0, excessoNaHora ?? 0), VOLTA_COM_PELO_MENOS);
}

/* ---------------------------------------------------------------- os avisos */

/** Os tipos de sugestão do Resumo novo, na ordem de prioridade da proposta. */
export const TIPOS_DE_SUGESTAO = ["falta-dado", "dinheiro", "categoria", "parcela", "hora-do-mes", "indo-bem"] as const;
export type TipoDeSugestao = (typeof TIPOS_DE_SUGESTAO)[number];

/** Avisos sobre uma categoria no mês: os três falam do mesmo assunto. */
export type TipoDaCategoria = "estouro" | "ritmo" | "categoria-subiu";

/**
 * Um aviso como a tela o tem agora, com o que a regra precisa para decidir. Nas avisos de
 * categoria, `gasto` e `passou` são do mês inteiro, na régua do módulo (respostas.ts calcula os
 * dois do mesmo jeito para todas as telas).
 */
export type AvisoAtual =
  | {
      tipo: TipoDaCategoria;
      categoria: string;
      /** O gasto da categoria no mês, agora. */
      gasto: number;
      /** gasto − plano agora (negativo: ainda cabe). */
      passou: number;
      /** A marca do extrato mais recente (só o "Ver limite" do Resumo usa). */
      marca?: string;
    }
  | { tipo: "fora" | "aporte" | "reserva" | "raiox" }
  | { tipo: "meta"; metaId: string }
  /** Uma sugestão do Resumo novo que não é de categoria (falta o cartão, revisar, fechar o mês...). */
  | { tipo: "sugestao"; sugestao: TipoDeSugestao; id: string; marca: string };

/** O jeito como ela respondeu. */
export type ComoResolveu =
  /** "Foi pontual" na folha "O que fazer?". */
  | "pontual"
  /** "Cobrir com outra categoria" (Orçamento) ou "Tirar de" (Decidir). */
  | "cobrir"
  /** "Usar o livre do mês" (Decidir). */
  | "livre"
  /** "Deixar assim por agora" (Decidir), "Entendi" (Foco), "Guardo esta semana". */
  | "deixar"
  /** Subiu o plano da categoria: o lápis, o "Subir o plano" do aviso, o Editar meu plano. */
  | "lapis"
  /** "Segurar em R$ X até o fim do mês". */
  | "teto"
  /** "Não gastar mais nada este mês". */
  | "teto-zero"
  /** "Agora não" no Resumo novo. */
  | "agora-nao"
  /** Tocou no botão da sugestão do Resumo ("Ver limite", "Mandar a fatura"). */
  | "botao"
  /** "Boa" no "algo indo bem". */
  | "boa"
  /** Meta: guardar mais, mudar a data. Reserva: mandar a sobra. */
  | "guardar-mais"
  | "mudar-data"
  | "sobra-reserva"
  /** Resposta gravada antes desta regra, sem dizer como. */
  | "antiga";

/** Sobre qual aviso ela respondeu: um "Segurar em" no aviso de ritmo não responde ao "passou do plano". */
export type SobreOQue = TipoDaCategoria | "plano" | "outro";

export type Resposta = {
  /** O assunto (ver `assuntoDe`): "categoria:SAUDE", "meta-abc", "reserva", "falta-dado|cartao". */
  assunto: string;
  sobre: SobreOQue;
  como: ComoResolveu;
  /** O gasto da categoria no mês na hora da resposta (null: resposta antiga ou sem categoria). */
  gastoNaHora: number | null;
  /** O tamanho do aviso na hora: quanto passava do plano, quanto tinha subido contra o mês passado. */
  excessoNaHora: number | null;
  /** Formato antigo: só quanto passava do plano na hora (Decisao.valor). */
  passouNaHora: number | null;
  /** A marca do extrato na hora (Resumo novo): o que é "até o próximo extrato" volta com ele. */
  marca: string | null;
  /** Vale o mês inteiro, piore o quanto piorar ("não gastar mais nada"). */
  mesTodo: boolean;
};

export const assuntoDaCategoria = (categoria: string) => `categoria:${categoria}`;

/** O assunto de um aviso: as telas diferentes falam do mesmo assunto com o mesmo nome. */
export function assuntoDe(a: AvisoAtual): string {
  switch (a.tipo) {
    case "estouro":
    case "ritmo":
    case "categoria-subiu":
      return assuntoDaCategoria(a.categoria);
    case "meta":
      return `meta-${a.metaId}`;
    case "sugestao":
      return a.sugestao === "categoria" ? assuntoDaCategoria(a.id) : `${a.sugestao}|${a.id}`;
    default:
      return a.tipo;
  }
}

/* ---------------------------------------------------------------- o catálogo */

export type Volta = "se-piorar" | "mes-todo" | "proximo-extrato" | "semana";

/**
 * Cada aviso, declarado: onde aparece, o id estável, o que conta como resolvido e quando volta.
 * `resolvidoPor` é usado de verdade por `avisoResolvido`; o resto documenta (e o inventário em
 * ~/Claude/estudo-apps-financas/avisos-inventario.md segue esta tabela).
 */
export type DeclaracaoDeAviso = {
  nome: string;
  ondeAparece: string[];
  /** O id estável, por categoria/item e por período. */
  id: string;
  existe: string;
  resolvidoPor: readonly ComoResolveu[];
  volta: Volta;
};

const RESPOSTAS_DA_CATEGORIA = ["pontual", "cobrir", "livre", "deixar", "lapis", "teto-zero", "agora-nao", "antiga"] as const;

export const AVISOS = {
  estouro: {
    nome: "Categoria passou do plano",
    ondeAparece: ["Orçamento (AlertaDoOrcamento)", "Decidir (pilha)", "Resumo antigo (Decisões importantes)", "Ritual", "push/e-mail (cron alerts, :100)"],
    id: "estouro-<categoria>, no mês (assunto categoria:<categoria>)",
    existe: "gasto do mês − plano ≥ 1 real (o e-mail: gasto > plano)",
    resolvidoPor: RESPOSTAS_DA_CATEGORIA,
    volta: "se-piorar",
  },
  ritmo: {
    nome: "Categoria correndo rápido",
    ondeAparece: ["Decidir (pilha)", "Resumo antigo", "Ritual", "push/e-mail (cron alerts, :80)"],
    id: "ritmo-<categoria>, no mês (assunto categoria:<categoria>)",
    existe: "até 70% do mês, 70% ou mais do plano variável usado, ainda abaixo do plano",
    resolvidoPor: [...RESPOSTAS_DA_CATEGORIA, "teto"],
    volta: "se-piorar",
  },
  "categoria-subiu": {
    nome: "Categoria que subiu contra o mês passado",
    ondeAparece: ["Resumo novo (cartão da sugestão)"],
    id: "categoria|<categoria> (assunto categoria:<categoria>)",
    existe: "20% e 100 reais a mais que o mês passado no mesmo dia; nunca Moradia, Saúde, Educação",
    resolvidoPor: [...RESPOSTAS_DA_CATEGORIA, "teto", "botao"],
    volta: "se-piorar",
  },
  fora: {
    nome: "Gastos fora do plano",
    ondeAparece: ["Decidir (pilha)", "Resumo antigo", "Ritual"],
    id: "fora, no mês",
    existe: "gasto sem categoria no plano comeu o livre",
    resolvidoPor: ["deixar", "antiga"],
    volta: "mes-todo",
  },
  aporte: {
    nome: "Falta guardar o do mês",
    ondeAparece: ["Decidir (pilha)", "Resumo antigo", "Ritual"],
    id: "aporte, no mês ou na semana",
    existe: "do dia 10 em diante, falta 1 real ou mais do guardar planejado",
    resolvidoPor: ["deixar", "antiga"],
    volta: "semana",
  },
  meta: {
    nome: "Meta atrasada",
    ondeAparece: ["Decidir (pilha)", "Resumo antigo", "push/e-mail (cron alerts, goal)"],
    id: "meta-<id>, no mês",
    existe: "status BEHIND (menos de 85% do esperado), ou prazo vencido",
    resolvidoPor: ["guardar-mais", "mudar-data", "deixar", "antiga"],
    volta: "mes-todo",
  },
  reserva: {
    nome: "Reserva curta",
    ondeAparece: ["Decidir (pilha)", "Resumo antigo"],
    id: "reserva, no mês",
    existe: "reserva cobre menos meses que a meta dela (ou 6)",
    resolvidoPor: ["sobra-reserva", "deixar", "antiga"],
    volta: "mes-todo",
  },
  raiox: {
    nome: "O que se repete todo mês",
    ondeAparece: ["Decidir (pode esperar)", "Resumo antigo"],
    id: "raiox, no mês",
    existe: "assinaturas do Raio-X sem decisão",
    resolvidoPor: ["deixar", "antiga"],
    volta: "mes-todo",
  },
  sugestao: {
    nome: "Sugestão do Resumo novo que não é de categoria",
    ondeAparece: ["Resumo novo (cartão da sugestão)", "Resumo antigo (Para hoje: revisar, fechar, ritual)"],
    id: "<tipo>|<id> (falta-dado|cartao, dinheiro|<chave>, parcela|2026-10, hora-do-mes|fechar-2026-9)",
    existe: "ver regras.ts e dados.ts do Resumo novo",
    resolvidoPor: ["agora-nao", "botao", "deixar", "antiga"],
    volta: "proximo-extrato",
  },
} as const satisfies Record<AvisoAtual["tipo"], DeclaracaoDeAviso>;

/* ---------------------------------------------------------------- a decisão */

const ehDaCategoria = (a: AvisoAtual): a is Extract<AvisoAtual, { tipo: TipoDaCategoria }> => a.tipo === "estouro" || a.tipo === "ritmo" || a.tipo === "categoria-subiu";

/** A resposta foi dada com o mesmo extrato (ou sem marca): ainda vale. */
function mesmaMarca(r: Resposta, marca: string | undefined): boolean {
  return marca === undefined || r.marca === null || r.marca >= marca;
}

/** Uma resposta resolve este aviso? */
export function respostaResolve(a: AvisoAtual, r: Resposta): boolean {
  if (r.assunto !== assuntoDe(a)) return false;
  if (r.como === "boa") return false; // o "Boa" é do indo bem, que tem a semana dele (sugestoes.ts)
  const declarado = AVISOS[a.tipo].resolvidoPor as readonly ComoResolveu[];
  if (!declarado.includes(r.como)) return false;

  if (!ehDaCategoria(a)) {
    if (a.tipo === "sugestao") return mesmaMarca(r, a.marca);
    // Meta, reserva, guardar, fora, Raio-X: a resposta é do período (o mês, ou a semana do
    // "Guardo esta semana"); quem carrega já trouxe só as do período.
    return true;
  }

  // Tocar no "Ver limite" do Resumo leva ao Orçamento para resolver lá: some do Resumo até o
  // próximo extrato, e o aviso do Orçamento continua (é lá que ela vai responder).
  if (r.como === "botao") return a.tipo === "categoria-subiu" && mesmaMarca(r, a.marca);
  // O que ela respondeu ao "correndo rápido" foi antes de passar: passar do plano é novidade.
  if (a.tipo === "estouro" && r.sobre === "ritmo") return false;
  // Com o "Segurar em", o ritmo vira o cartão do combinado (que mostra se ela está cumprindo).
  if (a.tipo === "ritmo" && (r.como === "teto" || r.como === "teto-zero")) return true;
  if (r.mesTodo) return true;
  if (r.gastoNaHora !== null) return a.gasto - r.gastoNaHora < limiteDaVolta(r.excessoNaHora);
  if (r.passouNaHora !== null) return respostaSeguraOAviso(r.passouNaHora, a.passou);
  // "Agora não" do Resumo de antes desta regra (sem o gasto da hora): valia só para o cartão do
  // Resumo, até o próximo extrato. Continua assim.
  if (r.sobre === "categoria-subiu" && r.marca !== null) return a.tipo === "categoria-subiu" && mesmaMarca(r, a.marca);
  // Resposta antiga sem valor nenhum: segura o mês todo, como antes.
  return true;
}

/** O aviso já foi respondido (em qualquer tela) e a resposta ainda vale: não aparece. */
export function avisoResolvido(a: AvisoAtual, respostas: readonly Resposta[]): boolean {
  return respostas.some((r) => respostaResolve(a, r));
}

/* ---------------------------------------------------------------- de onde vêm as respostas */

/** O que fica na coluna `dados` de uma resposta nova (as antigas não têm). */
export type DadosDaResposta = { como?: ComoResolveu; gasto?: number; excesso?: number };

const COMOS: readonly string[] = ["pontual", "cobrir", "livre", "deixar", "lapis", "teto", "teto-zero", "agora-nao", "botao", "boa", "guardar-mais", "mudar-data", "sobra-reserva", "antiga"];
const lerComo = (v: unknown, padrao: ComoResolveu): ComoResolveu => (typeof v === "string" && COMOS.includes(v) ? (v as ComoResolveu) : padrao);
const numero = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** "estouro-SAUDE" → { sobre: "estouro", categoria: "SAUDE" }; "plano-ck1" → { sobre: "plano", ... }. */
export function categoriaDoId(id: string): { sobre: TipoDaCategoria | "plano"; categoria: string } | null {
  const m = /^(estouro|ritmo|plano)-(.+)$/.exec(id);
  if (!m) return null;
  return { sobre: m[1] as "estouro" | "ritmo" | "plano", categoria: m[2] };
}

/** Uma linha da tabela Decisao, só com o que a regra lê. */
export type LinhaDeDecisao = { tipo: string; chave: string | null; valor: number | null; descricao: string | null; dados: unknown };

/**
 * Traduz uma Decisao gravada por qualquer tela numa Resposta. Quem chama já filtrou o período
 * (o mês, a semana). Volta null para o que não é resposta a aviso.
 */
export function respostaDaDecisao(l: LinhaDeDecisao): Resposta | null {
  const dados = (l.dados && typeof l.dados === "object" ? l.dados : {}) as Record<string, unknown>;
  const gasto = numero(dados.gasto);
  if (l.tipo === "aviso_dispensado") {
    const id = (l.chave ?? "").split("|").slice(1).join("|");
    if (!id) return null;
    const cat = categoriaDoId(id);
    return {
      assunto: cat ? assuntoDaCategoria(cat.categoria) : id,
      sobre: cat ? cat.sobre : "outro",
      como: lerComo(dados.como, "antiga"),
      gastoNaHora: cat ? gasto : null,
      excessoNaHora: numero(dados.excesso) ?? (cat?.sobre === "estouro" ? l.valor : null),
      passouNaHora: cat?.sobre === "estouro" ? l.valor : null,
      marca: null,
      mesTodo: false,
    };
  }
  if (l.tipo === "teto") {
    const categoria = (l.chave ?? "").split("|")[1];
    if (!categoria) return null;
    const zero = (l.valor ?? 0) <= 0;
    return {
      assunto: assuntoDaCategoria(categoria),
      // O "Segurar em R$ X" nasce do aviso de ritmo; o "não gastar mais nada", do de passou.
      sobre: zero ? "estouro" : "ritmo",
      como: zero ? "teto-zero" : "teto",
      gastoNaHora: numero(dados.gastoNaHora),
      excessoNaHora: 0,
      passouNaHora: null,
      marca: null,
      mesTodo: zero,
    };
  }
  if (l.tipo === "sugestao_dispensada") {
    const [tipo, ...resto] = (l.chave ?? "").split("|");
    if (!(TIPOS_DE_SUGESTAO as readonly string[]).includes(tipo)) return null;
    const id = resto.join("|");
    const boa = dados.boa === true;
    const categoria = tipo === "categoria";
    return {
      assunto: categoria ? assuntoDaCategoria(id) : `${tipo}|${id}`,
      sobre: categoria ? "categoria-subiu" : "outro",
      como: boa ? "boa" : lerComo(dados.como, categoria ? "antiga" : "agora-nao"),
      gastoNaHora: categoria ? gasto : null,
      excessoNaHora: numero(dados.excesso),
      passouNaHora: null,
      marca: l.descricao ?? "",
      mesTodo: false,
    };
  }
  return null;
}

/**
 * O plano da categoria subiu neste mês sem resposta gravada (o Editar meu plano, ou o lápis antes
 * desta regra): conta como resposta, com o gasto da hora em que o plano mudou.
 */
export function respostaDoPlanoMexido(categoria: string, gastoNaHora: number): Resposta {
  return { assunto: assuntoDaCategoria(categoria), sobre: "plano", como: "lapis", gastoNaHora, excessoNaHora: 0, passouNaHora: null, marca: null, mesTodo: false };
}

/**
 * As respostas que o motor do Foco recebe no formato antigo (testes e quem chama sem o módulo): os
 * avisos dispensados ("estouro-SAUDE" com o quanto passava) e os tetos do mês.
 */
export function respostasDoFormatoAntigo(
  dispensados: readonly (string | { id: string; passou: number | null })[] = [],
  tetos: readonly { categoria: string; valor: number; gastoNaHora?: number | null }[] = [],
): Resposta[] {
  const out: Resposta[] = [];
  for (const d of dispensados) {
    const id = typeof d === "string" ? d : d.id;
    const passou = typeof d === "string" ? null : d.passou;
    const r = respostaDaDecisao({ tipo: "aviso_dispensado", chave: `x|${id}`, valor: passou, descricao: null, dados: null });
    if (r) out.push(r);
  }
  for (const t of tetos) {
    const r = respostaDaDecisao({ tipo: "teto", chave: `x|${t.categoria}`, valor: t.valor, descricao: null, dados: { gastoNaHora: t.gastoNaHora ?? null } });
    if (r) out.push(r);
  }
  return out;
}
