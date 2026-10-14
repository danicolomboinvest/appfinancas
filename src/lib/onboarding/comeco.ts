/**
 * O começo da versão nova (rodada 33 dos protótipos, aprovada; implementado em 11/10/2026).
 *
 * Quem acabou de entrar passa por: boas-vindas (3 telas), quatro perguntas (nome, renda, o que
 * quer agora, tema) e o PRIMEIRO LANÇAMENTO dentro do próprio começo (extrato, digitar ou falar).
 * A proposta mostrou 22% de reembolso entre quem não lança nada contra 10% entre quem traz o
 * extrato: o começo existe para ela terminar com o mês dela na tela.
 *
 * Lógica pura (sem React, sem banco) para ser testada à parte. O que fica guardado mora em
 * `User.comeco` (JSON). Quem já usava o app tem `comeco` nulo e `onboardedAt` preenchido: não vê
 * nada disto.
 */

// ---------------------------------------------------------------------------------------------
// Os passos
// ---------------------------------------------------------------------------------------------

/**
 * O começo enxuto (leva 1 do "Primeiro uso mais leve", aprovada em 14/10/2026): uma tela de
 * boas-vindas, a porta (extrato, digitar ou falar) e o envio do arquivo. O banco deixou de ser um
 * passo (pedido da dona, 14/10/2026): fica num link discreto do envio ("Como baixar do meu
 * banco?") e aparece sozinho quando ela não consegue baixar ou o arquivo não dá certo.
 * As outras boas-vindas, as perguntas (nome, renda, o que quer, tema) saíram do primeiro dia: o
 * nome vem da compra, a renda e o tema ficam em Configurações, e "o que você quer agora" vira o
 * próximo passo do segundo dia (ver `mostrarPerguntaDoSegundoDia`).
 */
export const PASSOS_BOAS_VINDAS = ["b1"] as const;
/** As telas que saíram em 14/10/2026. Quem parou numa delas volta na porta (ver `passoDeVolta`). */
export const PASSOS_ANTIGOS = ["b2", "b3", "nome", "renda", "quer", "tema"] as const;
/**
 * O primeiro lançamento: a porta e os três caminhos. `tutorial` é a tela de envio (com o passo a
 * passo do banco, quando ela escolhe um); `banco` é a ajuda por banco, opcional; `lendo` é o
 * extrato chegando e a conferência.
 */
export const PASSOS_LANCAMENTO = ["porta", "banco", "tutorial", "lendo", "digitar", "falar", "volta"] as const;

export type PassoDoComeco = (typeof PASSOS_BOAS_VINDAS)[number] | (typeof PASSOS_ANTIGOS)[number] | (typeof PASSOS_LANCAMENTO)[number];

const TODOS: readonly string[] = [...PASSOS_BOAS_VINDAS, ...PASSOS_ANTIGOS, ...PASSOS_LANCAMENTO];

/**
 * O começo fica fechado para quem o layout do app também barraria: sem e-mail confirmado ou sem
 * acesso. Admin sempre passa. O par do Casal simples também (usa o app inteiro no Pessoal dele,
 * sem compra própria e sem confirmar e-mail): antes ele era mandado de volta, e os cartões
 * "Enviar extrato" e "Anotar um gasto" da Visão geral dele não faziam nada.
 */
export function comecoBarrado(p: { admin: boolean; parLiberado: boolean; confirmada: boolean; uso: "completo" | "gratis" | "bloqueado" }): boolean {
  if (p.admin || p.parLiberado) return false;
  return !p.confirmada || p.uso === "bloqueado";
}

export function ehPasso(valor: unknown): valor is PassoDoComeco {
  return typeof valor === "string" && TODOS.includes(valor);
}

function ehAntigo(p: string): boolean {
  return (PASSOS_ANTIGOS as readonly string[]).includes(p);
}

/** A fase que aparece no topo: Boas-vindas, depois Seu primeiro mês. */
export function faseDoPasso(p: PassoDoComeco): "Boas-vindas" | "Seu primeiro mês" {
  return p === "b1" ? "Boas-vindas" : "Seu primeiro mês";
}

/**
 * A barra de cima: nada nas boas-vindas; 3 traços no primeiro mês (porta, envio, lendo). A ajuda
 * do banco, digitar e falar contam como o segundo traço.
 */
export function barraDoPasso(p: PassoDoComeco): { total: number; atual: number } {
  if (p === "b1" || ehAntigo(p)) return { total: 0, atual: 0 };
  const ordem: Record<string, number> = { porta: 0, tutorial: 1, volta: 1, banco: 1, digitar: 1, falar: 1, lendo: 2 };
  return { total: 3, atual: ordem[p] ?? 0 };
}

/** Para onde o "Voltar" leva, de cada passo. Nulo = sem voltar (primeira tela e a volta do resgate). */
export function passoAnterior(p: PassoDoComeco): PassoDoComeco | null {
  const mapa: Partial<Record<PassoDoComeco, PassoDoComeco>> = {
    porta: "b1",
    tutorial: "porta",
    banco: "tutorial",
    lendo: "tutorial",
    digitar: "porta",
    falar: "porta",
  };
  return mapa[p] ?? null;
}

/** O caminho de quem traz o extrato, tela por tela (Boas-vindas, Porta, Envio). */
export const CAMINHO_DO_EXTRATO: PassoDoComeco[] = ["b1", "porta", "tutorial"];

