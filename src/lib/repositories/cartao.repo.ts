import { prisma } from "@/lib/db/prisma";
import { PARENT_CATEGORY_LABEL } from "@/lib/categories";
import type { AuthContext } from "@/lib/auth/session";
import { diasValidos, somarMesesAoMes, type Dia } from "@/lib/cartao/fatura";
import { slugDoBancoLido } from "@/lib/cartao/bancos";
import { faturasDoCartao, type CartaoComDias, type FaturasDoCartao, type LancamentoDoCartao } from "@/lib/planning/faturas-do-cartao";

/**
 * Cartões cadastrados (15/10/2026). Todo cartão é do usuário E do perfil aberto, como o resto do
 * dinheiro: o cartão da Empresa não aparece no Pessoal. A regra da fatura está em
 * lib/cartao/fatura.ts e os totais em lib/planning/faturas-do-cartao.ts; aqui só o banco.
 */

const CAMPOS = { id: true, banco: true, apelido: true, diaFechamento: true, diaVencimento: true, final: true } as const;
export type CartaoGravado = CartaoComDias & { final: string | null };

export type DadosDoCartao = { banco: string; apelido?: string | null; diaFechamento: number; diaVencimento: number; final?: string | null };

export async function listarCartoes(ctx: AuthContext): Promise<CartaoGravado[]> {
  return prisma.cartao.findMany({ where: { userId: ctx.userId, profileId: ctx.profileId }, orderBy: { createdAt: "asc" }, select: CAMPOS });
}

/** O cartão, só se for dela e do perfil aberto (id que chega do cliente). */
export async function cartaoDoPerfil(ctx: AuthContext, id: string | null | undefined): Promise<CartaoGravado | null> {
  if (!id) return null;
  return prisma.cartao.findFirst({ where: { id, userId: ctx.userId, profileId: ctx.profileId }, select: CAMPOS });
}

export async function criarCartao(ctx: AuthContext, dados: DadosDoCartao): Promise<CartaoGravado> {
  return prisma.cartao.create({
    data: { userId: ctx.userId, profileId: ctx.profileId, banco: dados.banco, apelido: dados.apelido?.trim() || null, diaFechamento: dados.diaFechamento, diaVencimento: dados.diaVencimento, final: dados.final ?? null },
    select: CAMPOS,
  });
}

export async function atualizarCartao(ctx: AuthContext, id: string, dados: Partial<DadosDoCartao>): Promise<boolean> {
  const r = await prisma.cartao.updateMany({
    where: { id, userId: ctx.userId, profileId: ctx.profileId },
    data: {
      ...(dados.banco !== undefined ? { banco: dados.banco } : {}),
      ...(dados.apelido !== undefined ? { apelido: dados.apelido?.trim() || null } : {}),
      ...(dados.diaFechamento !== undefined ? { diaFechamento: dados.diaFechamento } : {}),
      ...(dados.diaVencimento !== undefined ? { diaVencimento: dados.diaVencimento } : {}),
    },
  });
  return r.count > 0;
}

/** Apaga o cartão. Os lançamentos ficam (perdem só a ligação, onDelete SetNull) e continuam "no cartão". */
export async function apagarCartao(ctx: AuthContext, id: string): Promise<boolean> {
  const r = await prisma.cartao.deleteMany({ where: { id, userId: ctx.userId, profileId: ctx.profileId } });
  return r.count > 0;
}

/**
 * Os lançamentos ligados ao cartão perto de hoje: três meses para trás e um ano e pouco para a
 * frente (as parcelas projetadas). Só gasto; estorno entra negativo.
 */
export async function lancamentosDoCartao(ctx: AuthContext, cartaoId: string, hoje: Dia): Promise<LancamentoDoCartao[]> {
  const meses = Array.from({ length: 18 }, (_, i) => somarMesesAoMes(hoje.ano, hoje.mes, i - 3));
  const linhas = await prisma.monthlyEntry.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, cartaoId, category: "EXPENSE", OR: meses.map((m) => ({ year: m.ano, month: m.mes })) },
    select: { id: true, year: true, month: true, entryDate: true, amount: true, description: true, parentCategory: true, customCategory: { select: { name: true } } },
  });
  return linhas.map(({ parentCategory, customCategory, ...l }) => ({
    ...l,
    amount: Number(l.amount),
    rotulo: customCategory?.name ?? (parentCategory ? PARENT_CATEGORY_LABEL[parentCategory] : null),
  }));
}

