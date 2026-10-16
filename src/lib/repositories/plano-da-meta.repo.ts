import { prisma } from "@/lib/db/prisma";
import { doDono, type AuthContext } from "@/lib/auth/session";
import { getTypicalMonthlyExpense } from "@/lib/planning/typical-expense";
import { getRendaMedia } from "./renda-media.repo";
import { listarAchadosGuardados } from "./dinheiro-perdido.repo";
import { listarAssinaturasDela } from "./assinaturas.repo";
import { carregarRespostasDeAssinatura, estadoPara, itensDoRaioX } from "@/lib/assinaturas/respostas";
import { juntarMarcas, marcasDa, marcasDaDela, marcasDoAchado, marcasDoRaioX, mesmaAssinatura } from "@/lib/assinaturas/regra";
import { chaveDoComercianteDe } from "@/lib/contas/assinaturas";
import { chaveRaioX } from "@/lib/decisoes/raio-x";
import { marcaDaDescricao } from "@/lib/marcas/marca";
import { casaAtiva, ehDaCasa } from "@/lib/casa/regras";
import { categoriasEssenciais } from "@/lib/categories";
import { TAXA_PADRAO_DAS_METAS } from "@/lib/metas/projecao";
import { cobrancasDeAssinatura, mesesFechados, type AssinaturaDoPlano, type EntradaDoPlano, type LancamentoDoPlano, type OutraMeta } from "@/lib/planning/plano-da-meta";
import { TIPO_DO_PLANO, antesDoPlanoNovo, dataDoPrazo, devolucoes, juntarTrazidos, oQueTirarFaz, planoDoRegistro, valoresDaMeta, type PlanoGravado, type Trazido } from "@/lib/planning/plano-gravado";
import { fotoDoTipo } from "@/lib/metas/tipos";

/**
 * O banco do plano da meta: junta o que o motor (lib/planning/plano-da-meta.ts) precisa e grava o
 * plano escolhido (Decisao "plano_da_meta", chave = id da meta).
 *
 * Tudo só de quem olha, no perfil ativo (doDono). No casal simples, o plano é de quem vê: a renda,
 * o gasto e as coisinhas são os lançamentos DELA (o que o par lançou nunca vira coisinha, nem o
 * "Só meu" dele aparece); o gasto da casa entra marcado "da casa" e vai para o fim da lista.
 */

export type MetaDoPlano = { id: string; nome: string; foto: string | null; alvo: number; guardado: number; prazo: Date | null; taxaAnual: number; porMes: number };

/** A meta, se for dela e estiver em andamento. */
export async function metaDoPlano(ctx: AuthContext, goalId: string): Promise<MetaDoPlano | null> {
  const g = await prisma.goal.findFirst({
    where: { id: goalId, ...doDono(ctx) },
    select: { id: true, name: true, fotoUrl: true, targetAmount: true, currentAmount: true, targetDate: true, annualRate: true, monthlyContribution: true, viagem: true },
  });
  if (!g) return null;
  return {
    id: g.id,
    nome: g.name,
    foto: g.fotoUrl,
    alvo: Number(g.targetAmount),
    guardado: Number(g.currentAmount),
    prazo: g.targetDate,
    taxaAnual: g.annualRate === null ? TAXA_PADRAO_DAS_METAS : Number(g.annualRate),
    porMes: Number(g.monthlyContribution ?? 0),
  };
}

/** O plano aparece para este perfil? Empresa e outra moeda, não; o par do Nós dois, também não. */
export async function planoDisponivel(ctx: AuthContext): Promise<boolean> {
  if (ctx.profileKind === "EMPRESA" || ctx.par) return false;
  const u = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { currency: true } });
  return (u?.currency ?? "BRL").toUpperCase() === "BRL";
}

/**
 * As outras metas em andamento e a reserva incompleta, com o "por mês" combinado de cada uma: é o
 * que ela já guarda (e de onde pode trazer para esta meta). A meta do tipo Reserva conta como reserva.
 */
