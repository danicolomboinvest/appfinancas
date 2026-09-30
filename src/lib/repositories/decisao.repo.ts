import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";

export type TipoDecisao =
  | "compra_desisti"
  | "compra_amanha"
  | "compra_comprei"
  | "ritual"
  | "fechamento"
  | "teto"
  | "raiox_cancelar"
  | "raiox_metade"
  | "raiox_manter"
  | "resposta_errada"
  /** Casal: a renda do perfil é a do casal inteira ("casal") ou só o que vai pra conta conjunta ("conjunta"). */
  | "casal_renda"
  /** "Você cancelou mesmo?", um mês depois do "vou cancelar" do Raio-X: "sim" | "nao". */
  | "raiox_confirmacao"
  /** Virada do ano: como a pessoa quis começar o ano novo ("sugestao" | "zerado"). */
  | "virada_ano"
  /** Revisão de um lançamento antigo (chave = id do lançamento): o que ela escolheu fazer. */
  | "revisao_lancamento"
  /** Aviso do Foco dispensado ("foi pontual", "entendi"): chave "2026-09|estouro-LAZER" ou "2026-W40|aporte". */
  | "aviso_dispensado"
  /**
   * O nome que o banco deu a um lançamento importado que ela renomeou (chave = id do lançamento).
   * Não existe campo pra isso no lançamento: sem guardar, a regra aprendida saía com o nome novo
   * ("ALUGUEL" em vez de "PIX 1234 JOAO") e a fatura renomeada entrava em dobro se subida de novo.
   */
  | "descricao_original";

export type NovaDecisao = {
  tipo: TipoDecisao;
  chave?: string | null;
  valor?: number | null;
  descricao?: string | null;
  dados?: Prisma.InputJsonValue;
};

export async function registrarDecisao(ctx: AuthContext, d: NovaDecisao) {
  return prisma.decisao.create({
    data: {
      userId: ctx.userId, profileId: ctx.profileId,
      tipo: d.tipo,
      chave: d.chave ?? null,
      valor: d.valor ?? null,
      descricao: d.descricao?.slice(0, 200) ?? null,
      dados: d.dados,
    },
  });
}

