import { chaveDoComercianteDe, nomeBase } from "@/lib/contas/assinaturas";
import { chaveRaioX } from "@/lib/decisoes/raio-x";

/**
 * A regra única das assinaturas (15/10/2026, decisão da Dani: "a última resposta vale em todo
 * lugar").
 *
 * A mesma assinatura aparece em três telas que não se falavam: o Raio-X do Decidir ("Cancelar",
 * "Manter"), as Assinaturas de Recorrentes ("+ Adicionar", "Não é assinatura", "Remover") e o
 * Dinheiro perdido ("Uso", "Não uso"). Marcar a Netflix como "Não uso" no Dinheiro perdido não a
 * tirava das Assinaturas.
 *
 * Aqui mora a regra, e só aqui (o irmão de lib/avisos). Toda resposta, em qualquer das três telas,
 * vira um `Evento` sobre a assinatura, identificada pelas mesmas MARCAS nos três lugares. O estado
 * é o da resposta mais recente entre todas; cada tela pergunta `estadoDaAssinatura` e mostra o que
 * a tabela de equivalência manda. Desfazer é um evento que anula a última resposta: o estado volta
 * ao de antes, em todo lugar.
 *
 * Puro, sem banco e sem React (o cliente pode importar). Quem lê e grava no banco é `respostas.ts`.
 */

/* ---------------------------------------------------------------- o estado */

/** O estado único de uma assinatura. */
export type EstadoDaAssinatura =
  /** Ninguém respondeu nada ainda. */
  | "aberta"
  /** "Manter" (Raio-X), "Uso" (Dinheiro perdido), "+ Adicionar" (Recorrentes). */
  | "mantida"
  /** "Cancelar" no Raio-X (o selo "Vou cancelar"), "Não uso" no Dinheiro perdido. */
  | "para_cancelar"
  /** "Cancelei mesmo" (a confirmação do Raio-X, um mês depois do "Vou cancelar"). */
  | "cancelada"
  /** "Não é assinatura" e "Remover assinatura" (Recorrentes): fora da lista de assinaturas. */
  | "fora";

/** Cada resposta possível, em cada tela. */
export type RespostaDeAssinatura =
  | "raiox_manter"
  | "raiox_cancelar"
  | "raiox_cancelei"
  | "perdido_uso"
  | "perdido_nao_uso"
  | "lista_adicionar"
  | "lista_nao_e"
  | "lista_remover";

export const RESPOSTAS_DE_ASSINATURA: readonly RespostaDeAssinatura[] = ["raiox_manter", "raiox_cancelar", "raiox_cancelei", "perdido_uso", "perdido_nao_uso", "lista_adicionar", "lista_nao_e", "lista_remover"];

/**
 * A tabela de equivalência, declarada: a tela, o botão, onde a tela gravava antes (e continua
 * gravando, como espelho, para quem ainda lê de lá) e o estado único que a resposta dá.
 */
export const EQUIVALENCIA: Record<RespostaDeAssinatura, { tela: string; botao: string; gravavaEm: string; estado: Exclude<EstadoDaAssinatura, "aberta"> }> = {
  raiox_manter: { tela: "Raio-X (Decidir)", botao: "Manter", gravavaEm: "Decisao tipo raiox_manter, chave = chave do Raio-X", estado: "mantida" },
  raiox_cancelar: { tela: "Raio-X (Decidir)", botao: "Cancelar (selo Vou cancelar)", gravavaEm: "Decisao tipo raiox_cancelar, chave = chave do Raio-X", estado: "para_cancelar" },
  raiox_cancelei: { tela: "Resumo (Você cancelou mesmo?)", botao: "Sim, cancelei", gravavaEm: "Decisao tipo raiox_confirmacao, chave = <chave>|sim", estado: "cancelada" },
  perdido_uso: { tela: "Dinheiro perdido", botao: "Uso", gravavaEm: "AchadoDinheiroPerdido.estado = uso", estado: "mantida" },
  perdido_nao_uso: { tela: "Dinheiro perdido", botao: "Não uso", gravavaEm: "AchadoDinheiroPerdido.estado = nao_uso", estado: "para_cancelar" },
  lista_adicionar: { tela: "Recorrentes (Assinaturas)", botao: "+ Adicionar (escolher ou escrever)", gravavaEm: "ContaAPagar tipo assinatura", estado: "mantida" },
  lista_nao_e: { tela: "Recorrentes (Assinaturas)", botao: "Não é assinatura", gravavaEm: "ContaRecusada chave nao-assinatura:<nome>", estado: "fora" },
  lista_remover: { tela: "Recorrentes (Assinaturas)", botao: "Remover assinatura", gravavaEm: "apaga a ContaAPagar e grava ContaRecusada nao-assinatura:<nome>", estado: "fora" },
};

