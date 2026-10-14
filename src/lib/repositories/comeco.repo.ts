import type { ParentCategory, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { doDono, type AuthContext } from "@/lib/auth/session";
import { MARCA_DO_TOUR_NA_CONTA_NOVA } from "@/lib/novidades/passos";
import { lerComeco, montarFunilDoComeco, NOMES_DOS_EVENTOS_DO_COMECO, type Comeco, type SinaisDosPassos } from "@/lib/onboarding/comeco";

/**
 * O começo da versão nova guardado na conta (User.comeco). É da PESSOA, não do perfil: as
 * respostas (apelido, renda, o que quer) valem para a conta dela.
 */
export async function lerComecoDaConta(userId: string): Promise<Comeco | null> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { comeco: true } });
  return lerComeco(u?.comeco ?? null);
}

export async function gravarComeco(userId: string, comeco: Comeco): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { comeco: comeco as unknown as Prisma.InputJsonValue } });
}

/**
 * O que os Primeiros passos olham nos dados, no perfil ativo: arquivo importado, orçamento com
 * valor, meta criada e algum aparelho com os avisos ligados (esse é da conta, não do perfil).
 */
export async function sinaisDosPrimeirosPassos(ctx: AuthContext): Promise<SinaisDosPassos> {
  const dono = doDono(ctx);
  const [importacao, orcamento, meta, aviso] = await Promise.all([
    prisma.importBatch.findFirst({ where: dono, select: { id: true } }),
    prisma.budget.findFirst({ where: { ...dono, plannedAmount: { gt: 0 } }, select: { id: true } }),
    prisma.goal.findFirst({ where: dono, select: { id: true } }),
    prisma.pushSubscription.findFirst({ where: { userId: ctx.userId }, select: { id: true } }),
  ]);
  return { temImportacao: !!importacao, temOrcamento: !!orcamento, temMeta: !!meta, temLembretes: !!aviso };
}

/** O lançamento mais novo do perfil ativo: o "Seu primeiro gasto está aqui" mostra ele. */
export async function ultimoLancamento(ctx: AuthContext): Promise<{ descricao: string | null; subcategoria: string | null; parentCategory: ParentCategory | null; valor: number } | null> {
  const e = await prisma.monthlyEntry.findFirst({
    where: doDono(ctx),
    orderBy: { createdAt: "desc" },
    select: { description: true, subcategory: true, parentCategory: true, amount: true },
  });
  return e ? { descricao: e.description, subcategoria: e.subcategory, parentCategory: e.parentCategory, valor: Number(e.amount) } : null;
}

/** Marca a conta como recebida só se ainda não estava: voltar ao começo pelo convite não mexe na data. */
export async function marcarRecebidaSeAinda(userId: string): Promise<void> {
  const agora = new Date();
  // Conta nova que termina o começo: o tour "Boas-vindas ao SPI" fica marcado como visto
  // ("novo-visto") e não abre sozinho (leva 1 do primeiro uso, 14/10/2026). Ele continua no Como
  // funciona. Nunca o "Tivemos uma mudança", que é de quem já usava (ver lib/novidades/passos.ts).
  await prisma.user.updateMany({ where: { id: userId, onboardedAt: null, novidadesVersaoNova: null }, data: { onboardedAt: agora, novidadesVersaoNova: MARCA_DO_TOUR_NA_CONTA_NOVA, novidadesVistasEm: agora } });
  await prisma.user.updateMany({ where: { id: userId, onboardedAt: null }, data: { onboardedAt: agora } });
}

/**
 * O funil do começo para o /admin/relatorio: quantas PESSOAS passaram por cada marca (uma pessoa
 * que voltou duas vezes conta uma). Só eventos do começo novo; começa do zero em 11/10/2026.
 */
export async function getFunilDoComeco(): Promise<{ rotulo: string; pessoas: number }[]> {
  const eventos = await prisma.usageEvent.findMany({
    where: { name: { in: [...NOMES_DOS_EVENTOS_DO_COMECO] } },
    select: { userId: true, name: true, path: true },
    distinct: ["userId", "name", "path"],
  });
  const pessoas = new Map<string, Set<string>>();
  const conta = (chave: string, userId: string) => {
    if (!pessoas.has(chave)) pessoas.set(chave, new Set());
    pessoas.get(chave)!.add(userId);
  };
  for (const e of eventos) {
    conta(e.name, e.userId);
    conta(`${e.name}:${e.path}`, e.userId);
  }
  return montarFunilDoComeco(Object.fromEntries([...pessoas].map(([k, v]) => [k, v.size])));
}
