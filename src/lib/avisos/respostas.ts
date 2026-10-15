import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { comFiltro, donoDoOrcamento, donosDasRespostasDoOrcamento, lancamentosDosTotais, type QuemLe } from "@/lib/casa/regras";
import { listBudgets, sumExpensesByCustomCategory, sumExpensesByParentCategory } from "@/lib/repositories/budget.repo";
import { chaveDaSemana } from "@/app/(app)/mensal/foco/ritmo";
import { registrarDecisaoUnica } from "@/lib/repositories/decisao.repo";
import type { ParentCategory } from "@prisma/client";
import { isParentCategoryKey } from "@/lib/categories";
import type { ComoResolveu, DadosDaResposta } from "./regra";
import type { RespostasDoMes, MesDoAviso } from "./perguntas";
import { juntarRespostas, planosQueSubiram, type GastoComHora } from "./juntar";

/**
 * Carrega de uma vez TODAS as respostas da pessoa no mês, de todas as telas: os avisos dispensados
 * (Foco, Decidir, Orçamento, Ritual), os tetos ("Segurar em", "não gastar mais nada"), as dispensas
 * do Resumo novo e o plano que ela subiu no mês. Junto vêm o gasto e o plano de cada categoria
 * AGORA, na mesma régua para todas as telas: a volta "se piorar bem" compara o mesmo número que
 * foi guardado na hora da resposta.
 *
 * Casal simples: o orçamento é da casa (donoDoOrcamento). As respostas sobre categoria do orçamento
 * valem para os dois; o resto (metas, reserva, Resumo) é de quem responde.
 */

const DIA_MS = 86_400_000;
const chaveDoMes = (m: MesDoAviso) => `${m.ano}-${String(m.mes).padStart(2, "0")}`;
/** Meia-noite do dia 1 em Brasília. */
const inicioDoMes = (m: MesDoAviso) => new Date(Date.UTC(m.ano, m.mes - 1, 1, 3));
const mesAnterior = (m: MesDoAviso): MesDoAviso => (m.mes === 1 ? { ano: m.ano - 1, mes: 12 } : { ano: m.ano, mes: m.mes - 1 });
const chaveDoBudget = (b: { customCategoryId: string | null; parentCategory: string | null }) => (b.customCategoryId ?? b.parentCategory ?? "") as string;

/** Gasto (≥ 0) e plano de cada categoria no mês: a régua de todas as telas. */
export async function medidasDoMes(ctx: QuemLe, m: MesDoAviso): Promise<{ gasto: Record<string, number>; plano: Record<string, number> }> {
  const [porMae, porPersonalizada, budgets] = await Promise.all([
    sumExpensesByParentCategory(ctx as AuthContext, m.ano, m.mes),
    sumExpensesByCustomCategory(ctx as AuthContext, m.ano, m.mes),
    listBudgets(ctx as AuthContext, m.ano, m.mes),
  ]);
  const gasto: Record<string, number> = {};
  for (const s of porMae) gasto[s.parentCategory] = Math.max(0, s.spent);
  for (const s of porPersonalizada) gasto[s.customCategoryId] = Math.max(0, s.spent);
  const plano: Record<string, number> = {};
  for (const b of budgets) plano[chaveDoBudget(b)] = Number(b.plannedAmount);
  return { gasto, plano };
}

/**
 * O que uma resposta nova a um aviso de categoria guarda, calculado no servidor (a tela não manda
 * número): o gasto da categoria agora e o tamanho do aviso (quanto passa do plano).
 */
export async function dadosDaRespostaDeCategoria(ctx: QuemLe, categoria: string, como: ComoResolveu, agora: Date, excesso?: number): Promise<DadosDaResposta & { passou: number }> {
  const { gasto, plano } = await medidasDoMes(ctx, { ano: agora.getFullYear(), mes: agora.getMonth() + 1 });
  const g = gasto[categoria] ?? 0;
  const passou = Math.round((g - (plano[categoria] ?? 0)) * 100) / 100;
  return { como, gasto: g, excesso: excesso ?? Math.max(0, passou), passou };
}