/* ---------------------------------------------------------------- a identidade */

/**
 * Quem é a assinatura. As três telas acham a mesma Netflix por caminhos diferentes: o Raio-X pela
 * chave dele ("netflix"), o Dinheiro perdido e Recorrentes pelo comerciante do motor ("m:netflix",
 * de `comercianteDe`/`chaveDoComercianteDe`), e todas têm o nome legível ("Netflix", de
 * `nomeLegivel`/`nomeDaDescricao`). A identidade junta os três.
 */
export type Identidade = {
  nome?: string | null;
  /** O comerciante do motor ("m:netflix", "manychat"). O "#5590" do Dinheiro perdido sai. */
  comerciante?: string | null;
  /** A chave do Raio-X (chaveRaioX). */
  raiox?: string | null;
};

/**
 * As marcas da assinatura: "c:" o comerciante, "n:" o nome sem acento nem espaço, "r:" a chave do
 * Raio-X. Duas telas falam da mesma assinatura quando têm uma marca em comum.
 */
export function marcasDa(i: Identidade): string[] {
  const out: string[] = [];
  const c = (i.comerciante ?? "").split("#")[0].trim();
  if (c) out.push(`c:${c}`.slice(0, 120));
  const n = nomeBase(i.nome ?? "");
  if (n.length >= 3) out.push(`n:${n}`.slice(0, 120));
  const r = (i.raiox ?? "").trim();
  if (r.length >= 3) out.push(`r:${r}`.slice(0, 120));
  return out;
}

/** A chave principal (a que vai na coluna `chave` do registro): a primeira marca. */
export function chaveDaIdentidade(marcas: readonly string[]): string {
  return (marcas[0] ?? "n:sem-nome").slice(0, 190);
}

export function mesmaAssinatura(a: readonly string[], b: readonly string[]): boolean {
  return a.some((m) => b.includes(m));
}

const ORDEM_DAS_MARCAS = ["c:", "n:", "r:"];
const ordemDa = (m: string) => {
  const i = ORDEM_DAS_MARCAS.indexOf(m.slice(0, 2));
  return i < 0 ? ORDEM_DAS_MARCAS.length : i;
};

/**
 * Junta marcas sem repetir, sempre na mesma ordem (comerciante, nome, Raio-X): a chave principal
 * da assinatura é a mesma, venha a resposta de que tela vier.
 */
export function juntarMarcas(...listas: (readonly string[])[]): string[] {
  const todas = [...new Set(listas.flat())];
  return todas.map((m, i) => ({ m, i })).sort((a, b) => ordemDa(a.m) - ordemDa(b.m) || a.i - b.i).map((x) => x.m);
}

/* ---------------------------------------------------------------- os eventos */

export type Evento = {
  id: string;
  marcas: string[];
  /** A resposta, ou "desfazer" (que anula o evento `desfaz`). */
  resposta: RespostaDeAssinatura | "desfazer";
  desfaz?: string | null;
  em: Date;
  /** Da pessoa que olha (false: do outro da casa). */
  minha: boolean;
  /** A cobrança dessa assinatura é da casa para quem respondeu (Casal simples). */
  daCasa: boolean;
  /**
   * true: do registro único (Decisao "assinatura_resposta"). false: lido do lugar antigo de uma
   * tela (respostas de antes desta regra). Quando a assinatura já tem registro, o antigo é só
   * espelho e não conta.
   */
  registro: boolean;
};