async function outrasMetas(ctx: AuthContext, menosAMeta: string): Promise<OutraMeta[]> {
  const [metas, reserva] = await Promise.all([
    prisma.goal.findMany({
      where: { ...doDono(ctx), status: { not: "ACHIEVED" }, id: { not: menosAMeta } },
      select: { id: true, name: true, icon: true, fotoUrl: true, targetAmount: true, currentAmount: true, targetDate: true, annualRate: true, monthlyContribution: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.emergencyFund.findFirst({ where: doDono(ctx), select: { targetAmount: true, currentAmount: true, monthlyContribution: true, annualRate: true } }),
  ]);
  const out: OutraMeta[] = [];
  if (reserva && Number(reserva.currentAmount) < Number(reserva.targetAmount) && Number(reserva.monthlyContribution) > 0) {
    out.push({ id: "reserva", nome: "Reserva", foto: null, porMes: Number(reserva.monthlyContribution), alvo: Number(reserva.targetAmount), guardado: Number(reserva.currentAmount), prazo: null, taxaAnual: Number(reserva.annualRate), reserva: true });
  }
  for (const g of metas) {
    if (!(Number(g.currentAmount) < Number(g.targetAmount)) || !(Number(g.monthlyContribution ?? 0) > 0)) continue;
    out.push({ id: g.id, nome: g.name, foto: g.fotoUrl ?? fotoDoTipo(g.icon), porMes: Number(g.monthlyContribution), alvo: Number(g.targetAmount), guardado: Number(g.currentAmount), prazo: g.targetDate, taxaAnual: g.annualRate === null ? TAXA_PADRAO_DAS_METAS : Number(g.annualRate), reserva: g.icon === "RESERVA" });
  }
  return out;
}

/** Os gastos dela nos meses pedidos, no formato do motor. */
export async function lancamentosDoPlano(ctx: AuthContext, meses: { ano: number; mes: number }[]): Promise<LancamentoDoPlano[]> {
  const casa = casaAtiva(ctx);
  const [linhas, regras] = await Promise.all([
    prisma.monthlyEntry.findMany({
      where: { ...doDono(ctx), category: "EXPENSE", OR: meses.map((m) => ({ year: m.ano, month: m.mes })) },
      select: { year: true, month: true, amount: true, parentCategory: true, customCategoryId: true, customCategory: { select: { name: true } }, subcategory: true, description: true, recurrenceId: true, contaAPagarId: true, doCasal: true, soMeu: true, doPar: true },
      take: 20000,
    }),
    casa ? prisma.regraDaCasa.findMany({ where: doDono(ctx), select: { pattern: true, daCasa: true } }) : Promise.resolve([]),
  ]);
  const essenciais = categoriasEssenciais(ctx.categorias?.prefs);
  const aprendidas = new Map(regras.map((r) => [r.pattern, r.daCasa]));
  return linhas.map((l) => ({
    ano: l.year,
    mes: l.month,
    valor: Number(l.amount),
    categoria: l.parentCategory,
    categoriaPropria: l.customCategoryId ? { nome: l.customCategory?.name ?? "", essencial: essenciais.has(l.customCategoryId) } : null,
    subcategoria: l.subcategory,
    descricao: l.description,
    fixa: l.recurrenceId !== null || l.contaAPagarId !== null,
    daCasa: casa ? ehDaCasa({ category: "EXPENSE", soMeu: l.soMeu, doPar: l.doPar, doCasal: l.doCasal, description: l.description, parentCategory: l.parentCategory, subcategory: l.subcategory } as Parameters<typeof ehDaCasa>[0], aprendidas) : false,
  }));
}

/** As assinaturas que as três telas conhecem, com o estado único e em quantos meses cobraram. */
async function assinaturasDoPlano(ctx: AuthContext, hoje: Date, lancamentos: LancamentoDoPlano[]): Promise<AssinaturaDoPlano[]> {
  const [respostas, raiox, guardados, dela] = await Promise.all([
    carregarRespostasDeAssinatura(ctx),
    itensDoRaioX(ctx, hoje.getFullYear(), hoje.getMonth() + 1),
    listarAchadosGuardados(ctx),
    listarAssinaturasDela(ctx),
  ]);
  type Cand = { nome: string; mensal: number; marcas: string[]; descricao: string | null };
  const cands: Cand[] = [
    ...raiox.map((i) => ({ nome: i.nome, mensal: i.mensal, marcas: marcasDoRaioX(i), descricao: i.descricao ?? null })),
    ...guardados
      .filter((g) => g.tipo === "assinatura")
      .map((g) => ({ nome: g.nome, mensal: g.mensal ?? 0, marcas: marcasDoAchado({ comerciante: g.dados?.comerciante ?? null, nome: g.nome, descricaoDoLogo: g.dados?.descricaoDoLogo ?? g.nome }), descricao: g.dados?.descricaoDoLogo ?? null })),
    ...dela.map((d) => ({ nome: d.nome, mensal: d.valor ?? 0, marcas: marcasDaDela(d), descricao: null })),
  ];
  const juntas: Cand[] = [];
  for (const c of cands) {
    const j = juntas.find((x) => mesmaAssinatura(x.marcas, c.marcas));
    if (j) {
      j.marcas = juntarMarcas(j.marcas, c.marcas);
      if (c.mensal > j.mensal) j.mensal = c.mensal;
      j.descricao ??= c.descricao;
    } else juntas.push({ ...c, marcas: [...c.marcas] });
  }
  return juntas.map((c) => {
    const cobrou = new Set<number>();
    for (const l of lancamentos) {
      if (!l.descricao) continue;
      if (mesmaAssinatura(marcasDa({ comerciante: chaveDoComercianteDe(l.descricao), raiox: chaveRaioX(l.descricao) }), c.marcas)) cobrou.add(l.ano * 12 + l.mes);
    }
    return { nome: c.nome, mensal: c.mensal, estado: estadoPara(respostas, c.marcas), marcas: c.marcas, mesesCobrados: cobrou.size, marca: marcaDaDescricao(c.descricao ?? c.nome)?.slug ?? null };
  });
}

/** Tudo o que o motor precisa para a meta, de quem olha. */
export async function entradaDoPlano(ctx: AuthContext, meta: MetaDoPlano, hoje: Date): Promise<EntradaDoPlano> {
  const meses = mesesFechados(hoje);
  const [u, renda, gasto, outras, lancamentos] = await Promise.all([
    prisma.user.findUnique({ where: { id: ctx.userId }, select: { currency: true } }),
    getRendaMedia(ctx, hoje),
    getTypicalMonthlyExpense(ctx),
    outrasMetas(ctx, meta.id),
    lancamentosDoPlano(ctx, meses),
  ]);
  const assinaturas = await assinaturasDoPlano(ctx, hoje, lancamentos);
  return {
    hoje,
    perfil: { tipo: ctx.par ? "EMPRESA" : ctx.profileKind, moeda: u?.currency ?? "BRL" },
    meta: { alvo: meta.alvo, guardado: meta.guardado, prazo: meta.prazo, taxaAnual: meta.taxaAnual },
    rendaMedia: renda?.valor ?? null,
    rendaMeses: renda?.meses ?? 0,
    gastoTipico: gasto ? { media: gasto.monthlyAverage, meses: gasto.monthsUsed } : null,
    aportesCombinados: outras.reduce((t, o) => t + o.porMes, 0),
    outras,
    lancamentos,
    assinaturas,
  };
}

export { cobrancasDeAssinatura };

/* ---------------------------------------------------------------- o plano gravado */

export async function lerPlano(ctx: AuthContext, goalId: string): Promise<PlanoGravado | null> {
  const d = await prisma.decisao.findFirst({ where: { ...doDono(ctx), tipo: TIPO_DO_PLANO, chave: goalId }, orderBy: { createdAt: "desc" }, select: { dados: true } });
  return d ? planoDoRegistro(d.dados) : null;
}

/** Os planos de todas as metas do perfil (para o selo "Com plano"). */
export async function planosDoPerfil(ctx: AuthContext): Promise<Map<string, PlanoGravado>> {
  const linhas = await prisma.decisao.findMany({ where: { ...doDono(ctx), tipo: TIPO_DO_PLANO }, orderBy: { createdAt: "asc" }, select: { chave: true, dados: true } });
  const out = new Map<string, PlanoGravado>();
  for (const l of linhas) {
    const p = planoDoRegistro(l.dados);
    if (l.chave && p) out.set(l.chave, p);
  }
  return out;
}

/**
 * Grava o plano (troca o anterior da mesma meta) e atualiza a meta, juntos. Guarda a meta de antes
 * (para o "Tirar o plano" voltar) e como o plano a deixou (para saber se ela mexeu depois).
 */
export async function gravarPlano(ctx: AuthContext, goalId: string, plano: PlanoGravado, meta: { alvo: number; prazo: Date | null; porMes: number }, trazidos: Trazido[] = []): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const g = await tx.goal.findFirst({ where: { id: goalId, ...doDono(ctx) }, select: { targetAmount: true, targetDate: true, monthlyContribution: true } });
    if (!g) return false;
    const anterior = await tx.decisao.findFirst({ where: { ...doDono(ctx), tipo: TIPO_DO_PLANO, chave: goalId }, orderBy: { createdAt: "desc" }, select: { dados: true } });
    const agora = valoresDaMeta({ alvo: Number(g.targetAmount), prazo: g.targetDate, porMes: Number(g.monthlyContribution ?? 0) });
    const planoAnterior = anterior ? planoDoRegistro(anterior.dados) : null;
    // O que veio de outras metas num plano anterior continua registrado (o "Tirar" devolve tudo).
    let todosTrazidos = trazidos;
    if (planoAnterior?.trazidos?.length) {
      const ids = planoAnterior.trazidos.map((t) => t.id);
      const [outras, reserva] = await Promise.all([
        tx.goal.findMany({ where: { id: { in: ids.filter((x) => x !== "reserva") }, ...doDono(ctx) }, select: { id: true, monthlyContribution: true } }),
        ids.includes("reserva") ? tx.emergencyFund.findFirst({ where: doDono(ctx), select: { monthlyContribution: true } }) : Promise.resolve(null),
      ]);
      const agoraOutras = new Map<string, number>(outras.map((o) => [o.id, Number(o.monthlyContribution ?? 0)]));
      if (reserva) agoraOutras.set("reserva", Number(reserva.monthlyContribution));
      todosTrazidos = juntarTrazidos(planoAnterior.trazidos, trazidos, agoraOutras);
    }
    const completo: PlanoGravado = { ...plano, antes: antesDoPlanoNovo(planoAnterior, agora), depois: valoresDaMeta(meta), ...(todosTrazidos.length ? { trazidos: todosTrazidos } : {}) };
    await tx.goal.updateMany({ where: { id: goalId, ...doDono(ctx) }, data: { targetAmount: meta.alvo, targetDate: meta.prazo, monthlyContribution: meta.porMes } });
    // O que veio das outras metas: o "por mês" delas desce (o prazo fica; o app mostra quando chegam).
    for (const t of trazidos) {
      if (t.id === "reserva") await tx.emergencyFund.updateMany({ where: doDono(ctx), data: { monthlyContribution: t.depois } });
      else await tx.goal.updateMany({ where: { id: t.id, ...doDono(ctx) }, data: { monthlyContribution: t.depois } });
    }
    await tx.decisao.deleteMany({ where: { ...doDono(ctx), tipo: TIPO_DO_PLANO, chave: goalId } });
    await tx.decisao.create({ data: { ...doDono(ctx), tipo: TIPO_DO_PLANO, chave: goalId, valor: plano.achado, descricao: "plano", dados: completo } });
    return true;
  });
}