export async function carregarRespostasDoMes(ctx: QuemLe, m: MesDoAviso, agora: Date): Promise<RespostasDoMes> {
  const anoMes = chaveDoMes(m);
  const semana = chaveDaSemana(agora);
  const donos = donosDasRespostasDoOrcamento(ctx);
  const comeco = inicioDoMes(m);
  const dono = donoDoOrcamento(ctx);
  const anterior = mesAnterior(m);

  const [linhas, medidas, mexidos, planosAntes, ultimoLote] = await Promise.all([
    prisma.decisao.findMany({
      where: {
        OR: donos,
        AND: [
          {
            OR: [
              { tipo: "aviso_dispensado", chave: { startsWith: `${anoMes}|` } },
              { tipo: "aviso_dispensado", chave: { startsWith: `${semana}|` } },
              { tipo: "teto", chave: { startsWith: `${anoMes}|` } },
              { tipo: "sugestao_dispensada", createdAt: { gte: new Date(agora.getTime() - 90 * DIA_MS) } },
            ],
          },
        ],
      },
      select: { userId: true, profileId: true, tipo: true, chave: true, valor: true, descricao: true, dados: true, createdAt: true },
      take: 2000,
    }),
    medidasDoMes(ctx, m),
    // O plano que mudou DEPOIS de criado, dentro do mês (cobrir, lápis, Editar meu plano).
    prisma.budget.findMany({
      where: { ...dono, year: m.ano, month: m.mes, updatedAt: { gte: comeco } },
      select: { parentCategory: true, customCategoryId: true, plannedAmount: true, createdAt: true, updatedAt: true },
    }),
    prisma.budget.findMany({ where: { ...dono, year: anterior.ano, month: anterior.mes }, select: { parentCategory: true, customCategoryId: true, plannedAmount: true } }),
    prisma.importBatch.findFirst({ where: { userId: ctx.userId, profileId: ctx.profileId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);

  const planoAntes: Record<string, number> = Object.fromEntries(planosAntes.map((b) => [chaveDoBudget(b), Number(b.plannedAmount)]));
  const subiram = planosQueSubiram(
    mexidos.map((b) => ({ chave: chaveDoBudget(b), planejado: Number(b.plannedAmount), createdAt: b.createdAt, updatedAt: b.updatedAt })),
    planoAntes,
  );
  let gastosDosQueSubiram: GastoComHora[] = [];
  if (subiram.length > 0) {
    const chaves = subiram.map((b) => b.chave);
    const maes = chaves.filter(isParentCategoryKey) as ParentCategory[];
    const linhasDeGasto = await prisma.monthlyEntry.findMany({
      where: comFiltro(lancamentosDosTotais(ctx), {
        year: m.ano,
        month: m.mes,
        category: "EXPENSE",
        OR: [...(maes.length > 0 ? [{ parentCategory: { in: maes } }] : []), { customCategoryId: { in: chaves } }],
      }),
      select: { amount: true, createdAt: true, parentCategory: true, customCategoryId: true },
      take: 5000,
    });
    gastosDosQueSubiram = linhasDeGasto.map((g) => ({ chave: (g.customCategoryId ?? g.parentCategory ?? "") as string, valor: Number(g.amount), createdAt: g.createdAt }));
  }
  const { respostas, dispensas } = juntarRespostas({
    eu: { userId: ctx.userId, profileId: ctx.profileId },
    linhas: linhas.map((l) => ({ ...l, valor: l.valor === null ? null : Number(l.valor) })),
    comeco,
    subiram,
    gastosDosQueSubiram,
  });

  return { mes: m, respostas, dispensas, marca: ultimoLote?.createdAt.toISOString() ?? "sem-extrato", ...medidas };
}

/**
 * Ela subiu o plano da categoria neste mês (o lápis, o "Ajustar categorias"): é resposta aos avisos
 * da categoria, em todas as telas. Baixar o plano não responde nada (é a categoria de onde ela
 * tirou, ou um corte). Guarda o gasto da hora: piorou bem depois disso, o aviso volta.
 */
export async function registrarPlanoSubiu(ctx: AuthContext, categoria: string, agora: Date): Promise<void> {
  const anoMes = chaveDoMes({ ano: agora.getFullYear(), mes: agora.getMonth() + 1 });
  const dados = await dadosDaRespostaDeCategoria(ctx, categoria, "lapis", agora, 0);
  await registrarDecisaoUnica(ctx, { tipo: "aviso_dispensado", chave: `${anoMes}|plano-${categoria}`.slice(0, 190), dados: { como: "lapis", gasto: dados.gasto, excesso: 0 } });
}

export * from "./perguntas";