export type CartaoComFaturas = CartaoGravado & { faturas: FaturasDoCartao | null };

/** Cada cartão do perfil com as faturas aberta, próxima e a fechada a pagar. */
export async function cartoesComFaturas(ctx: AuthContext, hoje: Dia): Promise<CartaoComFaturas[]> {
  const cartoes = await listarCartoes(ctx);
  return Promise.all(cartoes.map(async (c) => ({ ...c, faturas: faturasDoCartao(c, await lancamentosDoCartao(ctx, c.id, hoje), hoje) })));
}

/**
 * O cartão desta fatura importada: o do mesmo final (4 últimos dígitos), ou, sem final, o único
 * cartão do mesmo banco. Dois cartões do mesmo banco sem final para desempatar: nenhum (melhor
 * não ligar do que ligar no errado).
 */
export async function acharCartaoDaFatura(ctx: AuthContext, lido: { banco: string | null; final: string | null }): Promise<CartaoGravado | null> {
  const cartoes = await listarCartoes(ctx);
  if (cartoes.length === 0) return null;
  if (lido.final) {
    const peloFinal = cartoes.find((c) => c.final === lido.final);
    if (peloFinal) return peloFinal;
  }
  const slug = slugDoBancoLido(lido.banco);
  if (!slug) return null;
  const doBanco = cartoes.filter((c) => c.banco === slug);
  // Mesmo banco, um com outro final gravado: é outro cartão.
  const candidatos = lido.final ? doBanco.filter((c) => !c.final || c.final === lido.final) : doBanco;
  return candidatos.length === 1 ? candidatos[0] : null;
}

/**
 * Liga ao cartão as compras que um lote de fatura gravou no perfil dele (a linha mandada para a
 * Empresa fica sem cartão). Marca também `noCartao`, que já valia pelo lote, e guarda o final.
 */
export async function ligarLoteAoCartao(ctx: AuthContext, loteId: string, cartao: CartaoGravado, final: string | null): Promise<number> {
  const r = await prisma.monthlyEntry.updateMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, importBatchId: loteId, category: "EXPENSE", cartaoId: null, OR: [{ noCartao: null }, { noCartao: true }] },
    data: { cartaoId: cartao.id, noCartao: true },
  });
  if (final && !cartao.final) await prisma.cartao.updateMany({ where: { id: cartao.id, userId: ctx.userId, profileId: ctx.profileId }, data: { final } });
  return r.count;
}

/** Uma compra da fatura que o app já tinha de um envio de antes (a gravação pulou). */
export type CompraJaNoApp = { profileId: string; year: number; month: number; description: string; amount: number };

/**
 * Compra que veio de uma fatura enviada ANTES de o cartão ser cadastrado ficava sem cartão: fora do
 * total do cartão e da conferência, mesmo quando a pessoa reenviava a fatura (a gravação pula o
 * que já existe e só o lote novo era ligado). Liga também essas, só as de lote de fatura, sem
 * cartão, do mesmo mês, nome e valor.
 */
export async function ligarComprasJaNoAppAoCartao(ctx: AuthContext, cartao: CartaoGravado, compras: CompraJaNoApp[]): Promise<number> {
  let ligadas = 0;
  // O cartão é do perfil da sessão: a linha mandada para outro perfil (a Empresa) fica de fora.
  for (const c of compras.filter((x) => x.profileId === ctx.profileId)) {
    const r = await prisma.monthlyEntry.updateMany({
      where: {
        userId: ctx.userId, profileId: ctx.profileId,
        category: "EXPENSE",
        cartaoId: null,
        year: c.year,
        month: c.month,
        description: c.description,
        amount: c.amount,
        OR: [{ noCartao: null }, { noCartao: true }],
        importBatch: { is: { docType: "fatura" } },
      },
      data: { cartaoId: cartao.id, noCartao: true },
    });
    ligadas += r.count;
  }
  return ligadas;
}

/** O cartão ainda não tem os dias (nasceu sem eles) e a fatura importada traz: dá para oferecer. */
export function faltamDias(c: Pick<CartaoComDias, "diaFechamento" | "diaVencimento">): boolean {
  return !diasValidos(c);
}