/** O que o "Tirar o plano" vai fazer com a meta, para a tela avisar antes. */
export function previaDoTirar(meta: MetaDoPlano, plano: PlanoGravado) {
  return oQueTirarFaz(plano, valoresDaMeta({ alvo: meta.alvo, prazo: meta.prazo, porMes: meta.porMes }));
}

/**
 * "Tirar o plano": sai o plano (tetos e avisos) e, se o plano tinha mudado a meta e ela não mexeu
 * depois, a meta volta aos valores de antes. Se ela mexeu à mão, a meta fica como está.
 */
export async function tirarPlano(ctx: AuthContext, goalId: string): Promise<"voltou" | "ficou" | "nada"> {
  return prisma.$transaction(async (tx) => {
    const [d, g] = await Promise.all([
      tx.decisao.findFirst({ where: { ...doDono(ctx), tipo: TIPO_DO_PLANO, chave: goalId }, orderBy: { createdAt: "desc" }, select: { dados: true } }),
      tx.goal.findFirst({ where: { id: goalId, ...doDono(ctx) }, select: { targetAmount: true, targetDate: true, monthlyContribution: true } }),
    ]);
    const plano = d ? planoDoRegistro(d.dados) : null;
    await tx.decisao.deleteMany({ where: { ...doDono(ctx), tipo: TIPO_DO_PLANO, chave: goalId } });
    if (!plano || !g) return "nada";
    // O que veio das outras metas volta para elas (se ela não mexeu no "por mês" delas depois).
    if (plano.trazidos?.length) {
      const ids = plano.trazidos.filter((t) => t.id !== "reserva").map((t) => t.id);
      const [outras, reserva] = await Promise.all([
        tx.goal.findMany({ where: { id: { in: ids }, ...doDono(ctx) }, select: { id: true, monthlyContribution: true } }),
        plano.trazidos.some((t) => t.id === "reserva") ? tx.emergencyFund.findFirst({ where: doDono(ctx), select: { monthlyContribution: true } }) : Promise.resolve(null),
      ]);
      const agora = new Map<string, number>(outras.map((o) => [o.id, Number(o.monthlyContribution ?? 0)]));
      if (reserva) agora.set("reserva", Number(reserva.monthlyContribution));
      for (const v of devolucoes(plano, agora)) {
        if (v.id === "reserva") await tx.emergencyFund.updateMany({ where: doDono(ctx), data: { monthlyContribution: v.porMes } });
        else await tx.goal.updateMany({ where: { id: v.id, ...doDono(ctx) }, data: { monthlyContribution: v.porMes } });
      }
    }
    const r = oQueTirarFaz(plano, valoresDaMeta({ alvo: Number(g.targetAmount), prazo: g.targetDate, porMes: Number(g.monthlyContribution ?? 0) }));
    if (r.acao !== "voltar") return r.acao === "mexida" ? "ficou" : "nada";
    await tx.goal.updateMany({ where: { id: goalId, ...doDono(ctx) }, data: { targetAmount: r.valores.alvo, targetDate: dataDoPrazo(r.valores.prazo), monthlyContribution: r.valores.porMes } });
    return "voltou";
  });
}
