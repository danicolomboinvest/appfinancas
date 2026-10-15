import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { casaAtiva, donosDasRespostasDoOrcamento, ehDaCasa, type QuemLe } from "@/lib/casa/regras";
import { acharRecorrentes, chaveRaioX, type RaioXItem } from "@/lib/decisoes/raio-x";
import { chaveDaRecusa, chaveDoComercianteDe, chavesDaRecusa, type AssinaturaDela } from "@/lib/contas/assinaturas";
import { cacarDinheiroPerdido, type Achado } from "@/lib/dinheiro-perdido/detectar";
import { listEntriesForMonths } from "@/lib/repositories/monthly-entry.repo";
import { chavesDasAssinaturasDela, decidirAchado, lancamentosParaCacar, listarAchadosGuardados, type AchadoGuardado } from "@/lib/repositories/dinheiro-perdido.repo";
import { listarAssinaturasDela } from "@/lib/repositories/assinaturas.repo";
import { registrarDecisaoUnica } from "@/lib/repositories/decisao.repo";
import { nowInBrazil } from "@/lib/date/brazil-now";
import {
  TIPO_DO_REGISTRO,
  chaveDaIdentidade,
  eventoDoRegistro,
  eventosDoLegado,
  eventosQueValem,
  estadoDaAssinatura,
  juntarMarcas,
  marcasDa,
  marcasDaDela,
  marcasDoAchado,
  marcasDoRaioX,
  mesmaAssinatura,
  noDinheiroPerdido,
  type DadosDoRegistro,
  type EstadoDaAssinatura,
  type Evento,
  type Identidade,
  type RespostaDeAssinatura,
} from "./regra";

/**
 * O banco da regra única das assinaturas (regra.ts): lê TODAS as respostas sobre assinaturas, de
 * todas as telas, e grava a resposta nova no registro único (Decisao "assinatura_resposta"), com o
 * espelho nos lugares antigos de cada tela (o Money Reset, o "Até agora" do cancelar e o "Você
 * cancelou mesmo?" ainda leem de lá).
 *
 * Casal simples: as respostas do outro da casa vêm junto (donosDasRespostasDoOrcamento, como no
 * módulo de avisos), e a regra só deixa valer a que é sobre assinatura da casa para os dois. Nada
 * do outro é listado: só muda o estado de uma assinatura que quem olha já tem.
 */

type Dono = { userId: string; profileId: string };
const donoDe = (ctx: { userId: string; profileId: string }): Dono => ({ userId: ctx.userId, profileId: ctx.profileId });

export type RespostasDeAssinatura = {
  eventos: Evento[];
  /** As marcas das cobranças de quem olha que são da casa (só com Casal simples ligado). */
  daCasa: Set<string>;
};

/** O estado de uma assinatura, pelas marcas dela, com as respostas já carregadas. */
export function estadoPara(r: RespostasDeAssinatura, marcas: readonly string[]): EstadoDaAssinatura {
  return estadoDaAssinatura(marcas, r.eventos, marcas.some((m) => r.daCasa.has(m))).estado;
}

/** Meses que o "da casa" olha (os mesmos do Dinheiro perdido). */
const MESES_DA_CASA = 6;

/**
 * As marcas das cobranças da pessoa que são da casa (Casal simples): o "Só meu" nunca, a escolha
 * do lançamento, a regra aprendida, o automático. Só os lançamentos de quem olha.
 */
async function marcasDaCasa(ctx: QuemLe): Promise<Set<string>> {
  if (!casaAtiva(ctx)) return new Set();
  const agora = nowInBrazil();
  const fim = agora.getFullYear() * 12 + agora.getMonth();
  const meses = Array.from({ length: MESES_DA_CASA }, (_, i) => fim - i).map((m) => ({ year: Math.floor(m / 12), month: (m % 12) + 1 }));
  const [linhas, regras] = await Promise.all([
    prisma.monthlyEntry.findMany({
      where: { userId: ctx.userId, profileId: ctx.profileId, category: "EXPENSE", OR: meses },
      select: { category: true, parentCategory: true, subcategory: true, description: true, doCasal: true, soMeu: true },
      take: 5000,
    }),
    prisma.regraDaCasa.findMany({ where: { userId: ctx.userId, profileId: ctx.profileId }, select: { pattern: true, daCasa: true } }),
  ]);
  const aprendidas = new Map(regras.map((r) => [r.pattern, r.daCasa]));
  const out = new Set<string>();
  for (const l of linhas) {
    if (!l.description || !ehDaCasa(l, aprendidas)) continue;
    for (const m of marcasDa({ comerciante: chaveDoComercianteDe(l.description), raiox: chaveRaioX(l.description) })) out.add(m);
  }
  return out;
}

