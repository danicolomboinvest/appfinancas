import type { EntryCategory, ParentCategory } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import {
  donoDoNovoLancamento,
  donoDoPerfil,
  lancamentosDoAcerto,
  lancamentosQuePodeMexer,
  lancamentosVisiveis,
  metasDoCasal,
} from "@/lib/casal-login/privacidade";
import { assinaturaDoMes, estadoDoFechamento, type EstadoDoFechamento } from "@/lib/casal-login/fechamento";
import { calcularMeuNoCasal, type MeuNoCasal } from "@/lib/casal-login/meu-no-casal";
import { outraLetra } from "@/lib/casal-login/regras";
import type { AcertoDoMes } from "@/lib/repositories/casal.repo";
import { mesDoPeriodo } from "@/lib/mes/periodo";
import { getDiaInicioMesDoUsuario } from "@/lib/repositories/user.repo";

/** O mês em que o lançamento do Nós dois conta: o da titular (30/10/2026), que é a dona do perfil. */
async function mesDoLancamentoDoCasal(ctx: AuthContext, dia: Date): Promise<{ year: number; month: number }> {
  const iso = dia.toISOString().slice(0, 10);
  return mesDoPeriodo(iso, await getDiaInicioMesDoUsuario(donoDoPerfil(ctx))) ?? { year: dia.getUTCFullYear(), month: dia.getUTCMonth() + 1 };
}

/**
 * O Nós dois com dois logins: o que a tela do casal lê e grava, para a titular e para o par. Toda
 * leitura de lançamento passa pelo filtro único de casal-login/privacidade.ts.
 */

export type Destino = "nosso" | "da-pessoa" | "so-meu";

export type LancamentoDoCasal = {
  id: string;
  dia: string | null;
  descricao: string;
  categoria: EntryCategory;
  parentCategory: ParentCategory | null;
  valor: number;
  pessoa: "A" | "B" | null;
  destino: Destino;
  /** Quem olha pode editar e apagar (o par, só o que ele lançou). */
  podeMexer: boolean;
};

export function destinoDe(l: { doCasal: boolean | null; soMeu: boolean }): Destino {
  if (l.soMeu) return "so-meu";
  return l.doCasal === false ? "da-pessoa" : "nosso";
}

/** A letra de quem olha: a do par, ou a outra (a titular) quando há par; sem par, "A". */
export async function letraDeQuemOlha(ctx: AuthContext): Promise<"A" | "B"> {
  if (ctx.par) return ctx.par.letra;
  const m = await prisma.membroCasal.findFirst({ where: { profileId: ctx.profileId, saiuEm: null }, select: { letra: true } });
  return m ? outraLetra(m.letra === "A" ? "A" : "B") : "A";
}

export async function lancamentosDoMesNoCasal(ctx: AuthContext, ano: number, mes: number): Promise<LancamentoDoCasal[]> {
  const linhas = await prisma.monthlyEntry.findMany({
    where: { ...lancamentosVisiveis(ctx), year: ano, month: mes },
    select: { id: true, userId: true, autorUserId: true, entryDate: true, description: true, subcategory: true, category: true, parentCategory: true, amount: true, pessoa: true, doCasal: true, soMeu: true },
    orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
    take: 200,
  });
  return linhas.map((l) => ({
    id: l.id,
    dia: l.entryDate ? l.entryDate.toISOString().slice(0, 10) : null,
    descricao: l.description || l.subcategory || "",
    categoria: l.category,
    parentCategory: l.parentCategory,
    valor: Number(l.amount),
    pessoa: l.pessoa === "A" || l.pessoa === "B" ? l.pessoa : null,
    destino: destinoDe(l),
    podeMexer: !ctx.par || l.userId === ctx.userId || l.autorUserId === ctx.userId,
  }));
}

export async function meuNoCasal(ctx: AuthContext, acerto: AcertoDoMes, letra: "A" | "B"): Promise<MeuNoCasal> {
  const linhas = await prisma.monthlyEntry.findMany({
    where: { ...lancamentosVisiveis(ctx), year: acerto.ano, month: acerto.mes, category: "EXPENSE" },
    select: { category: true, amount: true, pessoa: true, doCasal: true, soMeu: true, userId: true, autorUserId: true },
  });
  // O "só meu" que conta aqui é o de quem olha (o do outro nem chega: o filtro já tirou).
  return calcularMeuNoCasal(
    acerto,
    letra,
    linhas.map((l) => ({ category: l.category, amount: Number(l.amount), pessoa: l.pessoa, doCasal: l.doCasal, soMeu: l.soMeu })),
  );
}

export type NovoLancamentoDoCasal = {
  categoria: "EXPENSE" | "INCOME";
  valor: number;
  descricao: string;
  parentCategory: ParentCategory | null;
  dia: Date;
  destino: Destino;
};

/** Lança no Nós dois em nome de quem está logado (a pessoa do lançamento é sempre quem lançou). */
export async function lancarNoCasal(ctx: AuthContext, input: NovoLancamentoDoCasal, letra: "A" | "B") {
  const soMeu = input.categoria === "EXPENSE" && input.destino === "so-meu";
  const mes = await mesDoLancamentoDoCasal(ctx, input.dia);
  return prisma.monthlyEntry.create({
    data: {
      userId: donoDoNovoLancamento(ctx, soMeu),
      profileId: ctx.profileId,
      autorUserId: ctx.userId,
      year: mes.year,
      month: mes.month,
      entryDate: input.dia,
      category: input.categoria,
      parentCategory: input.categoria === "EXPENSE" ? (input.parentCategory ?? "OUTROS") : null,
      description: input.descricao || null,
      amount: input.valor,
      pessoa: letra,
      // Só meu e "da pessoa" ficam fora do acerto.
      doCasal: input.categoria === "EXPENSE" ? input.destino === "nosso" : null,
      soMeu,
    },
    select: { id: true },
  });
}

