import type { ParentCategory } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { doDono, type AuthContext } from "@/lib/auth/session";
import { categorizarLinha } from "@/lib/import/motor";
import { mesmaCobranca } from "@/lib/contas/achar-contas";
import {
  PREFIXO_DA_RECUSA,
  TIPO_ASSINATURA,
  chaveDaRecusa, chavesDaRecusa,
  chaveDoComercianteDe,
  comerciantesParaEscolher,
  nomeBase,
  vencimentoDaAssinatura,
  type AssinaturaDela,
  type ComercianteParaEscolher,
} from "@/lib/contas/assinaturas";
import { lancamentosParaCacar } from "@/lib/repositories/dinheiro-perdido.repo";

/**
 * Assinatura posta à mão (13/10/2026). Mora na ContaAPagar com `tipo` = "assinatura", todo mês,
 * sem lembrete (ela não paga: a cobrança cai sozinha) e marcada como dela (`editadaPelaPessoa`:
 * as contas do histórico nunca sobrescrevem). Sempre por usuário + perfil.
 */

const CATEGORIAS = new Set<string>(["MORADIA", "ALIMENTACAO", "TRANSPORTE", "SAUDE", "LAZER", "EDUCACAO", "OUTROS", "IMPOSTOS"]);
const categoriaValida = (c: string | null | undefined): ParentCategory | null => (c && CATEGORIAS.has(c) ? (c as ParentCategory) : null);

/** As assinaturas que ela pôs, em aberto. */
export async function listarAssinaturasDela(ctx: AuthContext): Promise<AssinaturaDela[]> {
  const linhas = await prisma.contaAPagar.findMany({
    where: { ...doDono(ctx), tipo: TIPO_ASSINATURA, quitada: false },
    select: { id: true, nome: true, valor: true, diaDoMes: true, chaveDoHistorico: true, categoria: true },
    orderBy: { nome: "asc" },
  });
  return linhas.map((l) => ({ id: l.id, nome: l.nome, valor: l.valor === null ? null : Number(l.valor), diaDoMes: l.diaDoMes, chaveDoHistorico: l.chaveDoHistorico, categoria: l.categoria }));
}

/** As achadas sozinhas que ela disse "Não é assinatura" (as chaves). */
export async function listarRecusasDeAssinatura(ctx: AuthContext): Promise<Set<string>> {
  const linhas = await prisma.contaRecusada.findMany({ where: { ...doDono(ctx), chave: { startsWith: PREFIXO_DA_RECUSA } }, select: { chave: true } });
  return new Set(linhas.map((l) => l.chave));
}

/** Os gastos deste mês, leves: é o que diz se a assinatura já saiu ("pago este mês"). */
export async function gastosDoMesParaAssinaturas(ctx: AuthContext, ano: number, mes: number): Promise<{ descricao: string | null; valor: number }[]> {
  const linhas = await prisma.monthlyEntry.findMany({
    where: { ...doDono(ctx), year: ano, month: mes, category: "EXPENSE" },
    select: { description: true, amount: true },
    take: 5000,
  });
  return linhas.map((l) => ({ descricao: l.description, valor: Number(l.amount) }));
}

/** Últimos meses que a lista "Escolher dos meus lançamentos" olha (este e os 2 de antes). */
const MESES_DA_ESCOLHA = 3;

async function comerciantesDosUltimosMeses(ctx: AuthContext, hoje: Date, jaTem: ReadonlySet<string>): Promise<ComercianteParaEscolher[]> {
  const fim = hoje.getUTCFullYear() * 12 + hoje.getUTCMonth();
  const lancamentos = (await lancamentosParaCacar(ctx)).filter((l) => l.ano * 12 + (l.mes - 1) > fim - MESES_DA_ESCOLHA);
  return comerciantesParaEscolher(lancamentos, jaTem);
}

/** A lista para escolher: um item por comerciante, sem os que ela já marcou nem os que já são conta (o aluguel, a luz). */
export async function listarParaEscolher(ctx: AuthContext, hoje: Date): Promise<ComercianteParaEscolher[]> {
  const todas = await prisma.contaAPagar.findMany({ where: { ...doDono(ctx), quitada: false }, select: { nome: true, valor: true, chaveDoHistorico: true, tipo: true } });
  const jaTem = new Set(todas.flatMap((d) => (d.chaveDoHistorico ? [d.chaveDoHistorico] : [])));
  const contas = todas.filter((c) => c.tipo !== TIPO_ASSINATURA).map((c) => ({ nome: c.nome, valor: c.valor === null ? null : Number(c.valor), chaveDoHistorico: c.chaveDoHistorico }));
  return (await comerciantesDosUltimosMeses(ctx, hoje, jaTem)).filter((c) => !mesmaCobranca(c.nome, contas)).slice(0, 300);
}

/**
 * Tocou num comerciante: vira assinatura com o último valor e o dia da última cobrança. O valor
 * vem do extrato dela, nunca da tela. A conta do histórico do mesmo comerciante (a Smart Fit que
 * o app pôs em Contas) muda de lugar em vez de duplicar.
 */