/** Todas as respostas sobre assinaturas: o registro (dos dois da casa) e os lugares antigos (só dela). */
export async function carregarRespostasDeAssinatura(ctx: QuemLe): Promise<RespostasDeAssinatura> {
  const eu = donoDe(ctx);
  const donos = donosDasRespostasDoOrcamento(ctx);
  const [registro, raiox, confirmacoes, achados, recusas, dela, daCasa] = await Promise.all([
    prisma.decisao.findMany({ where: { OR: donos, tipo: TIPO_DO_REGISTRO }, select: { id: true, userId: true, profileId: true, descricao: true, dados: true, createdAt: true }, orderBy: { createdAt: "asc" }, take: 5000 }),
    prisma.decisao.findMany({ where: { ...eu, tipo: { in: ["raiox_manter", "raiox_cancelar"] } }, select: { id: true, tipo: true, chave: true, descricao: true, createdAt: true } }),
    prisma.decisao.findMany({ where: { ...eu, tipo: "raiox_confirmacao", chave: { endsWith: "|sim" } }, select: { id: true, chave: true, createdAt: true } }),
    prisma.achadoDinheiroPerdido.findMany({ where: { ...eu, tipo: "assinatura", estado: { in: ["uso", "nao_uso"] } }, select: { id: true, chave: true, tipo: true, nome: true, estado: true, decididoEm: true, createdAt: true, dados: true } }),
    prisma.contaRecusada.findMany({ where: { ...eu, chave: { startsWith: "nao-assinatura:" } }, select: { id: true, chave: true, createdAt: true } }),
    prisma.contaAPagar.findMany({ where: { ...eu, tipo: "assinatura", quitada: false }, select: { id: true, nome: true, chaveDoHistorico: true, createdAt: true } }),
    marcasDaCasa(ctx),
  ]);
  const eventos: Evento[] = [];
  for (const l of registro) {
    const e = eventoDoRegistro(l, l.userId === eu.userId && l.profileId === eu.profileId);
    if (e) eventos.push(e);
  }
  eventos.push(
    ...eventosDoLegado({
      raiox,
      confirmacoes,
      achados: achados.map((a) => {
        const d = (a.dados && typeof a.dados === "object" ? a.dados : {}) as { comerciante?: unknown; descricaoDoLogo?: unknown };
        const logo = typeof d.descricaoDoLogo === "string" ? d.descricaoDoLogo : a.nome;
        return { ...a, comerciante: typeof d.comerciante === "string" ? d.comerciante : null, raiox: chaveRaioX(logo) };
      }),
      recusas,
      dela,
    }),
  );
  return { eventos, daCasa };
}

/* ---------------------------------------------------------------- o catálogo das três telas */

/** Meses que o Raio-X olha: os 5 fechados antes do atual. */
function mesesDoRaioX(ano: number, mes: number) {
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(ano, mes - 2 - i, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });
}

/**
 * As assinaturas do Raio-X (sem o estado): o que se repete todo mês nos meses fechados. Só as
 * assinaturas (protótipo, "Que pequenos gastos posso cortar?"): Uber e iFood são hábitos.
 */
export async function itensDoRaioX(ctx: AuthContext, ano: number, mes: number): Promise<RaioXItem[]> {
  const entradas = await listEntriesForMonths(ctx, mesesDoRaioX(ano, mes));
  return acharRecorrentes(
    entradas
      .filter((e) => e.category === "EXPENSE")
      .map((e) => ({ description: e.description, amount: Number(e.amount), year: e.year, month: e.month, parentCategory: e.parentCategory, subcategory: e.subcategory })),
  ).filter((i) => i.tipo === "assinatura");
}

type Catalogo = { raiox: RaioXItem[]; vivos: Achado[]; guardados: AchadoGuardado[]; dela: AssinaturaDela[] };

/** A mesma assinatura nas três telas, para o espelho. */
async function catalogo(ctx: AuthContext): Promise<Catalogo> {
  const agora = nowInBrazil();
  const [raiox, lancamentos, assinaturasDela, guardados, dela] = await Promise.all([
    itensDoRaioX(ctx, agora.getFullYear(), agora.getMonth() + 1),
    lancamentosParaCacar(ctx),
    chavesDasAssinaturasDela(ctx),
    listarAchadosGuardados(ctx),
    listarAssinaturasDela(ctx),
  ]);
  const vivos = cacarDinheiroPerdido(lancamentos, { assinaturasDela }).achados.filter((a) => a.tipo === "assinatura");
  return { raiox, vivos, guardados: guardados.filter((g) => g.tipo === "assinatura"), dela };
}

