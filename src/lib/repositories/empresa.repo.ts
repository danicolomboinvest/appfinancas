import type { ParentCategory, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { doDono, type AuthContext } from "@/lib/auth/session";
import { ehForma, lerConfigEmpresa, type ConfigEmpresa, type Forma } from "@/lib/empresa/config";
import { SUBCATEGORIA_DO_SALARIO, chaveDoMes, type LancamentoDaEmpresa, type Mes } from "@/lib/empresa/regras";

/**
 * O que a Empresa refeita lê e grava (versão nova, 11/10/2026). Tudo no perfil ativo (doDono), menos
 * a entrada do salário no Pessoal, que vai para o perfil Pessoal da MESMA conta, conferido aqui.
 */

const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const data = (texto: string) => new Date(`${texto}T00:00:00Z`);

export async function lerPerfilDaEmpresa(ctx: AuthContext): Promise<{ nome: string; config: ConfigEmpresa | null }> {
  const p = await prisma.financialProfile.findFirst({ where: { id: ctx.profileId, userId: ctx.userId }, select: { name: true, empresa: true } });
  return { nome: p?.name ?? "Empresa", config: lerConfigEmpresa(p?.empresa) };
}

export async function salvarConfigDaEmpresa(ctx: AuthContext, config: ConfigEmpresa) {
  return prisma.financialProfile.updateMany({ where: { id: ctx.profileId, userId: ctx.userId, kind: "EMPRESA" }, data: { empresa: config as unknown as Prisma.InputJsonValue } });
}

/** Os lançamentos do perfil de `desde` até hoje (inclusive), já no formato das regras. */
export async function lancamentosDaEmpresa(ctx: AuthContext, desde: Mes): Promise<LancamentoDaEmpresa[]> {
  const linhas = await prisma.monthlyEntry.findMany({
    where: { ...doDono(ctx), OR: [{ year: { gt: desde.ano } }, { year: desde.ano, month: { gte: desde.mes } }] },
    orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true, year: true, month: true, category: true, parentCategory: true, customCategoryId: true, subcategory: true, description: true,
      amount: true, entryDate: true, cliente: true, formaDeRecebimento: true, recebeEm: true, recebidoEm: true, externalId: true,
    },
  });
  return linhas.map((l) => ({
    id: l.id,
    year: l.year,
    month: l.month,
    category: l.category,
    parentCategory: l.parentCategory,
    customCategoryId: l.customCategoryId,
    subcategory: l.subcategory,
    description: l.description,
    amount: Number(l.amount),
    entryDate: iso(l.entryDate),
    cliente: l.cliente,
    forma: ehForma(l.formaDeRecebimento) ? l.formaDeRecebimento : null,
    recebeEm: iso(l.recebeEm),
    recebidoEm: iso(l.recebidoEm),
    externalId: l.externalId,
  }));
}

export type VendaInput = { valor: number; forma: Forma; cliente: string | null; hoje: string; recebeEm: string | null; recebida: boolean };

/** "Vendi": entra no mês de hoje. O cliente e a data em que o dinheiro cai são opcionais. */
export async function registrarVenda(ctx: AuthContext, v: VendaInput) {
  const [ano, mes] = v.hoje.split("-").map(Number);
  return prisma.monthlyEntry.create({
    data: {
      ...doDono(ctx),
      year: ano,
      month: mes,
      category: "INCOME",
      subcategory: "Vendas",
      description: v.cliente ? `Venda, ${v.cliente}` : "Venda",
      amount: v.valor,
      entryDate: data(v.hoje),
      cliente: v.cliente,
      formaDeRecebimento: v.forma,
      recebeEm: v.recebeEm ? data(v.recebeEm) : null,
      recebidoEm: v.recebida ? data(v.hoje) : null,
    },
  });
}

export type PagamentoInput = { valor: number; parentCategory: ParentCategory | null; subcategory: string | null; descricao: string; hoje: string };

/** "Paguei": uma saída no mês de hoje. */
export async function registrarPagamento(ctx: AuthContext, p: PagamentoInput) {
  const [ano, mes] = p.hoje.split("-").map(Number);
  return prisma.monthlyEntry.create({
    data: { ...doDono(ctx), year: ano, month: mes, category: "EXPENSE", parentCategory: p.parentCategory, subcategory: p.subcategory, description: p.descricao, amount: p.valor, entryDate: data(p.hoje) },
  });
}

/** "Recebi": a venda a prazo virou dinheiro hoje. */
export async function marcarRecebida(ctx: AuthContext, id: string, hoje: string) {
  return prisma.monthlyEntry.updateMany({ where: { id, ...doDono(ctx), category: "INCOME", recebidoEm: null }, data: { recebidoEm: data(hoje) } });
}