export function proximoPasso(p: PassoDoComeco): PassoDoComeco | null {
  const i = CAMINHO_DO_EXTRATO.indexOf(p);
  return i >= 0 && i < CAMINHO_DO_EXTRATO.length - 1 ? CAMINHO_DO_EXTRATO[i + 1] : null;
}

// ---------------------------------------------------------------------------------------------
// O que ela respondeu (User.comeco)
// ---------------------------------------------------------------------------------------------

export const QUERES = ["organizar", "dividas", "sonho", "investir"] as const;
export type Quer = (typeof QUERES)[number];

export type PortaDoComeco = "extrato" | "digitar" | "falar";
export type ComoLancou = "extrato" | "digitado" | "falado";

export const PASSOS_PRIMEIROS = ["extrato", "revisar", "plano", "meta", "lembretes"] as const;
export type PrimeiroPasso = (typeof PASSOS_PRIMEIROS)[number];

export type Comeco = {
  /** Onde ela parou (para voltar no mesmo ponto). */
  passo: PassoDoComeco;
  /** Como ela quer ser chamada. */
  apelido: string | null;
  /** Renda aproximada por mês, em reais. Nula = não disse (ou ainda não chegou na pergunta). */
  renda: number | null;
  semRenda: boolean;
  quer: Quer | null;
  porta: PortaDoComeco | null;
  /** Chave do banco da vez (ver BANCOS_DO_COMECO). */
  banco: string | null;
  /** Os bancos que ela marcou (pode ser mais de um), na ordem do passo a passo. */
  bancos: string[];
  /** Os bancos cujo extrato já entrou. Os que faltam viram Primeiros passos. */
  bancosFeitos: string[];
  /** Como entrou o primeiro lançamento dentro do começo. Nulo = pulou sem lançar. */
  lancou: ComoLancou | null;
  /** O mês que o extrato montou ("2026-09"), para o "Esse é o seu setembro". */
  mesDoExtrato: string | null;
  /** Revisou o que o app não sabia, dentro do começo. */
  revisou: boolean;
  /** Tocou em Pular ou em "Faço isso depois". */
  pulou: boolean;
  /** O cartão do "aha" ainda aparece na Visão geral. */
  aha: boolean;
  /** Passos marcados à mão no cartão Primeiros passos. */
  manual: PrimeiroPasso[];
  /** Fechou o cartão depois de terminar os cinco. */
  passosFechados: boolean;
  /** Quando terminou (ou pulou), ISO. */
  terminouEm: string | null;
};

export const COMECO_NOVO: Comeco = {
  passo: "b1",
  apelido: null,
  renda: null,
  semRenda: false,
  quer: null,
  porta: null,
  banco: null,
  bancos: [],
  bancosFeitos: [],
  lancou: null,
  mesDoExtrato: null,
  revisou: false,
  pulou: false,
  aha: false,
  manual: [],
  passosFechados: false,
  terminouEm: null,
};

export const RENDA_MIN = 1000;
/** Até aqui a régua anda de R$ 250 em R$ 250; depois, de R$ 5 mil em R$ 5 mil até RENDA_TOPO_DA_REGUA. */
export const RENDA_MAX = 20000;
export const RENDA_PASSO = 250;
export const RENDA_PASSO_ALTO = 5000;
/** O fim da régua (12/10/2026). Acima disso, só digitando: a renda não tem teto. */
export const RENDA_TOPO_DA_REGUA = 200000;
/** Onde a régua começa: um valor do meio da faixa da maioria (a proposta usa R$ 4.500). */
export const RENDA_INICIAL = 4500;
/** A régua tem 1000 posições: as 700 primeiras vão de R$ 1 mil a R$ 20 mil, as 300 últimas até R$ 200 mil. */
export const POSICOES_DA_REGUA = 1000;
const POSICAO_DOS_20_MIL = 700;

/**
 * Renda da régua ou digitada: arredonda no passo e fica acima do mínimo. Sem teto desde 12/10/2026
 * (quem ganha mais de R$ 20 mil não conseguia informar).
 */
export function rendaDaRegua(valor: unknown): number | null {
  const n = typeof valor === "number" ? valor : typeof valor === "string" ? Number(valor) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  const passo = n > RENDA_MAX ? RENDA_PASSO_ALTO / 5 : RENDA_PASSO;
  const arredondado = Math.round(n / passo) * passo;
  return Math.min(100_000_000, Math.max(RENDA_MIN, arredondado));
}

/** Da posição da régua (0 a 1000) para a renda, com passos maiores acima de R$ 20 mil. */
export function rendaDaPosicao(posicao: number): number {
  const p = Math.max(0, Math.min(POSICOES_DA_REGUA, posicao));
  if (p <= POSICAO_DOS_20_MIL) return Math.round((RENDA_MIN + (p / POSICAO_DOS_20_MIL) * (RENDA_MAX - RENDA_MIN)) / RENDA_PASSO) * RENDA_PASSO;
  const f = (p - POSICAO_DOS_20_MIL) / (POSICOES_DA_REGUA - POSICAO_DOS_20_MIL);
  return Math.round((RENDA_MAX + f * (RENDA_TOPO_DA_REGUA - RENDA_MAX)) / RENDA_PASSO_ALTO) * RENDA_PASSO_ALTO;
}