const marcasDoGuardado = (g: AchadoGuardado) => marcasDoAchado({ comerciante: g.dados?.comerciante ?? null, nome: g.nome, descricaoDoLogo: g.dados?.descricaoDoLogo ?? g.nome });

/** As marcas da assinatura, com as que as outras telas usam para ela (uma passada só). */
function expandir(marcas: string[], c: Catalogo): string[] {
  const outras = [...c.raiox.map(marcasDoRaioX), ...c.vivos.map(marcasDoAchado), ...c.guardados.map(marcasDoGuardado), ...c.dela.map(marcasDaDela)];
  return juntarMarcas(marcas, ...outras.filter((m) => mesmaAssinatura(m, marcas)));
}

/* ---------------------------------------------------------------- o espelho */

const TIPOS_DO_RAIOX = ["raiox_cancelar", "raiox_metade", "raiox_manter"] as const;

/**
 * Deixa o lugar antigo de cada tela igual ao estado único: a decisão do Raio-X, a carta do
 * Dinheiro perdido e a recusa de Recorrentes. Só mexe no que mudou (a data do "Vou cancelar" é o
 * que o "Você cancelou mesmo?" usa).
 */
async function espelhar(ctx: AuthContext, marcas: string[], estado: EstadoDaAssinatura, c: Catalogo, alvo: { nome?: string | null; raiox?: string | null; valorRaioX?: number }): Promise<void> {
  const eu = donoDe(ctx);
  const nome = alvo.nome ?? c.raiox.find((i) => mesmaAssinatura(marcasDoRaioX(i), marcas))?.nome ?? null;

  // Raio-X: a chave da tela que respondeu, as do catálogo e as que já tinham decisão.
  const chavesDoRaioX = marcas.filter((m) => m.startsWith("r:")).map((m) => m.slice(2));
  const existentes = await prisma.decisao.findMany({ where: { ...eu, chave: { in: chavesDoRaioX }, tipo: { in: [...TIPOS_DO_RAIOX] } }, select: { chave: true, tipo: true } });
  const alvoDoRaioX = estado === "mantida" ? "raiox_manter" : estado === "para_cancelar" || estado === "cancelada" ? "raiox_cancelar" : null;
  for (const chave of chavesDoRaioX) {
    const item = c.raiox.find((i) => i.chave === chave);
    const atual = existentes.find((e) => e.chave === chave)?.tipo ?? null;
    if (!item && atual === null && chave !== alvo.raiox) continue;
    if (atual === "raiox_metade") continue; // hábito, outra pergunta
    if (alvoDoRaioX === null) {
      if (atual) await prisma.decisao.deleteMany({ where: { ...eu, chave, tipo: { in: ["raiox_cancelar", "raiox_manter"] } } });
      continue;
    }
    if (atual === alvoDoRaioX) continue;
    const anual = item?.anual ?? alvo.valorRaioX ?? 0;
    await registrarDecisaoUnica(ctx, { tipo: alvoDoRaioX, chave, valor: alvoDoRaioX === "raiox_cancelar" ? anual : 0, descricao: (item?.nome ?? nome ?? chave).slice(0, 80) }, [...TIPOS_DO_RAIOX]);
  }

  // Dinheiro perdido: a carta de assinatura.
  const naCarta = noDinheiroPerdido(estado).estado;
  const guardadoDe = new Map(c.guardados.map((g) => [g.chave, g]));
  const vistos = new Set<string>();
  for (const a of c.vivos.filter((x) => mesmaAssinatura(marcasDoAchado(x), marcas))) {
    vistos.add(a.chave);
    const atual = guardadoDe.get(a.chave)?.estado ?? "aberto";
    if (atual !== naCarta) await decidirAchado(ctx, a.chave, naCarta, a);
  }
  for (const g of c.guardados.filter((x) => !vistos.has(x.chave) && mesmaAssinatura(marcasDoGuardado(x), marcas))) {
    if (g.estado !== naCarta) await decidirAchado(ctx, g.chave, naCarta, null);
  }

  // Recorrentes: a recusa pelo nome ("Não é assinatura").
  const nomes = [...new Set([nome, ...c.raiox.filter((i) => mesmaAssinatura(marcasDoRaioX(i), marcas)).map((i) => i.nome), ...c.vivos.filter((x) => mesmaAssinatura(marcasDoAchado(x), marcas)).map((x) => x.nome)].filter((n): n is string => Boolean(n)))];
  if (estado === "fora") {
    if (nomes.length > 0) await prisma.contaRecusada.createMany({ data: nomes.map((n) => ({ ...eu, chave: chaveDaRecusa(n) })), skipDuplicates: true });
  } else if (nomes.length > 0) {
    await prisma.contaRecusada.deleteMany({ where: { ...eu, chave: { in: [...new Set(nomes.flatMap(chavesDaRecusa))] } } });
  }
}