export async function adicionarDosLancamentos(ctx: AuthContext, chave: string, hoje: Date): Promise<{ id: string; nome: string } | null> {
  const ja = await prisma.contaAPagar.findFirst({ where: { ...doDono(ctx), chaveDoHistorico: chave, quitada: false }, select: { id: true, nome: true, tipo: true } });
  if (ja) {
    if (ja.tipo !== TIPO_ASSINATURA) await prisma.contaAPagar.updateMany({ where: { id: ja.id, ...doDono(ctx) }, data: { tipo: TIPO_ASSINATURA, lembrar: false, editadaPelaPessoa: true } });
    return { id: ja.id, nome: ja.nome };
  }
  const item = (await comerciantesDosUltimosMeses(ctx, hoje, new Set())).find((c) => c.chave === chave);
  if (!item) return null;
  const dia = item.ultimaData ? Number(item.ultimaData.slice(8, 10)) : null;
  const criada = await prisma.contaAPagar.create({
    data: {
      ...doDono(ctx),
      tipo: TIPO_ASSINATURA,
      nome: item.nome.slice(0, 80),
      valor: item.ultimoValor,
      vencimento: vencimentoDaAssinatura(dia, hoje),
      diaDoMes: dia,
      repete: true,
      lembrar: false,
      chaveDoHistorico: chave,
      categoria: categoriaValida(item.categoria),
      editadaPelaPessoa: true,
    },
    select: { id: true, nome: true },
  });
  return criada;
}

export type AssinaturaEscrita = { nome: string; valor: number; dia: number | null; categoria: string | null };

/**
 * Escreveu: nome, valor por mês, o dia (se souber) e a categoria. O comerciante sai do nome
 * ("Netflix" → m:netflix), para os próximos lançamentos serem reconhecidos. O mesmo nome que ela já
 * tem é atualizado, não duplicado.
 */
export async function escreverAssinatura(ctx: AuthContext, d: AssinaturaEscrita, hoje: Date, id?: string): Promise<{ id: string } | null> {
  const dados = {
    nome: d.nome.slice(0, 80),
    valor: d.valor,
    diaDoMes: d.dia,
    vencimento: vencimentoDaAssinatura(d.dia, hoje),
    categoria: categoriaValida(d.categoria),
  };
  if (id) {
    const r = await prisma.contaAPagar.updateMany({ where: { id, ...doDono(ctx), tipo: TIPO_ASSINATURA }, data: { ...dados, editadaPelaPessoa: true } });
    return r.count > 0 ? { id } : null;
  }
  const dela = await listarAssinaturasDela(ctx);
  const igual = dela.find((a) => nomeBase(a.nome) === nomeBase(d.nome));
  if (igual) {
    await prisma.contaAPagar.updateMany({ where: { id: igual.id, ...doDono(ctx), tipo: TIPO_ASSINATURA }, data: dados });
    return { id: igual.id };
  }
  return prisma.contaAPagar.create({
    data: { ...doDono(ctx), ...dados, tipo: TIPO_ASSINATURA, repete: true, lembrar: false, chaveDoHistorico: chaveDoComercianteDe(d.nome), editadaPelaPessoa: true },
    select: { id: true },
  });
}

/** Tirar a assinatura dela: apaga e guarda a recusa pelo nome (a achada igual não volta no lugar). */
export async function removerAssinatura(ctx: AuthContext, id: string): Promise<boolean> {
  const a = await prisma.contaAPagar.findFirst({ where: { id, ...doDono(ctx), tipo: TIPO_ASSINATURA }, select: { nome: true } });
  if (!a) return false;
  await prisma.contaRecusada.createMany({ data: [{ ...doDono(ctx), chave: chaveDaRecusa(a.nome) }], skipDuplicates: true });
  await prisma.contaAPagar.deleteMany({ where: { id, ...doDono(ctx), tipo: TIPO_ASSINATURA } });
  return true;
}

/** "Não é assinatura" numa achada sozinha: some para sempre (a recusa fica guardada, como a das contas). */
export async function recusarAssinatura(ctx: AuthContext, nome: string): Promise<void> {
  await prisma.contaRecusada.createMany({ data: [{ ...doDono(ctx), chave: chaveDaRecusa(nome) }], skipDuplicates: true });
}

/** O "Desfazer" do "Não é assinatura" (14/10/2026): um toque errado sumia com ela para sempre. */
export async function desfazerRecusaDeAssinatura(ctx: AuthContext, nome: string): Promise<void> {
  await prisma.contaRecusada.deleteMany({ where: { ...doDono(ctx), chave: { in: chavesDaRecusa(nome) } } });
}

/** A categoria que o motor da importação daria para o nome (a regra dela primeiro). */
export async function sugerirCategoria(ctx: AuthContext, nome: string): Promise<ParentCategory> {
  const regras = await prisma.transactionCategoryRule.findMany({ where: { ...doDono(ctx) }, orderBy: { updatedAt: "desc" }, take: 2000 });
  const achada = categorizarLinha({
    descricao: nome,
    regras: regras.map((r) => ({ pattern: r.pattern, parentCategory: r.parentCategory, subcategory: r.subcategory ?? undefined })),
    profileKind: ctx.profileKind,
    gasto: true,
  });
  return achada?.classificacao.parentCategory ?? "OUTROS";
}
