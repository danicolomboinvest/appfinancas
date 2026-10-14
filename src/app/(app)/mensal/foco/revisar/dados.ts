import type { AuthContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { classificarAntigo, TERMOS_REVISAO, type TipoRevisao } from "@/lib/decisoes/revisao-antigos";

/** Até onde olhar pra trás: um ano. Mais que isso já não mexe no que o app mostra hoje. */
const MESES_DE_REVISAO = 12;

export type ItemRevisao = { id: string; tipo: TipoRevisao; descricao: string; valor: number; data: string | null; ano: number; mes: number };

/** Lançamentos já gravados que parecem dinheiro dela mesma (ou estorno), ainda não revisados. */
export async function carregarRevisaoAntigos(ctx: AuthContext): Promise<ItemRevisao[]> {
  const agora = nowInBrazil();
  const meses = Array.from({ length: MESES_DE_REVISAO }, (_, i) => {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });
  const usuario = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } });
  const primeiroNome = (usuario?.name ?? "").trim().split(/\s+/)[0] ?? "";
  const termos = [...TERMOS_REVISAO, ...(primeiroNome.length >= 3 ? [primeiroNome] : [])];
  const [faturas, candidatos, revisados] = await Promise.all([
    prisma.importBatch.count({ where: { userId: ctx.userId, profileId: ctx.profileId, docType: "fatura" } }),
    prisma.monthlyEntry.findMany({
      where: {
        userId: ctx.userId, profileId: ctx.profileId,
        category: { in: ["INCOME", "EXPENSE"] },
        amount: { gt: 0 },
        AND: [{ OR: meses }, { OR: termos.map((t) => ({ description: { contains: t, mode: "insensitive" as const } })) }],
      },
      select: { id: true, category: true, description: true, amount: true, entryDate: true, year: true, month: true },
      orderBy: [{ year: "desc" }, { month: "desc" }, { entryDate: "desc" }],
      take: 500,
    }),
    prisma.decisao.findMany({ where: { userId: ctx.userId, profileId: ctx.profileId, tipo: "revisao_lancamento" }, select: { chave: true } }),
  ]);
  const jaRevisados = new Set(revisados.map((r) => r.chave ?? ""));
  const itens: ItemRevisao[] = [];
  for (const c of candidatos) {
    if (jaRevisados.has(c.id)) continue;
    const tipo = classificarAntigo({ category: c.category, description: c.description, amount: Number(c.amount) }, usuario?.name ?? null, faturas > 0);
    if (!tipo) continue;
    itens.push({ id: c.id, tipo, descricao: c.description ?? "", valor: Number(c.amount), data: c.entryDate ? c.entryDate.toISOString().slice(0, 10) : null, ano: c.year, mes: c.month });
  }
  return itens;
}

/** O rótulo que a importação põe no que ficou sem resposta (StatementImport, A_CONFERIR). */
const A_CONFERIR = "A conferir";

export type ItemAConferir = { id: string; entrada: boolean; descricao: string; valor: number; data: string | null; ano: number; mes: number };

const ONDE_A_CONFERIR = (ctx: AuthContext) => ({
  userId: ctx.userId,
  profileId: ctx.profileId,
  subcategory: A_CONFERIR,
  parentCategory: null,
  customCategoryId: null,
  category: { in: ["INCOME" as const, "EXPENSE" as const] },
});

/**
 * O que entrou "A conferir" (leva 1 do primeiro uso, 14/10/2026): no primeiro extrato só as 3
 * perguntas de maior valor vão na hora; as outras voltam aqui, as maiores primeiro.
 */
export async function carregarAConferir(ctx: AuthContext): Promise<ItemAConferir[]> {
  const linhas = await prisma.monthlyEntry.findMany({
    where: ONDE_A_CONFERIR(ctx),
    select: { id: true, category: true, description: true, amount: true, entryDate: true, year: true, month: true },
    orderBy: [{ amount: "desc" }, { createdAt: "asc" }],
    take: 200,
  });
  return linhas.map((c) => ({ id: c.id, entrada: c.category === "INCOME", descricao: c.description ?? "", valor: Number(c.amount), data: c.entryDate ? c.entryDate.toISOString().slice(0, 10) : null, ano: c.year, mes: c.month }));
}

/** Quantos "A conferir" o perfil tem (o "N lançamentos para conferir" do aha do mês). */
export async function contarAConferir(ctx: AuthContext): Promise<number> {
  return prisma.monthlyEntry.count({ where: ONDE_A_CONFERIR(ctx) });
}

/** O número do "Revisar N lançamentos" do Resumo: os antigos e os "A conferir". */
export async function contarParaRevisar(ctx: AuthContext): Promise<{ antigos: number; aConferir: number }> {
  const [antigos, aConferir] = await Promise.all([carregarRevisaoAntigos(ctx), prisma.monthlyEntry.count({ where: ONDE_A_CONFERIR(ctx) })]);
  return { antigos: antigos.length, aConferir };
}