const antesDe = (a: Evento, b: Evento) => a.em.getTime() - b.em.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Os eventos que valem para a assinatura, do mais antigo ao mais novo, sem os desfeitos.
 * Casal simples (o mesmo do módulo de avisos para categoria): a resposta do outro da casa só vale
 * quando a assinatura é da casa para os dois. Nunca acrescenta assinatura: só muda o estado de uma
 * que quem olha já tem.
 */
export function eventosQueValem(marcas: readonly string[], eventos: readonly Evento[], daCasaParaMim = false): Evento[] {
  const daqui = eventos.filter((e) => mesmaAssinatura(e.marcas, marcas) && (e.minha || (e.daCasa && daCasaParaMim)));
  // O lugar antigo de cada tela vira espelho do registro dela: com registro dela, só o registro conta.
  const valem = daqui.some((e) => e.registro && e.minha) ? daqui.filter((e) => e.registro) : daqui;
  const desfeitos = new Set(valem.filter((e) => e.resposta === "desfazer" && e.desfaz).map((e) => e.desfaz as string));
  return valem.filter((e) => e.resposta !== "desfazer" && !desfeitos.has(e.id)).sort(antesDe);
}

/** O estado da assinatura: o da resposta mais recente, em qualquer tela. */
export function estadoDaAssinatura(marcas: readonly string[], eventos: readonly Evento[], daCasaParaMim = false): { estado: EstadoDaAssinatura; ultima: Evento | null } {
  const valem = eventosQueValem(marcas, eventos, daCasaParaMim);
  const ultima = valem[valem.length - 1] ?? null;
  if (!ultima || ultima.resposta === "desfazer") return { estado: "aberta", ultima: null };
  return { estado: EQUIVALENCIA[ultima.resposta].estado, ultima };
}

/* ---------------------------------------------------------------- o que cada tela mostra */

/** Raio-X: a escolha mostrada no item (null = aberto). "Fora" não aparece no Raio-X. */
export function noRaioX(estado: EstadoDaAssinatura): { aparece: boolean; escolha: "raiox_manter" | "raiox_cancelar" | null; cancelada: boolean } {
  if (estado === "fora") return { aparece: false, escolha: null, cancelada: false };
  if (estado === "mantida") return { aparece: true, escolha: "raiox_manter", cancelada: false };
  if (estado === "para_cancelar" || estado === "cancelada") return { aparece: true, escolha: "raiox_cancelar", cancelada: estado === "cancelada" };
  return { aparece: true, escolha: null, cancelada: false };
}

/** Dinheiro perdido: o estado da carta de assinatura. "Fora" não é carta de assinatura. */
export function noDinheiroPerdido(estado: EstadoDaAssinatura): { aparece: boolean; estado: "aberto" | "uso" | "nao_uso" } {
  if (estado === "fora") return { aparece: false, estado: "aberto" };
  if (estado === "mantida") return { aparece: true, estado: "uso" };
  if (estado === "para_cancelar" || estado === "cancelada") return { aparece: true, estado: "nao_uso" };
  return { aparece: true, estado: "aberto" };
}

/**
 * Recorrentes (Assinaturas): aparece enquanto ainda cobra. A cancelada sai (não tem mais dono na
 * renda), a que não é assinatura sai, a que ela vai cancelar fica com o selo "Para cancelar".
 */
export function naListaDeAssinaturas(estado: EstadoDaAssinatura): { aparece: boolean; paraCancelar: boolean } {
  if (estado === "fora" || estado === "cancelada") return { aparece: false, paraCancelar: false };
  return { aparece: true, paraCancelar: estado === "para_cancelar" };
}

/** O estado da carta do Dinheiro perdido de volta para a resposta da tela. */
export function respostaDoDinheiroPerdido(estado: string): RespostaDeAssinatura | "desfazer" | null {
  if (estado === "uso") return "perdido_uso";
  if (estado === "nao_uso") return "perdido_nao_uso";
  if (estado === "aberto") return "desfazer";
  return null;
}

/* ---------------------------------------------------------------- as respostas de antes */