export async function editarNoCasal(ctx: AuthContext, id: string, input: NovoLancamentoDoCasal): Promise<number> {
  const atual = await prisma.monthlyEntry.findFirst({ where: { id, ...lancamentosQuePodeMexer(ctx) }, select: { id: true, soMeu: true, userId: true } });
  if (!atual) return 0;
  const soMeu = input.categoria === "EXPENSE" && input.destino === "so-meu";
  // Trocar entre "só meu" e o resto muda o dono do registro (o só meu é de quem lançou).
  const userId = donoDoNovoLancamento(ctx, soMeu);
  const mes = await mesDoLancamentoDoCasal(ctx, input.dia);
  const r = await prisma.monthlyEntry.updateMany({
    where: { id, ...lancamentosQuePodeMexer(ctx) },
    data: {
      userId,
      year: mes.year,
      month: mes.month,
      entryDate: input.dia,
      category: input.categoria,
      parentCategory: input.categoria === "EXPENSE" ? (input.parentCategory ?? "OUTROS") : null,
      description: input.descricao || null,
      amount: input.valor,
      doCasal: input.categoria === "EXPENSE" ? input.destino === "nosso" : null,
      soMeu,
    },
  });
  return r.count;
}

export async function apagarNoCasal(ctx: AuthContext, id: string): Promise<number> {
  const r = await prisma.monthlyEntry.deleteMany({ where: { id, ...lancamentosQuePodeMexer(ctx) } });
  return r.count;
}

// --- Metas do casal -----------------------------------------------------------------------------

export type MetaDoCasal = { id: string; nome: string; alvo: number; guardado: number; ate: string | null };

export async function metasDoCasalLista(ctx: AuthContext): Promise<MetaDoCasal[]> {
  const metas = await prisma.goal.findMany({
    where: metasDoCasal(ctx),
    select: { id: true, name: true, targetAmount: true, currentAmount: true, targetDate: true },
    orderBy: { createdAt: "asc" },
  });
  return metas.map((m) => ({ id: m.id, nome: m.name, alvo: Number(m.targetAmount), guardado: Number(m.currentAmount), ate: m.targetDate ? m.targetDate.toISOString().slice(0, 7) : null }));
}

export async function criarMetaDoCasal(ctx: AuthContext, input: { nome: string; alvo: number; ate: Date | null }) {
  // A meta é do casal (da titular, dona do perfil), como os lançamentos: fica com quem paga.
  return prisma.goal.create({
    data: { userId: donoDoPerfil(ctx), profileId: ctx.profileId, name: input.nome, targetAmount: input.alvo, targetDate: input.ate },
    select: { id: true },
  });
}

// --- Fechar o mês a dois -----------------------------------------------------------------------

async function assinaturaAtual(ctx: AuthContext, ano: number, mes: number): Promise<string> {
  const linhas = await prisma.monthlyEntry.findMany({
    where: { ...lancamentosDoAcerto(ctx), year: ano, month: mes, category: { in: ["EXPENSE", "INCOME"] } },
    select: { id: true, amount: true, category: true, pessoa: true, doCasal: true },
  });
  return assinaturaDoMes(linhas.map((l) => ({ ...l, amount: Number(l.amount) })));
}

export type FechamentoNaTela = { estado: EstadoDoFechamento; conferiuEm: { A: string | null; B: string | null } };

export async function estadoDoFechamentoDoMes(ctx: AuthContext, ano: number, mes: number): Promise<FechamentoNaTela> {
  const [f, assinatura] = await Promise.all([
    prisma.fechamentoCasal.findUnique({ where: { profileId_ano_mes: { profileId: ctx.profileId, ano, mes } } }),
    assinaturaAtual(ctx, ano, mes),
  ]);
  // Só vale o confere feito com os lançamentos de agora (se mudou, ele caiu).
  const vale = (em: Date | null, a: string | null) => (em && a === assinatura ? em.toISOString() : null);
  return { estado: estadoDoFechamento(f, assinatura), conferiuEm: { A: f ? vale(f.confereA, f.assinaturaA) : null, B: f ? vale(f.confereB, f.assinaturaB) : null } };
}

/** "Confere" de quem está logado. Quando o segundo confere com tudo igual, o mês fecha. */
export async function conferirMes(ctx: AuthContext, ano: number, mes: number, letra: "A" | "B", agora: Date = new Date()): Promise<EstadoDoFechamento> {
  // Só no perfil Casal em que quem olha é dona ou par (o profileId do contexto já garante isso).
  const assinatura = await assinaturaAtual(ctx, ano, mes);
  const campos = letra === "A" ? { confereA: agora, assinaturaA: assinatura } : { confereB: agora, assinaturaB: assinatura };
  const f = await prisma.fechamentoCasal.upsert({
    where: { profileId_ano_mes: { profileId: ctx.profileId, ano, mes } },
    create: { profileId: ctx.profileId, ano, mes, ...campos },
    update: campos,
  });
  const estado = estadoDoFechamento(f, assinatura);
  if (estado.tipo === "fechado" && !f.fechadoEm) {
    await prisma.fechamentoCasal.update({ where: { id: f.id }, data: { fechadoEm: agora } });
  }
  return estado;
}