/** Os nomes de cliente das vendas recentes, do que mais comprou para o que menos. */
export async function clientesRecentes(ctx: AuthContext, desde: string): Promise<string[]> {
  const g = await prisma.monthlyEntry.groupBy({
    by: ["cliente"],
    where: { ...doDono(ctx), category: "INCOME", cliente: { not: null }, entryDate: { gte: data(desde) } },
    _sum: { amount: true },
  });
  return g
    .filter((x): x is typeof x & { cliente: string } => !!x.cliente)
    .sort((a, b) => Number(b._sum.amount ?? 0) - Number(a._sum.amount ?? 0))
    .map((x) => x.cliente)
    .slice(0, 6);
}

/** O perfil Pessoal da conta (para onde o salário vai). Nulo se ela não tem um. */
export async function perfilPessoal(ctx: AuthContext): Promise<{ id: string; nome: string } | null> {
  const p = await prisma.financialProfile.findFirst({ where: { userId: ctx.userId, kind: "PESSOAL" }, orderBy: [{ isDefault: "desc" }, { position: "asc" }], select: { id: true, name: true } });
  return p ? { id: p.id, nome: p.name } : null;
}

const chaveDoSalario = (m: Mes) => `prolabore:${chaveDoMes(m)}`;

/** O salário do mês já foi transferido? (devolve o valor). */
export async function salarioTransferido(ctx: AuthContext, m: Mes): Promise<number | null> {
  const l = await prisma.monthlyEntry.findFirst({ where: { ...doDono(ctx), externalId: chaveDoSalario(m) }, select: { amount: true } });
  return l ? Number(l.amount) : null;
}

/**
 * O holerite "PAGO": o salário do mês `ref` sai da Empresa (pró-labore, hoje) e entra no Pessoal
 * (entrada, hoje). Nada sai do banco: é o registro. Os dois lados levam uma chave do mês, então
 * tocar duas vezes não paga duas vezes.
 */
export async function transferirSalario(ctx: AuthContext, p: { ref: Mes; valor: number; hoje: string; nomeDaEmpresa: string; nomeDoMes: string }) {
  const pessoal = await perfilPessoal(ctx);
  if (!pessoal) return { ok: false as const, erro: "Você ainda não tem um perfil Pessoal." };
  if (await salarioTransferido(ctx, p.ref)) return { ok: false as const, erro: "O salário deste mês já foi para o Pessoal." };
  const [ano, mes] = p.hoje.split("-").map(Number);
  const comum = { year: ano, month: mes, amount: p.valor, entryDate: data(p.hoje), subcategory: SUBCATEGORIA_DO_SALARIO };
  await prisma.$transaction([
    prisma.monthlyEntry.create({
      data: { ...comum, ...doDono(ctx), category: "EXPENSE", parentCategory: "SAUDE", description: `Pró-labore de ${p.nomeDoMes}`, externalId: chaveDoSalario(p.ref) },
    }),
    prisma.monthlyEntry.create({
      data: { ...comum, userId: ctx.userId, profileId: pessoal.id, category: "INCOME", description: `Pró-labore · ${p.nomeDaEmpresa}`, externalId: `${chaveDoSalario(p.ref)}:${ctx.profileId}` },
    }),
  ]);
  return { ok: true as const, pessoal };
}

/**
 * A guia do MEI nas contas do perfil (Recorrentes): é ela que avisa na véspera e no dia. Cria uma vez;
 * depois só liga ou desliga o lembrete.
 */
export async function garantirContaDaGuia(ctx: AuthContext, p: { valor: number; dia: number; lembrar: boolean; hoje: string }) {
  const existe = await prisma.contaAPagar.findFirst({ where: { ...doDono(ctx), nome: "Guia do MEI", quitada: false }, select: { id: true } });
  if (existe) return prisma.contaAPagar.updateMany({ where: { id: existe.id, ...doDono(ctx) }, data: { lembrar: p.lembrar } });
  const [ano, mes, diaHoje] = p.hoje.split("-").map(Number);
  // O próximo dia 20: este mês, se ainda não passou; senão, o mês que vem.
  const proximo = diaHoje <= p.dia ? new Date(Date.UTC(ano, mes - 1, p.dia)) : new Date(Date.UTC(ano, mes, p.dia));
  return prisma.contaAPagar.create({ data: { ...doDono(ctx), nome: "Guia do MEI", valor: p.valor, vencimento: proximo, diaDoMes: p.dia, repete: true, lembrar: p.lembrar } });
}