/** O que as telas gravavam antes desta regra, como o banco devolve. */
export type Legado = {
  raiox: { id: string; tipo: string; chave: string | null; descricao: string | null; createdAt: Date }[];
  confirmacoes: { id: string; chave: string | null; createdAt: Date }[];
  achados: { id: string; chave: string; tipo: string; nome: string; estado: string; decididoEm: Date | null; createdAt: Date; comerciante: string | null; raiox: string | null }[];
  recusas: { id: string; chave: string; createdAt: Date }[];
  dela: { id: string; nome: string; chaveDoHistorico: string | null; createdAt: Date }[];
};

const PREFIXO_DA_RECUSA = "nao-assinatura:";

/** As respostas de antes viram eventos (registro = false), com a hora em que foram dadas. */
export function eventosDoLegado(l: Legado): Evento[] {
  const out: Evento[] = [];
  const base = { minha: true, daCasa: false, registro: false } as const;
  for (const d of l.raiox) {
    if (!d.chave || (d.tipo !== "raiox_manter" && d.tipo !== "raiox_cancelar")) continue;
    out.push({ ...base, id: `legado:raiox:${d.id}`, marcas: marcasDa({ raiox: d.chave, nome: d.descricao }), resposta: d.tipo, em: d.createdAt });
  }
  for (const d of l.confirmacoes) {
    const m = /^(.+)\|sim$/.exec(d.chave ?? "");
    if (m) out.push({ ...base, id: `legado:conf:${d.id}`, marcas: marcasDa({ raiox: m[1] }), resposta: "raiox_cancelei", em: d.createdAt });
  }
  for (const a of l.achados) {
    if (a.tipo !== "assinatura") continue;
    const r = respostaDoDinheiroPerdido(a.estado);
    if (r !== "perdido_uso" && r !== "perdido_nao_uso") continue;
    out.push({ ...base, id: `legado:achado:${a.id}`, marcas: marcasDa({ comerciante: a.comerciante, nome: a.nome, raiox: a.raiox }), resposta: r, em: a.decididoEm ?? a.createdAt });
  }
  for (const r of l.recusas) {
    if (!r.chave.startsWith(PREFIXO_DA_RECUSA)) continue;
    const n = r.chave.slice(PREFIXO_DA_RECUSA.length);
    if (n.length >= 3) out.push({ ...base, id: `legado:recusa:${r.id}`, marcas: [`n:${n}`], resposta: "lista_nao_e", em: r.createdAt });
  }
  for (const d of l.dela) {
    out.push({ ...base, id: `legado:dela:${d.id}`, marcas: marcasDa({ comerciante: d.chaveDoHistorico, nome: d.nome }), resposta: "lista_adicionar", em: d.createdAt });
  }
  return out;
}

/* ---------------------------------------------------------------- o registro */

/** O tipo da linha na tabela Decisao. */
export const TIPO_DO_REGISTRO = "assinatura_resposta";

/** O que fica na coluna `dados` de uma linha do registro. */
export type DadosDoRegistro = { marcas: string[]; em: string; daCasa?: boolean; desfaz?: string | null; nome?: string | null; deLegado?: string | null };

/** Uma linha do registro (Decisao "assinatura_resposta") vira evento. */
export function eventoDoRegistro(l: { id: string; descricao: string | null; dados: unknown; createdAt: Date }, minha: boolean): Evento | null {
  const d = (l.dados && typeof l.dados === "object" ? l.dados : {}) as Partial<DadosDoRegistro>;
  const resposta = l.descricao === "desfazer" ? "desfazer" : (RESPOSTAS_DE_ASSINATURA as readonly string[]).includes(l.descricao ?? "") ? (l.descricao as RespostaDeAssinatura) : null;
  if (!resposta || !Array.isArray(d.marcas)) return null;
  const em = typeof d.em === "string" && !Number.isNaN(Date.parse(d.em)) ? new Date(d.em) : l.createdAt;
  return { id: l.id, marcas: d.marcas.filter((m): m is string => typeof m === "string"), resposta, desfaz: typeof d.desfaz === "string" ? d.desfaz : null, em, minha, daCasa: d.daCasa === true, registro: true };
}

/* ---------------------------------------------------------------- as marcas de cada tela */