/* ---------------------------------------------------------------- gravar e desfazer */

export type Alvo = Identidade & { marcas?: string[]; valorRaioX?: number };

/**
 * As respostas de antes desta regra, sobre esta assinatura, entram no registro (com a hora de
 * cada uma) na primeira vez que ela responde depois da regra: o Desfazer sabe para onde voltar.
 */
async function trazerOLegado(ctx: AuthContext, marcas: string[], r: RespostasDeAssinatura): Promise<boolean> {
  const daqui = r.eventos.filter((e) => e.minha && mesmaAssinatura(e.marcas, marcas));
  if (daqui.some((e) => e.registro)) return false;
  const legado = daqui.filter((e) => !e.registro && e.resposta !== "desfazer");
  if (legado.length === 0) return false;
  await prisma.decisao.createMany({
    data: legado.map((e) => ({
      ...donoDe(ctx),
      tipo: TIPO_DO_REGISTRO,
      chave: chaveDaIdentidade(marcas),
      descricao: e.resposta,
      dados: { marcas: juntarMarcas(marcas, e.marcas), em: e.em.toISOString(), deLegado: e.id } satisfies DadosDoRegistro,
    })),
  });
  return true;
}

async function gravarNoRegistro(ctx: AuthContext, marcas: string[], resposta: RespostaDeAssinatura | "desfazer", dados: Partial<DadosDoRegistro>, agora: Date) {
  return prisma.decisao.create({
    data: { ...donoDe(ctx), tipo: TIPO_DO_REGISTRO, chave: chaveDaIdentidade(marcas), descricao: resposta, dados: { marcas, em: agora.toISOString(), ...dados } satisfies DadosDoRegistro },
    select: { id: true },
  });
}

/** Ela respondeu sobre uma assinatura, em qualquer tela: vale em todo lugar. Devolve o estado novo. */
export async function responderAssinatura(ctx: AuthContext, alvo: Alvo, resposta: RespostaDeAssinatura, agora: Date = new Date()): Promise<EstadoDaAssinatura> {
  const c = await catalogo(ctx);
  const marcas = expandir(juntarMarcas(alvo.marcas ?? [], marcasDa(alvo)), c);
  if (marcas.length === 0) return "aberta";
  let r = await carregarRespostasDeAssinatura(ctx);
  if (await trazerOLegado(ctx, marcas, r)) r = await carregarRespostasDeAssinatura(ctx);
  const daCasa = marcas.some((m) => r.daCasa.has(m));
  await gravarNoRegistro(ctx, marcas, resposta, { daCasa, nome: alvo.nome ?? null }, agora);
  r = await carregarRespostasDeAssinatura(ctx);
  const estado = estadoPara(r, marcas);
  await espelhar(ctx, marcas, estado, c, alvo);
  return estado;
}

/**
 * Desfazer: anula a resposta mais recente sobre a assinatura (de qualquer tela) e o estado volta
 * ao de antes, em todo lugar. Devolve o estado de antes.
 */
export async function desfazerAssinatura(ctx: AuthContext, alvo: Alvo, agora: Date = new Date()): Promise<EstadoDaAssinatura> {
  const c = await catalogo(ctx);
  const marcas = expandir(juntarMarcas(alvo.marcas ?? [], marcasDa(alvo)), c);
  if (marcas.length === 0) return "aberta";
  let r = await carregarRespostasDeAssinatura(ctx);
  if (await trazerOLegado(ctx, marcas, r)) r = await carregarRespostasDeAssinatura(ctx);
  const valem = eventosQueValem(marcas, r.eventos, marcas.some((m) => r.daCasa.has(m)));
  const ultima = valem[valem.length - 1];
  if (ultima) {
    await gravarNoRegistro(ctx, marcas, "desfazer", { desfaz: ultima.id }, agora);
    r = await carregarRespostasDeAssinatura(ctx);
  }
  const estado = estadoPara(r, marcas);
  await espelhar(ctx, marcas, estado, c, alvo);
  return estado;
}

/** As telas que mostram assinatura: depois de uma resposta, todas mostram o estado novo. */
export function revalidarAssinaturas(): void {
  revalidatePath("/decidir", "layout");
  revalidatePath("/orcamento", "layout");
  revalidatePath("/mensal/foco");
  revalidatePath("/money-reset", "layout");
}