/** O contrário: onde a renda fica na régua (acima do topo, no fim). */
export function posicaoDaRenda(renda: number): number {
  if (renda <= RENDA_MAX) return Math.round((Math.max(0, renda - RENDA_MIN) / (RENDA_MAX - RENDA_MIN)) * POSICAO_DOS_20_MIL);
  return Math.min(POSICOES_DA_REGUA, Math.round(POSICAO_DOS_20_MIL + ((renda - RENDA_MAX) / (RENDA_TOPO_DA_REGUA - RENDA_MAX)) * (POSICOES_DA_REGUA - POSICAO_DOS_20_MIL)));
}

/** O apelido: sem espaço sobrando, até 24 letras, sem nada que pareça tag. */
export function apelidoLimpo(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpo = valor.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 24).trim();
  return limpo || null;
}

/**
 * Lê o JSON gravado sem confiar nele: campo que falta ou veio torto volta ao padrão. Nulo (quem
 * nunca passou pelo começo novo) devolve nulo, e é isso que separa quem já usava o app.
 */
export function lerComeco(json: unknown): Comeco | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const j = json as Record<string, unknown>;
  const quer = typeof j.quer === "string" && (QUERES as readonly string[]).includes(j.quer) ? (j.quer as Quer) : null;
  const porta = j.porta === "extrato" || j.porta === "digitar" || j.porta === "falar" ? j.porta : null;
  const lancou = j.lancou === "extrato" || j.lancou === "digitado" || j.lancou === "falado" ? j.lancou : null;
  const listaDeBancos = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && !!bancoDoComeco(x)))] : []);
  const manual = Array.isArray(j.manual) ? (j.manual.filter((x) => (PASSOS_PRIMEIROS as readonly unknown[]).includes(x)) as PrimeiroPasso[]) : [];
  return {
    passo: ehPasso(j.passo) ? j.passo : "b1",
    apelido: apelidoLimpo(j.apelido),
    renda: rendaDaRegua(j.renda),
    semRenda: j.semRenda === true,
    quer,
    porta,
    banco: typeof j.banco === "string" && bancoDoComeco(j.banco) ? j.banco : null,
    bancos: listaDeBancos(j.bancos),
    bancosFeitos: listaDeBancos(j.bancosFeitos),
    lancou,
    mesDoExtrato: typeof j.mesDoExtrato === "string" && /^\d{4}-\d{2}$/.test(j.mesDoExtrato) ? j.mesDoExtrato : null,
    revisou: j.revisou === true,
    pulou: j.pulou === true,
    aha: j.aha === true,
    manual: [...new Set(manual)],
    passosFechados: j.passosFechados === true,
    terminouEm: typeof j.terminouEm === "string" ? j.terminouEm : null,
  };
}

/** O que a tela pode mudar de uma vez (nunca o que é calculado no servidor). */
export type MudancaDoComeco = Partial<Pick<Comeco, "passo" | "apelido" | "renda" | "semRenda" | "quer" | "porta" | "banco" | "bancos">>;

/** Junta uma mudança vinda da tela, passando cada campo pela mesma limpeza da leitura. */
export function juntarComeco(atual: Comeco | null, mudanca: MudancaDoComeco): Comeco {
  const base = atual ?? COMECO_NOVO;
  return lerComeco({ ...base, ...mudanca }) ?? base;
}

/** Como o primeiro lançamento terminou: o começo acaba e a Visão geral mostra o "aha". */
export function terminarComLancamento(atual: Comeco | null, como: ComoLancou, extra: { mesDoExtrato?: string | null; revisou?: boolean; banco?: string | null } = {}, agora = new Date()): Comeco {
  const base = atual ?? COMECO_NOVO;
  const banco = extra.banco && bancoDoComeco(extra.banco) ? extra.banco : null;
  return {
    ...base,
    bancosFeitos: banco && !base.bancosFeitos.includes(banco) ? [...base.bancosFeitos, banco] : base.bancosFeitos,
    lancou: base.lancou === "extrato" ? "extrato" : como,
    mesDoExtrato: extra.mesDoExtrato ?? base.mesDoExtrato,
    revisou: base.revisou || extra.revisou === true,
    pulou: false,
    aha: true,
    passo: "porta",
    terminouEm: base.terminouEm ?? agora.toISOString(),
  };
}

/** Pular (de qualquer tela) ou "Faço isso depois": nada do que ela respondeu se perde. */
export function pularComeco(atual: Comeco | null, ondeParou: PassoDoComeco, agora = new Date()): Comeco {
  const base = atual ?? COMECO_NOVO;
  return { ...base, passo: ondeParou, pulou: true, terminouEm: base.terminouEm ?? agora.toISOString() };
}

/**
 * "Ver o começo de novo" e os convites da Visão geral: abre no ponto onde parou. Quem volta pelo
 * convite do extrato cai direto no envio (com ou sem banco escolhido).
 */
export function passoDeVolta(c: Comeco | null, pedido: string | null | undefined): PassoDoComeco {
  if (ehPasso(pedido) && !ehAntigo(pedido)) return pedido;
  if (!c) return "b1";
  // Os passos do extrato não reabrem no meio da leitura: o arquivo não fica guardado. E quem
  // parou na escolha do banco (quando ela ainda era um passo) volta no envio.
  if (c.passo === "lendo" || c.passo === "banco") return "tutorial";
  // Parou numa das telas que saíram (14/10/2026): segue da porta.
  if (ehAntigo(c.passo)) return "porta";
  return c.passo;
}

// ---------------------------------------------------------------------------------------------
// O que ela quer agora: muda o atalho do "aha"
// ---------------------------------------------------------------------------------------------