/** O item do Raio-X: o comerciante da cobrança mais recente, o nome e a chave do Raio-X. */
export function marcasDoRaioX(i: { chave: string; nome: string; descricao?: string }): string[] {
  return marcasDa({ comerciante: chaveDoComercianteDe(i.descricao ?? i.nome), nome: i.nome, raiox: i.chave });
}

/** A carta do Dinheiro perdido: o comerciante dela (sem o "#valor"), o nome e a chave que o Raio-X daria. */
export function marcasDoAchado(a: { comerciante?: string | null; nome: string; descricaoDoLogo?: string | null }): string[] {
  return marcasDa({ comerciante: a.comerciante, nome: a.nome, raiox: chaveRaioX(a.descricaoDoLogo ?? a.nome) });
}

/** A assinatura que ela pôs em Recorrentes: o comerciante aprendido e o nome. */
export function marcasDaDela(d: { nome: string; chaveDoHistorico?: string | null }): string[] {
  return marcasDa({ comerciante: d.chaveDoHistorico, nome: d.nome });
}

/**
 * Recorrentes: as linhas de Assinaturas (juntarAssinaturas) com as marcas de cada uma e o estado
 * único aplicado. Sai a cancelada e a que não é assinatura; a que ela vai cancelar fica com o selo.
 */
export function assinaturasComARegraUnica<T extends { chave: string; id: string | null }>(
  linhas: T[],
  fontes: {
    dela: { id: string; nome: string; chaveDoHistorico: string | null }[];
    raiox: { chave: string; nome: string; descricao?: string }[];
    achados: { chave: string; comerciante: string; nome: string; descricaoDoLogo: string }[];
  },
  estadoDe: (marcas: string[]) => EstadoDaAssinatura,
): (T & { marcas: string[]; paraCancelar: boolean })[] {
  const out: (T & { marcas: string[]; paraCancelar: boolean })[] = [];
  for (const l of linhas) {
    const dela = l.id ? fontes.dela.find((d) => d.id === l.id) : undefined;
    const rx = l.chave.startsWith("rx:") ? fontes.raiox.find((i) => i.chave === l.chave.slice(3)) : undefined;
    const dp = l.chave.startsWith("dp:") ? fontes.achados.find((a) => a.chave === l.chave.slice(3)) : undefined;
    const marcas = dela ? marcasDaDela(dela) : rx ? marcasDoRaioX(rx) : dp ? marcasDoAchado(dp) : [];
    const no = naListaDeAssinaturas(marcas.length > 0 ? estadoDe(marcas) : "aberta");
    if (no.aparece) out.push({ ...l, marcas, paraCancelar: no.paraCancelar });
  }
  return out;
}

/**
 * Raio-X: os itens com o estado único aplicado. Sai o que não é assinatura; a escolha de cada um
 * ("Manter", "Vou cancelar") e o "Cancelada" vêm da última resposta, de qualquer tela.
 */
export function raioXComARegraUnica<T extends { chave: string; nome: string; descricao?: string; anual: number }>(itens: T[], estadoDe: (marcas: string[]) => EstadoDaAssinatura) {
  const visiveis: T[] = [];
  const decididos = new Map<string, { tipo: "raiox_manter" | "raiox_cancelar"; valor: number }>();
  const canceladas = new Set<string>();
  for (const i of itens) {
    const no = noRaioX(estadoDe(marcasDoRaioX(i)));
    if (!no.aparece) continue;
    visiveis.push(i);
    if (no.escolha) decididos.set(i.chave, { tipo: no.escolha, valor: no.escolha === "raiox_cancelar" ? i.anual : 0 });
    if (no.cancelada) canceladas.add(i.chave);
  }
  return { itens: visiveis, decididos, canceladas };
}

/** Dinheiro perdido: a carta de assinatura com o estado único (null = não é carta, ela disse que não é assinatura). */
export function cartaComARegraUnica<T extends { tipo: string; comerciante?: string | null; nome: string; descricaoDoLogo?: string | null; estado: string }>(c: T, estadoDe: (marcas: string[]) => EstadoDaAssinatura): T | null {
  if (c.tipo !== "assinatura") return c;
  const no = noDinheiroPerdido(estadoDe(marcasDoAchado(c)));
  return no.aparece ? { ...c, estado: no.estado } : null;
}