/** Lock do Postgres que vale até o fim da transação (pg_advisory_xact_lock). */
export async function travarNaTransacao(tx: Prisma.TransactionClient, chave: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${chave}))`;
}

/**
 * Decisão com chave (ritual da semana, fechamento do mês, item do Raio-X, teto do mês) é única:
 * repetir substitui a anterior em vez de duplicar. Evita contar o mesmo ritual duas vezes se a
 * pessoa apertar o botão de novo.
 */
export async function registrarDecisaoUnica(ctx: AuthContext, d: NovaDecisao & { chave: string }, tiposDaMesmaChave: TipoDecisao[] = [d.tipo]) {
  return prisma.$transaction(async (tx) => {
    // Trava pela chave até o fim da transação: duas abas decidindo o mesmo item ao mesmo tempo
    // não viram duas linhas (apagar-e-criar sozinho não segura isso).
    await travarNaTransacao(tx, `${ctx.userId}|${ctx.profileId ?? ""}|${d.chave}`);
    await tx.decisao.deleteMany({ where: { userId: ctx.userId, profileId: ctx.profileId, chave: d.chave, tipo: { in: tiposDaMesmaChave } } });
    return tx.decisao.create({
      data: { userId: ctx.userId, profileId: ctx.profileId, tipo: d.tipo, chave: d.chave, valor: d.valor ?? null, descricao: d.descricao?.slice(0, 200) ?? null, dados: d.dados },
    });
  });
}

/** A resposta guardada (descrição) de uma decisão com chave, ou null se ainda não respondeu. */
export async function lerDecisao(ctx: AuthContext, tipo: TipoDecisao, chave: string): Promise<string | null> {
  const d = await prisma.decisao.findFirst({ where: { userId: ctx.userId, profileId: ctx.profileId, tipo, chave }, orderBy: { createdAt: "desc" }, select: { descricao: true } });
  return d ? (d.descricao ?? "") : null;
}

export async function existeDecisao(ctx: AuthContext, tipo: TipoDecisao, chave: string): Promise<boolean> {
  const n = await prisma.decisao.count({ where: { userId: ctx.userId, profileId: ctx.profileId, tipo, chave } });
  return n > 0;
}

/** "Decidir amanhã" ainda sem resposta, do perfil ativo. */
export async function listarCompraAmanhaPendentes(ctx: AuthContext) {
  return prisma.decisao.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, tipo: "compra_amanha", resolvidaEm: null },
    orderBy: { createdAt: "asc" },
  });
}

/** Responde um "decidir amanhã": marca como resolvido e registra o que a pessoa escolheu. */
export async function resolverCompraAmanha(ctx: AuthContext, id: string, desistiu: boolean) {
  return prisma.$transaction(async (tx) => {
    const pendente = await tx.decisao.findFirst({ where: { id, userId: ctx.userId, profileId: ctx.profileId, tipo: "compra_amanha", resolvidaEm: null } });
    if (!pendente) return null;
    // Marca só se ainda estiver pendente: dois toques seguidos não viram duas decisões.
    const marcada = await tx.decisao.updateMany({ where: { id: pendente.id, userId: ctx.userId, profileId: ctx.profileId, resolvidaEm: null }, data: { resolvidaEm: new Date() } });
    if (marcada.count !== 1) return null;
    return tx.decisao.create({
      data: {
        userId: ctx.userId, profileId: ctx.profileId,
        tipo: desistiu ? "compra_desisti" : "compra_comprei",
        valor: pendente.valor,
        descricao: pendente.descricao,
        dados: { ...(pendente.dados as object | null), depoisDe24h: true },
      },
    });
  });
}

/** "Vou comprar" registrados desde `desde` (direto ou depois do "decidir amanhã"), com o jeito de pagar. */
export async function listarComprasDecididasDesde(ctx: AuthContext, desde: Date) {
  const rows = await prisma.decisao.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, tipo: "compra_comprei", createdAt: { gte: desde } },
    select: { valor: true, dados: true, createdAt: true },
  });
  return rows.map((r) => {
    const dados = (r.dados ?? {}) as { modo?: unknown; parcelas?: unknown };
    const parcelas = Number(dados.parcelas);
    return {
      valor: Number(r.valor ?? 0),
      modo: dados.modo === "parcelado" ? ("parcelado" as const) : ("vista" as const),
      parcelas: Number.isFinite(parcelas) && parcelas >= 1 ? Math.round(parcelas) : 1,
      criadaEm: r.createdAt,
    };
  });
}

/**
 * Guarda o nome do banco antes do primeiro "Definir descrição" num lançamento importado. Só o
 * primeiro: renomear de novo não pode trocar o nome do banco pelo nome que ela deu antes.
 */
export async function guardarDescricaoOriginal(ctx: AuthContext, entryId: string, descricao: string) {
  if (await existeDecisao(ctx, "descricao_original", entryId)) return;
  await registrarDecisaoUnica(ctx, { tipo: "descricao_original", chave: entryId, descricao });
}

/** O nome do banco de cada lançamento renomeado (id do lançamento → descrição do extrato). */
export async function descricoesOriginais(ctx: AuthContext, perfis: (string | null)[]): Promise<Map<string, string>> {
  const ids = perfis.filter((p): p is string => p !== null);
  if (ids.length === 0) return new Map();
  const rows = await prisma.decisao.findMany({
    where: { userId: ctx.userId, profileId: { in: ids }, tipo: "descricao_original" },
    select: { chave: true, descricao: true },
  });
  return new Map(rows.flatMap((r) => (r.chave && r.descricao ? [[r.chave, r.descricao] as [string, string]] : [])));
}

/** Tetos que a pessoa pôs em categorias NESTE mês (chave "2026-09|ALIMENTACAO"). */
export async function listarTetosDoMes(ctx: AuthContext, anoMes: string) {
  const tetos = await prisma.decisao.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, tipo: "teto", chave: { startsWith: `${anoMes}|` } },
  });
  return tetos.map((t) => {
    const dados = (t.dados ?? {}) as { gastoNaHora?: unknown };
    return {
      categoria: (t.chave ?? "").split("|")[1] ?? "",
      valor: Number(t.valor ?? 0),
      // Quanto a categoria já tinha gasto quando ela combinou: é o que separa o gasto de antes
      // (já sabido) do gasto que veio depois e quebrou o combinado. Tetos antigos não têm.
      gastoNaHora: typeof dados.gastoNaHora === "number" ? dados.gastoNaHora : null,
      // A hora do combinado: o card conta só os gastos que aconteceram depois dela.
      combinadoEm: t.createdAt,
    };
  });
}

/** Desfaz o combinado ("teto") de uma categoria no mês. */
export async function apagarTetoDoMes(ctx: AuthContext, anoMes: string, categoria: string) {
  await prisma.decisao.deleteMany({ where: { userId: ctx.userId, profileId: ctx.profileId, tipo: "teto", chave: `${anoMes}|${categoria}` } });
}

/** O que a pessoa já decidiu no Raio-X, por gasto recorrente. */
export async function listarDecisoesRaioX(ctx: AuthContext) {
  const rows = await prisma.decisao.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, tipo: { in: ["raiox_cancelar", "raiox_metade", "raiox_manter"] } },
  });
  return new Map(rows.map((r) => [r.chave ?? "", { tipo: r.tipo as TipoDecisao, valor: Number(r.valor ?? 0) }]));
}

/** Tudo que a pessoa decidiu num período (pra "O que você conquistou" e "Seu ano"). */
export async function listarDecisoesDesde(ctx: AuthContext, desde: Date) {
  return prisma.decisao.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, createdAt: { gte: desde } },
    orderBy: { createdAt: "asc" },
  });
}

/** Fila do "Isso está errado?", de todo mundo — só o admin lê. */
export async function listarRespostasErradas(limite = 100) {
  return prisma.decisao.findMany({
    where: { tipo: "resposta_errada" },
    orderBy: { createdAt: "desc" },
    take: limite,
    include: { user: { select: { email: true, name: true } } },
  });
}

/**
 * "Vou cancelar" do Raio-X decidido ANTES deste mês e ainda sem resposta ao "cancelou mesmo?".
 * Quem disse "ainda não" neste mês só é perguntado de novo no mês que vem.
 */
export async function listarCancelamentosPraConfirmar(ctx: AuthContext, inicioDoMes: Date, anoMes: string) {
  const [cancelar, respostas] = await Promise.all([
    prisma.decisao.findMany({ where: { userId: ctx.userId, profileId: ctx.profileId, tipo: "raiox_cancelar", createdAt: { lt: inicioDoMes } }, select: { chave: true, descricao: true, valor: true } }),
    prisma.decisao.findMany({ where: { userId: ctx.userId, profileId: ctx.profileId, tipo: "raiox_confirmacao" }, select: { chave: true } }),
  ]);
  const respondidas = new Set(respostas.map((r) => r.chave ?? ""));
  return cancelar
    .filter((c) => c.chave && !respondidas.has(`${c.chave}|sim`) && !respondidas.has(`${c.chave}|nao|${anoMes}`))
    .map((c) => ({ chave: c.chave as string, nome: c.descricao ?? c.chave ?? "", anual: Number(c.valor ?? 0) }));
}

/** Ids dos avisos do Foco dispensados neste mês ("2026-09|…") ou nesta semana ("2026-W40|…"). */
export async function listarAvisosDispensados(ctx: AuthContext, anoMes: string, semana: string): Promise<string[]> {
  const rows = await prisma.decisao.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, tipo: "aviso_dispensado", OR: [{ chave: { startsWith: `${anoMes}|` } }, { chave: { startsWith: `${semana}|` } }] },
    select: { chave: true },
  });
  return rows.map((r) => (r.chave ?? "").split("|").slice(1).join("|"));
}