export const OPCOES_QUER: { chave: Quer; titulo: string; icone: "lista" | "desce" | "alvo" | "sobe" }[] = [
  { chave: "organizar", titulo: "Organizar o mês", icone: "lista" },
  { chave: "dividas", titulo: "Sair das dívidas", icone: "desce" },
  { chave: "sonho", titulo: "Guardar para um sonho", icone: "alvo" },
  { chave: "investir", titulo: "Começar a investir", icone: "sobe" },
];

/** O atalho que aparece embaixo do "aha", conforme o que ela quer (proposta, passo 2). */
export function atalhoDoQuer(quer: Quer | null, empresaOuCasal = false): { rotulo: string; href: string } {
  if (!empresaOuCasal && quer === "dividas") return { rotulo: "Ver o plano das dívidas", href: "/dividas" };
  if (quer === "sonho") return { rotulo: "Criar o meu sonho", href: "/planejamento/metas" };
  if (!empresaOuCasal && quer === "investir") return { rotulo: "Montar minha estratégia", href: "/carteira/estrategia" };
  return { rotulo: "Montar o meu plano", href: "/orcamento" };
}

/**
 * "O que você quer agora?" saiu do começo (14/10/2026) e volta como o próximo passo do SEGUNDO dia
 * na Visão geral: aparece a partir do dia seguinte ao fim do começo, até ela responder.
 * `hoje` é a data de Brasília ("2026-10-15").
 */
export function mostrarPerguntaDoSegundoDia(c: Comeco | null, hoje: string): boolean {
  if (!c || c.quer !== null || !c.terminouEm) return false;
  const fim = Date.parse(c.terminouEm);
  if (!Number.isFinite(fim)) return false;
  const diaDoFim = new Date(fim - 3 * 3600_000).toISOString().slice(0, 10);
  return diaDoFim < hoje;
}

// ---------------------------------------------------------------------------------------------
// Os temas na pergunta "Qual cara combina com você?"
// ---------------------------------------------------------------------------------------------

/**
 * A ordem e as frases da pergunta do tema. Quem entra começa no Padrão (pedido da dona, 11/10),
 * por isso ele vem primeiro e já marcado.
 */
export const TEMAS_DO_COMECO: { chave: "padrao" | "girly" | "manifestacao" | "titanio"; nome: string; frase: string }[] = [
  { chave: "padrao", nome: "Padrão", frase: "Direto, sem enfeite" },
  { chave: "girly", nome: "Girly", frase: "Rosado, fala com carinho" },
  { chave: "manifestacao", nome: "Manifestação", frase: "Calmo, céu de fim de tarde" },
  { chave: "titanio", nome: "Titânio", frase: "metal e champanhe" },
];

export type CaraDoCartao = {
  fundo: string;
  /** As cores sólidas do fundo, para conferir o contraste do texto (AA) em teste. */
  paradas: string[];
  tinta: string;
  suave: string;
  /** O detalhe do tema: contorno e check do escolhido. */
  destaque: string;
  /** O check em cima do destaque. */
  check: string;
  /** Fio de luz por dentro (o metal do Titânio). */
  fio?: string;
};

/**
 * Cada cartão da pergunta do tema é inteiro da cara do tema (pedido da dona, 11/10): o fundo do
 * herói dele, a tinta com contraste AA e o destaque no contorno e no check. Claro e escuro.
 */
export const CARTOES_DOS_TEMAS: Record<(typeof TEMAS_DO_COMECO)[number]["chave"], { fonte: string; estilo?: "italic"; claro: CaraDoCartao; escuro: CaraDoCartao }> = {
  padrao: {
    fonte: "var(--font-figtree)",
    claro: { fundo: "linear-gradient(165deg, #ffffff 0%, #f6f5f2 70%, #f3eadb 100%)", paradas: ["#ffffff", "#f6f5f2", "#f3eadb"], tinta: "#141414", suave: "#46433e", destaque: "#8a500c", check: "#ffffff" },
    escuro: { fundo: "radial-gradient(70% 90% at 100% 0%, rgba(209, 170, 115, 0.16), rgba(209, 170, 115, 0) 70%), linear-gradient(165deg, #22201d 0%, #191714 100%)", paradas: ["#22201d", "#191714", "#2e2820"], tinta: "#e6e1da", suave: "#a9a49d", destaque: "#d1aa73", check: "#141414" },
  },
  girly: {
    fonte: "var(--font-cormorant)",
    estilo: "italic",
    claro: {
      fundo: "radial-gradient(48% 52% at 82% 24%, #e3d2ee, rgba(227, 210, 238, 0) 100%), radial-gradient(56% 60% at 14% 84%, #f2c4d0, rgba(242, 196, 208, 0) 100%), radial-gradient(52% 56% at 76% 86%, #edd3be, rgba(237, 211, 190, 0) 100%), #f5dce1",
      paradas: ["#f5dce1", "#f2c4d0", "#e3d2ee", "#edd3be"],
      tinta: "#150e10",
      suave: "#3d2e32",
      destaque: "#9c3d5c", check: "#ffffff",
    },
    escuro: { fundo: "linear-gradient(135deg, #4a2433 0%, #3a1d2a 55%, #2b1c22 100%)", paradas: ["#4a2433", "#3a1d2a", "#2b1c22"], tinta: "#f6e4ea", suave: "#dcc0ca", destaque: "#e7a9bd", check: "#2b1c22" },
  },
  manifestacao: {
    fonte: "var(--font-urbanist)",
    claro: { fundo: "linear-gradient(135deg, #c9b8f2 0%, #b7a3ea 45%, #e2bfdc 75%, #f4cdb8 100%)", paradas: ["#c9b8f2", "#b7a3ea", "#e2bfdc", "#f4cdb8"], tinta: "#191826", suave: "#2f2b4f", destaque: "#463a94", check: "#ffffff" },
    escuro: { fundo: "linear-gradient(135deg, #3b2f72 0%, #4a3584 45%, #5e3b78 75%, #6b3f63 100%)", paradas: ["#3b2f72", "#4a3584", "#5e3b78", "#6b3f63"], tinta: "#f1edff", suave: "#d6cff2", destaque: "#c9bff5", check: "#191826" },
  },
  titanio: {
    fonte: "var(--font-geist)",
    claro: {
      fundo: "linear-gradient(135deg, #e9eaec 0%, #c9ccd1 38%, #f1f2f3 55%, #b9bdc3 100%)",
      paradas: ["#e9eaec", "#c9ccd1", "#f1f2f3", "#b9bdc3"],
      tinta: "#111214",
      suave: "#3c3e43",
      destaque: "#7a5a2b", check: "#ffffff",
      fio: "inset 0 1px 0 rgba(255, 255, 255, 0.9), inset 0 0 0 1px rgba(17, 18, 20, 0.16)",
    },
    escuro: {
      fundo: "linear-gradient(118deg, #23262b 0%, #2a2d33 22%, #3a3e46 40%, #5a5f68 47%, #3a3e46 54%, #2a2d33 72%, #23262b 100%)",
      paradas: ["#23262b", "#2a2d33", "#3a3e46", "#5a5f68"],
      tinta: "#f6f2ec",
      suave: "#e2dcd2",
      destaque: "#d8bc88", check: "#141518",
      fio: "inset 0 1px 0 rgba(255, 255, 255, 0.24), inset 0 0 0 1px rgba(255, 255, 255, 0.12)",
    },
  },
};

