import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { cacarDinheiroPerdido, estornoCaiu, type Achado, type LancamentoParaCacar, type ResultadoDaCaca } from "@/lib/dinheiro-perdido/detectar";
import { ESTADOS, type EstadoDoAchado } from "@/lib/dinheiro-perdido/placar";
import { MESES_OLHADOS } from "@/lib/dinheiro-perdido/config";

/** O pedaço do contexto que as consultas usam (a sincronização do Open Finance monta só isso). */
export type DonoDoPerfil = Pick<AuthContext, "userId" | "profileId">;

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/** Os lançamentos dos últimos meses, no formato do motor (gastos e entradas, para achar o estorno). */
export async function lancamentosParaCacar(ctx: DonoDoPerfil, agora = nowInBrazil()): Promise<LancamentoParaCacar[]> {
  const fim = agora.getFullYear() * 12 + agora.getMonth();
  const meses = Array.from({ length: MESES_OLHADOS }, (_, i) => fim - i).map((m) => ({ year: Math.floor(m / 12), month: (m % 12) + 1 }));
  const linhas = await prisma.monthlyEntry.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, OR: meses, category: { in: ["EXPENSE", "INCOME"] } },
    select: { id: true, year: true, month: true, category: true, parentCategory: true, subcategory: true, description: true, amount: true, entryDate: true, importBatchId: true },
  });
  return linhas.map((e) => ({
    id: e.id,
    descricao: e.description,
    valor: Math.abs(Number(e.amount)),
    data: iso(e.entryDate),
    ano: e.year,
    mes: e.month,
    tipo: e.category,
    categoria: e.parentCategory,
    subcategoria: e.subcategory,
    lote: e.importBatchId,
    estorno: e.category === "EXPENSE" && Number(e.amount) < 0,
  }));
}

export type AchadoGuardado = {
  chave: string;
  tipo: string;
  nome: string;
  mensal: number | null;
  unico: number | null;
  dados: Partial<Achado> | null;
  estado: EstadoDoAchado;
  decididoEm: Date | null;
  estornoEm: Date | null;
  vistoEm: Date | null;
  createdAt: Date;
};

const estadoValido = (e: string): EstadoDoAchado => ((ESTADOS as readonly string[]).includes(e) ? (e as EstadoDoAchado) : "aberto");

export async function listarAchadosGuardados(ctx: DonoDoPerfil): Promise<AchadoGuardado[]> {
  const linhas = await prisma.achadoDinheiroPerdido.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId },
    orderBy: { createdAt: "asc" },
  });
  return linhas.map((l) => ({
    chave: l.chave,
    tipo: l.tipo,
    nome: l.nome,
    mensal: l.mensal === null ? null : Number(l.mensal),
    unico: l.unico === null ? null : Number(l.unico),
    dados: (l.dados as Partial<Achado> | null) ?? null,
    estado: estadoValido(l.estado),
    decididoEm: l.decididoEm,
    estornoEm: l.estornoEm,
    vistoEm: l.vistoEm,
    createdAt: l.createdAt,
  }));
}

/** O que fica guardado de um achado para mostrar de novo sem recalcular (a fotografia). */
function fotografia(a: Achado): Prisma.InputJsonValue {
  const { lancamentos, ...resto } = a;
  void lancamentos;
  return JSON.parse(JSON.stringify(resto)) as Prisma.InputJsonValue;
}

/**
 * Grava a escolha da pessoa num achado. Com o achado (recalculado no servidor), guarda a fotografia
 * dos valores; sem ele (o achado sumiu do extrato, mas a linha existe), só troca o estado.
 */
export async function decidirAchado(ctx: DonoDoPerfil, chave: string, estado: EstadoDoAchado, achado: Achado | null): Promise<boolean> {
  const agora = new Date();
  const decisao = {
    estado,
    decididoEm: estado === "aberto" ? null : agora,
    estornoEm: estado === "estornado" ? agora : null,
    vistoEm: agora,
  };
  if (achado) {
    await prisma.achadoDinheiroPerdido.upsert({
      where: { userId_profileId_chave: { userId: ctx.userId, profileId: ctx.profileId, chave } },
      create: { userId: ctx.userId, profileId: ctx.profileId, chave, tipo: achado.tipo, nome: achado.nome.slice(0, 80), mensal: achado.mensal, unico: achado.unico, dados: fotografia(achado), ...decisao },
      update: { mensal: achado.mensal, unico: achado.unico, dados: fotografia(achado), ...decisao },
    });
    return true;
  }
  const r = await prisma.achadoDinheiroPerdido.updateMany({ where: { userId: ctx.userId, profileId: ctx.profileId, chave }, data: decisao });
  return r.count > 0;
}

/** Ela abriu as cartas: o que estava "novo" deixa de ser, e o que ela viu fica guardado como visto. */
export async function marcarAchadosVistos(ctx: DonoDoPerfil, achados: Achado[]): Promise<void> {
  const agora = new Date();
  await prisma.achadoDinheiroPerdido.updateMany({ where: { userId: ctx.userId, profileId: ctx.profileId, vistoEm: null }, data: { vistoEm: agora } });
  if (achados.length === 0) return;
  await prisma.achadoDinheiroPerdido.createMany({
    data: achados.map((a) => ({ userId: ctx.userId, profileId: ctx.profileId, chave: a.chave, tipo: a.tipo, nome: a.nome.slice(0, 80), mensal: a.mensal, unico: a.unico, dados: fotografia(a), vistoEm: agora })),
    skipDuplicates: true,
  });
}

/**
 * Depois de um extrato novo: recalcula, guarda os achados que ainda não existiam como "novos"
 * (vistoEm nulo, é o "2 cartas novas") e confere se algum estorno pedido caiu. Devolve quantos
 * achados novos e quanto eles somam por ano, para o aviso.
 */
export async function recalcularDinheiroPerdido(ctx: DonoDoPerfil): Promise<{ novos: number; anualNovos: number; estornos: number; resultado: ResultadoDaCaca }> {
  const lancamentos = await lancamentosParaCacar(ctx);
  const resultado = cacarDinheiroPerdido(lancamentos);
  const guardados = await listarAchadosGuardados(ctx);
  const conhecidas = new Set(guardados.map((g) => g.chave));
  const novos = resultado.achados.filter((a) => !conhecidas.has(a.chave));
  if (novos.length > 0) {
    await prisma.achadoDinheiroPerdido.createMany({
      data: novos.map((a) => ({ userId: ctx.userId, profileId: ctx.profileId, chave: a.chave, tipo: a.tipo, nome: a.nome.slice(0, 80), mensal: a.mensal, unico: a.unico, dados: fotografia(a) })),
      skipDuplicates: true,
    });
  }
  let estornos = 0;
  for (const g of guardados.filter((x) => x.estado === "pedi_estorno" && x.dados)) {
    const d = g.dados!;
    const caiu = estornoCaiu({ comerciante: d.comerciante ?? "", ultimaData: d.ultimaData ?? null, unico: g.unico, valorDaCobranca: d.valorDaCobranca, descricaoDoLogo: d.descricaoDoLogo ?? g.nome }, lancamentos);
    if (!caiu) continue;
    await prisma.achadoDinheiroPerdido.updateMany({ where: { userId: ctx.userId, profileId: ctx.profileId, chave: g.chave }, data: { estado: "estornado", estornoEm: new Date() } });
    estornos += 1;
  }
  return { novos: novos.length, anualNovos: novos.reduce((s, a) => s + a.anual, 0), estornos, resultado };
}