/** O CSS dos quatro cartões, com o claro e o escuro (a classe `light` do <html> decide). */
export function cssDosCartoesDosTemas(): string {
  const bloco = (c: CaraDoCartao) => `--ct-fundo:${c.fundo};--ct-tinta:${c.tinta};--ct-suave:${c.suave};--ct-destaque:${c.destaque};--ct-fio:${c.fio ?? "none"};--ct-check:${c.check};`;
  return Object.entries(CARTOES_DOS_TEMAS)
    .map(([k, v]) => `html.light .cartao-tema-${k}{${bloco(v.claro)}}html:not(.light) .cartao-tema-${k}{${bloco(v.escuro)}}.cartao-tema-${k} .cartao-tema-nome{font-family:${v.fonte};font-style:${v.estilo ?? "normal"}}`)
    .join("");
}

// ---------------------------------------------------------------------------------------------
// Os bancos: a ajuda "Como baixar do meu banco?" e o passo a passo de baixar o extrato
// ---------------------------------------------------------------------------------------------

export type BancoDoComeco = {
  chave: string;
  nome: string;
  /** "do" ou "da" ("No app do Nubank", "No app da Caixa"). */
  artigo: "do" | "da";
  /** O nome que o catálogo de marcas reconhece (logo real). Vazio = sem logo: a tela mostra a sigla. */
  marca: string;
  /** A sigla do quadradinho quando não há logo ("BRB", "BV"). */
  sigla?: string;
  /** Outros jeitos de escrever o nome, para a busca ("cef", "bb", "votorantim"). */
  apelidos?: string[];
};

/**
 * Os bancos da ajuda "Como baixar do meu banco?" (opcional desde 14/10/2026), na ordem da tela (14/10/2026: a dona pediu mais bancos e um
 * caminho claro para quem não acha o dela). Os `PRINCIPAIS_DO_COMECO` primeiros aparecem na grade;
 * os outros, em "Ver mais bancos" e na busca. O passo a passo de cada um (extrato, fatura, formato
 * e a fonte oficial) mora em lib/onboarding/bancos.ts; sem fonte oficial, o caminho genérico.
 * Sem selo "a conferir" em nenhum (decisão da dona, 11/10/2026).
 */
export const BANCOS_DO_COMECO: BancoDoComeco[] = [
  { chave: "nubank", nome: "Nubank", artigo: "do", marca: "Nubank", apelidos: ["nu", "nu pagamentos"] },
  { chave: "itau", nome: "Itaú", artigo: "do", marca: "Itau", apelidos: ["itau unibanco"] },
  { chave: "bradesco", nome: "Bradesco", artigo: "do", marca: "Bradesco" },
  { chave: "bb", nome: "Banco do Brasil", artigo: "do", marca: "Banco do Brasil", apelidos: ["bb", "brasil"] },
  { chave: "caixa", nome: "Caixa", artigo: "da", marca: "Caixa Economica", apelidos: ["cef", "caixa economica", "caixa tem"] },
  { chave: "santander", nome: "Santander", artigo: "do", marca: "Santander" },
  { chave: "inter", nome: "Inter", artigo: "do", marca: "Banco Inter", apelidos: ["banco inter"] },
  { chave: "c6", nome: "C6 Bank", artigo: "do", marca: "C6 Bank", apelidos: ["c6"] },
  { chave: "mp", nome: "Mercado Pago", artigo: "do", marca: "Mercado Pago", apelidos: ["mercado livre"] },
  { chave: "picpay", nome: "PicPay", artigo: "do", marca: "PicPay", apelidos: ["pic pay"] },
  { chave: "btg", nome: "BTG Pactual", artigo: "do", marca: "BTG Pactual", apelidos: ["btg"] },
  { chave: "xp", nome: "XP", artigo: "da", marca: "XP Investimentos", apelidos: ["xp investimentos"] },
  { chave: "rico", nome: "Rico", artigo: "da", marca: "Rico Investimentos" },
  { chave: "sicoob", nome: "Sicoob", artigo: "do", marca: "Sicoob" },
  { chave: "sicredi", nome: "Sicredi", artigo: "do", marca: "Sicredi" },
  { chave: "neon", nome: "Neon", artigo: "do", marca: "Banco Neon" },
  { chave: "pagbank", nome: "PagBank", artigo: "do", marca: "PagBank", apelidos: ["pagseguro", "pag seguro"] },
  { chave: "original", nome: "Banco Original", artigo: "do", marca: "Banco Original", apelidos: ["original"] },
  { chave: "banrisul", nome: "Banrisul", artigo: "do", marca: "", sigla: "BRS" },
  { chave: "brb", nome: "BRB", artigo: "do", marca: "", sigla: "BRB", apelidos: ["banco de brasilia"] },
  { chave: "safra", nome: "Safra", artigo: "do", marca: "Banco Safra", apelidos: ["banco safra"] },
  { chave: "willbank", nome: "Will Bank", artigo: "do", marca: "Will Bank", apelidos: ["will"] },
  { chave: "next", nome: "Next", artigo: "do", marca: "", sigla: "NX" },
  { chave: "ame", nome: "Ame", artigo: "da", marca: "", sigla: "AME", apelidos: ["ame digital"] },
  { chave: "pan", nome: "Banco Pan", artigo: "do", marca: "Banco Pan", apelidos: ["pan"] },
  { chave: "bv", nome: "BV", artigo: "do", marca: "", sigla: "BV", apelidos: ["banco bv", "votorantim"] },
  { chave: "agibank", nome: "Agibank", artigo: "do", marca: "Agibank", apelidos: ["agi"] },
  { chave: "personnalite", nome: "Itaú Personnalité", artigo: "do", marca: "Itau", apelidos: ["personnalite", "itau personnalite"] },
  { chave: "nomad", nome: "Nomad", artigo: "da", marca: "Nomad" },
  { chave: "eqi", nome: "EQI Investimentos", artigo: "da", marca: "EQI Investimentos", apelidos: ["eqi"] },
  { chave: "agora", nome: "Ágora", artigo: "da", marca: "Agora Investimentos" },
  { chave: "wise", nome: "Wise", artigo: "do", marca: "Wise" },
  { chave: "binance", nome: "Binance", artigo: "da", marca: "Binance" },
  { chave: "mercadobitcoin", nome: "Mercado Bitcoin", artigo: "do", marca: "Mercado Bitcoin" },
];

/** Quantos bancos a grade mostra antes do "Ver mais bancos" (4 linhas de 3). */
export const PRINCIPAIS_DO_COMECO = 12;

/** "Meu banco não está aqui": o passo a passo genérico, com o nome que ela escrever (se escrever). */
export const BANCO_OUTRO: BancoDoComeco = { chave: "outro", nome: "seu banco", artigo: "do", marca: "" };

export function bancoDoComeco(chave: string | null | undefined): BancoDoComeco | null {
  if (!chave) return null;
  if (chave === "outro") return BANCO_OUTRO;
  return BANCOS_DO_COMECO.find((b) => b.chave === chave) ?? null;
}

/** Sem acento, sem maiúscula, só letras e números separados por espaço. */
export function textoDeBusca(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * A busca da tela do banco: casa pelo começo de qualquer palavra do nome ou de um apelido
 * ("ita" acha Itaú e Itaú Personnalité, "cef" acha a Caixa). Busca vazia devolve todos.
 */
export function buscarBancos(texto: string, bancos: BancoDoComeco[] = BANCOS_DO_COMECO): BancoDoComeco[] {
  const q = textoDeBusca(texto);
  if (!q) return bancos;
  return bancos.filter((b) => {
    const nomes = [b.nome, b.marca, ...(b.apelidos ?? [])].map(textoDeBusca).filter(Boolean);
    return nomes.some((n) => n.startsWith(q) || n.split(" ").some((palavra) => palavra.startsWith(q)));
  });
}

/**
 * O banco que ela escreveu em "Meu banco não está aqui", pronto para virar evento de uso: só
 * letras, sem número (nada de conta, agência ou CPF), até 24 caracteres. Vazio ou parecido com um
 * banco que já está na lista, nulo.
 */
export function bancoQueFalta(texto: unknown): string | null {
  if (typeof texto !== "string") return null;
  const limpo = textoDeBusca(texto).replace(/[0-9]/g, " ").replace(/\s+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24).replace(/-+$/, "");
  return limpo.length >= 2 ? limpo : null;
}

// ---------------------------------------------------------------------------------------------
// Primeiros passos
// ---------------------------------------------------------------------------------------------

export const TITULOS_PRIMEIROS: Record<PrimeiroPasso, { titulo: string; tempo: string }> = {
  extrato: { titulo: "Trazer o extrato", tempo: "" },
  revisar: { titulo: "Revisar os lançamentos", tempo: "1 min" },
  plano: { titulo: "Montar o plano", tempo: "3 min" },
  meta: { titulo: "Criar 1 meta", tempo: "1 min" },
  lembretes: { titulo: "Ativar lembretes", tempo: "10 s" },
};

/**
 * O prêmio de terminar os Primeiros passos. A proposta sugeria "um tema exclusivo", mas os temas
 * agora são quatro e todos abertos (pendência 5.1.6, ainda sem decisão da dona). Proposta: o
 * primeiro mês fechado, que o app já sabe montar (o fechamento do mês). Para trocar o prêmio,
 * basta trocar estas duas frases.
 */
export const PREMIO_DOS_PRIMEIROS_PASSOS = {
  antes: "Ao terminar, o SPI monta o seu primeiro mês fechado.",
  depois: "Seu SPI está montado. No fim do mês, eu monto o seu primeiro mês fechado.",
};

/** Os bancos marcados cujo extrato ainda não entrou, na ordem em que ela marcou. */
export function bancosPendentes(c: Comeco): string[] {
  return c.bancos.filter((b) => !c.bancosFeitos.includes(b));
}

/** O próximo banco do passo a passo ("2 de 3: Itaú"), ou nulo quando acabou. */
export function proximoBanco(c: Comeco): { chave: string; posicao: number; total: number } | null {
  const pend = bancosPendentes(c);
  if (pend.length === 0) return null;
  return { chave: pend[0], posicao: c.bancos.indexOf(pend[0]) + 1, total: c.bancos.length };
}

/** O título do passo do extrato: com banco faltando, diz qual ("Trazer o extrato do Itaú"). */
export function tituloDoPassoDoExtrato(c: Comeco): string {
  const pend = bancosPendentes(c);
  const b = bancoDoComeco(pend[0]);
  if (!b || pend.length === 0) return TITULOS_PRIMEIROS.extrato.titulo;
  const mais = pend.length > 1 ? ` e mais ${pend.length - 1}` : "";
  return `Trazer o extrato ${b.artigo} ${b.nome}${mais}`;
}

export type SinaisDosPassos = {
  /** Algum lançamento veio de arquivo (extrato ou fatura) neste perfil. */
  temImportacao: boolean;
  /** Existe orçamento com valor neste perfil. */
  temOrcamento: boolean;
  /** Existe meta neste perfil. */
  temMeta: boolean;
  /** Algum aparelho dela aceitou os avisos. */
  temLembretes: boolean;
};

/**
 * Os cinco passos, feitos pelos dados (não pela lembrança da tela) ou marcados à mão. Revisar
 * conta quando ela revisou dentro do começo, ou quando trouxe o extrato e nada precisou dela.
 */
export function primeirosPassos(c: Comeco, s: SinaisDosPassos): { passos: { chave: PrimeiroPasso; feito: boolean }[]; feitos: number; completo: boolean } {
  const feitoPelosDados: Record<PrimeiroPasso, boolean> = {
    extrato: (s.temImportacao || c.lancou === "extrato") && bancosPendentes(c).length === 0,
    revisar: c.revisou,
    plano: s.temOrcamento,
    meta: s.temMeta,
    lembretes: s.temLembretes,
  };
  const passos = PASSOS_PRIMEIROS.map((chave) => ({ chave, feito: feitoPelosDados[chave] || c.manual.includes(chave) }));
  const feitos = passos.filter((p) => p.feito).length;
  return { passos, feitos, completo: feitos === passos.length };
}

/** Marca ou desmarca à mão. Desmarcar só tira a marca manual; o que os dados provam continua. */
export function alternarPasso(c: Comeco, chave: PrimeiroPasso): Comeco {
  const manual = c.manual.includes(chave) ? c.manual.filter((k) => k !== chave) : [...c.manual, chave];
  return { ...c, manual };
}

/** O cartão aparece até ela fechar depois de completo. */
export function mostrarPrimeirosPassos(c: Comeco | null): boolean {
  return !!c && c.terminouEm !== null && !c.passosFechados;
}

// ---------------------------------------------------------------------------------------------
// O "aha" e o convite
// ---------------------------------------------------------------------------------------------

/**
 * O que a Visão geral mostra logo depois do começo:
 * - `mes`: trouxe o extrato. "Pronto, Ana. Esse é o seu setembro." com o gasto e a maior categoria;
 * - `primeiroGasto`: digitou ou falou um gasto. "Seu primeiro gasto está aqui." e o convite do extrato;
 * - `convite`: pulou sem lançar nada (e o perfil continua sem lançamento). "Seu mês ainda está em branco."
 * - `nada`: ela já fechou o "aha", ou nunca passou pelo começo novo.
 */
export function oQueMostrarDepois(c: Comeco | null, temLancamento: boolean): "mes" | "primeiroGasto" | "convite" | "nada" {
  if (!c || c.terminouEm === null) return "nada";
  if (c.aha && c.lancou === "extrato") return "mes";
  if (c.aha && (c.lancou === "digitado" || c.lancou === "falado")) return "primeiroGasto";
  if (!temLancamento && c.lancou === null) return "convite";
  return "nada";
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "2026-09" → { ano, mes, nome: "setembro" }. */
export function mesDoTexto(texto: string | null | undefined): { ano: number; mes: number; nome: string } | null {
  const m = texto?.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) return null;
  return { ano: Number(m[1]), mes, nome: MESES[mes - 1] };
}

/** O nome do mês corrente ("outubro"), para "Agora, Ana, o seu outubro." */
export function nomeDoMes(data: Date): string {
  return MESES[data.getMonth()];
}

/**
 * O "aha" a partir do mês montado (lib/import/revelacao.ts): quanto saiu, a maior categoria e a
 * barrinha das três maiores mais o resto. Sem gasto no mês, nulo: a tela não inventa nada.
 */
export function ahaDoMes(r: { saiu: number; maiores: { rotulo: string; valor: number; fracao: number }[] } | null): {
  total: number;
  maior: { rotulo: string; valor: number; pct: number } | null;
  barras: { rotulo: string; pct: number }[];
  restoPct: number;
} | null {
  if (!r || !Number.isFinite(r.saiu) || r.saiu <= 0) return null;
  const maiores = r.maiores.filter((m) => m.valor > 0);
  const barras = maiores.map((m) => ({ rotulo: m.rotulo, pct: Math.round(m.fracao * 100) }));
  const usado = barras.reduce((t, b) => t + b.pct, 0);
  const m0 = maiores[0];
  return { total: r.saiu, maior: m0 ? { rotulo: m0.rotulo, valor: m0.valor, pct: Math.round(m0.fracao * 100) } : null, barras, restoPct: Math.max(0, 100 - usado) };
}

// ---------------------------------------------------------------------------------------------
// O primeiro gasto digitado
// ---------------------------------------------------------------------------------------------

/**
 * Os três atalhos do "Um gasto de hoje": as categorias mais comuns do primeiro gasto (proposta do
 * primeiro uso, 14/10/2026). O nome na tela é o da categoria no tema dela.
 */
export const ATALHOS_DO_GASTO: { categoria: "ALIMENTACAO" | "TRANSPORTE" | "LAZER" }[] = [{ categoria: "ALIMENTACAO" }, { categoria: "TRANSPORTE" }, { categoria: "LAZER" }];

/** O teclado do valor: dígitos em centavos ("1250" = R$ 12,50), no máximo 7 dígitos. */
export function teclarValor(atual: string, tecla: string): string {
  const s = atual.replace(/\D/g, "");
  if (tecla === "apagar") return s.slice(0, -1);
  if (!/^\d{1,2}$/.test(tecla)) return s;
  return (s + tecla).replace(/^0+/, "").slice(0, 7);
}

export function centavosParaReais(digitos: string): number {
  const n = Number(digitos.replace(/\D/g, "") || "0");
  return Math.round(n) / 100;
}

// ---------------------------------------------------------------------------------------------
// O funil (UsageEvent)
// ---------------------------------------------------------------------------------------------

/**
 * Os eventos novos do começo, gravados no UsageEvent (lista fechada no /api/track). O `path` diz
 * o detalhe: qual pergunta, qual porta, qual banco. Nunca o valor da renda nem o nome dela.
 */
export const EVENTOS_DO_COMECO = {
  comecou: "comeco_comecou",
  pergunta: "comeco_pergunta",
  porta: "comeco_porta",
  banco: "comeco_banco",
  enviou: "comeco_enviou",
  revisou: "comeco_revisou",
  viuMes: "comeco_viu_mes",
  pulou: "comeco_pulou",
  /** "Meu banco não está aqui" (14/10/2026): o path leva o nome que ela escreveu, limpo (ver `bancoQueFalta`). */
  faltaBanco: "comeco_falta_banco",
  /** O link "Moro fora do Brasil" da porta: a moeda escolhida. */
  moeda: "comeco_moeda",
} as const;

export type EventoDoComeco = (typeof EVENTOS_DO_COMECO)[keyof typeof EVENTOS_DO_COMECO];

export const NOMES_DOS_EVENTOS_DO_COMECO: readonly string[] = Object.values(EVENTOS_DO_COMECO);

/** O caminho gravado com o evento. Só pedaços conhecidos: nada que ela digitou vai parar aqui. */
export function caminhoDoEvento(evento: EventoDoComeco, detalhe?: string | null): string {
  const seguro = detalhe && /^[a-z0-9-]{1,24}$/.test(detalhe) ? `/${detalhe}` : "";
  return `/comecar/${evento.replace("comeco_", "")}${seguro}`;
}

/**
 * O funil, na ordem do começo: quantas PESSOAS passaram por cada marca. As perguntas saíram do
 * começo em 14/10/2026, e com elas a linha "Respondeu as perguntas". O banco também deixou de ser
 * um passo: "Pediu ajuda do banco" fica no fim, fora da sequência (quem não precisou não passa).
 */
export function montarFunilDoComeco(contagem: Partial<Record<string, number>>): { rotulo: string; pessoas: number }[] {
  const n = (k: string) => contagem[k] ?? 0;
  return [
    { rotulo: "Começou", pessoas: n("comeco_comecou") },
    { rotulo: "Escolheu a porta", pessoas: n("comeco_porta") },
    { rotulo: "Enviou o extrato", pessoas: n("comeco_enviou") },
    { rotulo: "Revisou", pessoas: n("comeco_revisou") },
    { rotulo: "Viu o mês", pessoas: n("comeco_viu_mes") },
    { rotulo: "Pediu ajuda do banco", pessoas: n("comeco_banco") },
  ];
}

/**
 * A linha de cima enquanto o arquivo é lido e depois (14/10/2026): dizia "Extrato lido" também
 * para a fatura e para os prints. Antes de ler, o app ainda não sabe o tipo: "Lendo o seu arquivo".
 */
export function rotuloDaLeitura(lido: boolean, tipo: "extrato" | "fatura" | null | undefined): string {
  if (!lido) return "Lendo o seu arquivo";
  return tipo === "fatura" ? "Fatura lida" : "Extrato lido";
}
