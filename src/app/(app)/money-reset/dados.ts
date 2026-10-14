import type { ParentCategory } from "@prisma/client";
import type { AuthContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { doDono } from "@/lib/auth/session";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { categoryLabel, PARENT_CATEGORIES } from "@/lib/categories";
import { listEntriesForMonths } from "@/lib/repositories/monthly-entry.repo";
import { getMonthlyPlan } from "@/lib/repositories/monthly-plan.repo";
import { getEmergencyFund } from "@/lib/repositories/emergency-fund.repo";
import { listGoalsWithProgress } from "@/lib/repositories/goal.repo";
import { listarDecisoesRaioX } from "@/lib/repositories/decisao.repo";
import { listarDividas, selicAnual } from "@/lib/repositories/divida.repo";
import { descricaoDoCredor, saudeDe, SELIC_DE_RESERVA, type Saude } from "@/lib/dividas/saude";
import { getSavingsTargets } from "@/lib/planning/savings-targets";
import { splitSavings } from "@/lib/planning/savings-split";
import { courseShareOf } from "@/lib/planning/ideal-budget";
import { acharRecorrentes, type EscolhaDoRaioX } from "@/lib/decisoes/raio-x";
import { marcasQueMaisLevam, type GastoDeMarca } from "@/lib/money-reset/marcas-do-reset";
import { normalizarDescricao } from "@/lib/marcas/marca";
import { carregarFoco } from "@/app/(app)/mensal/foco/dados";
import { getOwnUser } from "@/lib/repositories/user.repo";
import { getRendaMedia } from "@/lib/repositories/renda-media.repo";
import { acharMetaDaReserva } from "@/lib/portfolio/reserva-da-pessoa";

/**
 * Os números de cada missão do Money Reset, com os dados DELA, e as marcas que ela paga (o logo
 * real, achado pela descrição do extrato). Só carrega o que a tela do marco usa. Sem dado, a tela
 * mostra o vazio honesto ou logos de exemplo, nunca um número inventado.
 */

function mesesAntes(ano: number, mes: number, n: number) {
  const out: { year: number; month: number }[] = [];
  for (let i = 1; i <= n; i++) {
    const d = new Date(ano, mes - 1 - i, 1);
    out.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  return out;
}

type Entrada = Awaited<ReturnType<typeof listEntriesForMonths>>[number];
type Meta = Awaited<ReturnType<typeof listGoalsWithProgress>>[number];

/**
 * A reserva para a missão 10 e o cartão final. A tela da Reserva saiu em 11/10: a reserva é a meta
 * do tipo Reserva de emergência; quem ainda tem a do simulador antigo fica com ela se não criou a meta.
 */
function reservaDaTela(f: Awaited<ReturnType<typeof getEmergencyFund>>, goals: Meta[]): { alvo: number; tem: number } | null {
  const meta = acharMetaDaReserva(goals.filter((g) => Number(g.targetAmount) > 0));
  if (meta) return { alvo: Number(meta.targetAmount), tem: meta.computedCurrentAmount };
  return f && Number(f.targetAmount) > 0 ? { alvo: Number(f.targetAmount), tem: Number(f.currentAmount) } : null;
}

/** O sonho (missões 11 e 21): a primeira meta com data que não seja a reserva. */
function sonhoDasMetas(goals: Meta[]): Meta | null {
  const reserva = acharMetaDaReserva(goals);
  const sonhos = goals.filter((g) => g.id !== reserva?.id);
  return sonhos.find((x) => x.targetDate) ?? sonhos[0] ?? null;
}

/** Os meses que TÊM lançamento (quem chegou há 2 meses não divide por 3). */
const mesesCom = (entradas: Entrada[]) => new Set(entradas.map((e) => e.year * 12 + e.month)).size;

function media(entradas: Entrada[], filtro: (e: Entrada) => boolean) {
  const meses = mesesCom(entradas);
  if (meses === 0) return { valor: 0, meses: 0 };
  const total = entradas.filter(filtro).reduce((s, e) => s + Number(e.amount), 0);
  return { valor: total / meses, meses };
}

/**
 * Quanto entra por mês: a média dos últimos 12 meses fechados com entrada (a regra do app
 * inteiro, renda-media.ts). Só quem ainda não tem nenhum mês fechado com entrada fica com a
 * conta das entradas que a missão já leu (o mês corrente, para quem acabou de subir o extrato).
 */
async function quantoEntra(ctx: AuthContext, e: Entrada[]): Promise<{ valor: number; meses: number }> {
  const r = await getRendaMedia(ctx);
  if (r) return r;
  return media(e, (x) => x.category === "INCOME");
}

const gastos = (e: Entrada[]) => e.filter((x) => x.category === "EXPENSE");
const comMarca = (e: Entrada[]) => gastos(e).map((x) => ({ description: x.description, amount: Number(x.amount), year: x.year, month: x.month, parentCategory: x.parentCategory }));

/** Onde nunca se põe teto (regra do remanejo por prioridade). */
const INTOCAVEIS = new Set<ParentCategory>(["MORADIA", "SAUDE", "EDUCACAO", "IMPOSTOS"]);

/** Hábitos que dá para cortar pela metade (os pedidos, as corridas): entram no Raio-X da missão 3. */
const HABITOS_DE_APP = new Set(["ifood", "uber eats", "99 food", "rappi", "uber", "99 app"]);

export type ItemDoRaioX = { chave: string; nome: string; mensal: number; anual: number; meses: number; tipo: "assinatura" | "habito"; vezesPorMes: number };

export type DadosDoMarco =
  | { n: 1; meses: number; entra: number; entraMeses: number; sai: number; marcas: GastoDeMarca[] }
  | { n: 2; fatura: { total: number; marcas: GastoDeMarca[]; quando: string } | null; parcelasFuturas: number }
  | { n: 3; itens: ItemDoRaioX[]; decididos: Record<string, EscolhaDoRaioX> }
  | { n: 4; fixas: { chave: string; nome: string; mensal: number }[]; parcelas: number }
  | { n: 5; categorias: { cat: ParentCategory; nome: string; voce: number; regua: number; valor: number }[]; renda: number; pior: ParentCategory | null; marcasDaPior: GastoDeMarca[] }
  | { n: 7; sai: number; pctDaRenda: number | null; fixas: number | null; marcas: GastoDeMarca[] }
  | { n: 9; guardar: number | null; renda: number | null }
  | { n: 10; reserva: { alvo: number; tem: number } | null }
  | { n: 11; sonho: { nome: string; valor: number; data: string | null } | null }
  | { n: 12; guardar: number | null; fatias: { nome: string; tipo: string; valor: number }[]; sobra: number }
  | { n: 13; dividas: { id: string; credor: string; nome: string; tipo: string; porMes: number; saldo: number; saude: Saude }[] }
  | { n: 14; proximaFatura: number }
  | { n: 15; livreSemana: number | null; ritmo: string | null }
  | { n: 17; marcas: GastoDeMarca[] }
  | { n: 20; semana: number; mediaSemana: number; marcas: GastoDeMarca[] }
  | { n: 21; livreSemana: number | null; guardar: number | null; reserva: number | null; reservaTem: number; sonho: { nome: string; data: string | null } | null; ritmo: string | null; fechouMes: boolean; temOrcamento: boolean }
  | { n: number };

export async function carregarDadosDoMarco(ctx: AuthContext, n: number, extras: { fixasTotal?: number } = {}): Promise<DadosDoMarco> {
  const agora = nowInBrazil();
  const ano = agora.getFullYear();
  const mes = agora.getMonth() + 1;
  const tres = () => listEntriesForMonths(ctx, mesesAntes(ano, mes, 3));
  const plano = () => getMonthlyPlan(ctx, ano, mes);
  const dono = doDono(ctx);

  switch (n) {
    case 1: {
      // O mês corrente entra também: quem acabou de subir o extrato de outubro já vê o retrato.
      let e = await tres();
      if (e.length === 0) e = await listEntriesForMonths(ctx, [{ year: ano, month: mes }]);
      const meses = mesesCom(e);
      const entra = await quantoEntra(ctx, e);
      return { n: 1, meses, entra: entra.valor, entraMeses: entra.meses, sai: media(e, (x) => x.category === "EXPENSE").valor, marcas: marcasQueMaisLevam(comMarca(e), meses, 5) };
    }
    case 2: {
      const lote = await prisma.importBatch.findFirst({ where: { ...dono, docType: "fatura" }, orderBy: { createdAt: "desc" }, select: { id: true, createdAt: true } });
      const prox = new Date(ano, mes, 1);
      const parcelas = await prisma.monthlyEntry.count({ where: { ...dono, year: prox.getFullYear(), month: prox.getMonth() + 1, category: "EXPENSE", importBatchId: { not: null } } });
      if (!lote) return { n: 2, fatura: null, parcelasFuturas: parcelas };
      const linhas = await prisma.monthlyEntry.findMany({ where: { ...dono, importBatchId: lote.id, category: "EXPENSE" }, select: { description: true, amount: true, year: true, month: true, parentCategory: true } });
      const meses = new Set(linhas.map((l) => l.year * 12 + l.month));
      // A fatura é um mês só (o que caiu nela); as parcelas futuras ficam de fora do total.
      const mesDaFatura = meses.size ? Math.min(...meses) : 0;
      const doMes = linhas.filter((l) => l.year * 12 + l.month === mesDaFatura);
      const total = doMes.reduce((s, l) => s + Number(l.amount), 0);
      const marcas = marcasQueMaisLevam(doMes.map((l) => ({ ...l, amount: Number(l.amount) })), 1, 5);
      return { n: 2, fatura: { total, marcas, quando: lote.createdAt.toISOString().slice(0, 10) }, parcelasFuturas: parcelas };
    }
    case 3: {
      const [e, decididos] = await Promise.all([listEntriesForMonths(ctx, mesesAntes(ano, mes, 5)), listarDecisoesRaioX(ctx)]);
      const itens = acharRecorrentes(gastos(e).map((x) => ({ description: x.description, amount: Number(x.amount), year: x.year, month: x.month, parentCategory: x.parentCategory, subcategory: x.subcategory })), 12)
        .filter((i) => i.tipo === "assinatura" || HABITOS_DE_APP.has(i.chave))
        .slice(0, 6);
      const escolhas = Object.fromEntries([...decididos.entries()].filter(([k]) => itens.some((i) => i.chave === k)).map(([k, v]) => [k, v.tipo as EscolhaDoRaioX]));
      return { n: 3, itens, decididos: escolhas };
    }
    case 4: {
      const [e, decididos] = await Promise.all([listEntriesForMonths(ctx, mesesAntes(ano, mes, 4)), listarDecisoesRaioX(ctx)]);
      // O que ela mandou cortar no Raio-X (missão 3) não volta como conta fixa.
      const cortadas = new Set([...decididos.entries()].filter(([, v]) => v.tipo === "raiox_cancelar").map(([k]) => k));
      const itens = acharRecorrentes(
        gastos(e).map((x) => ({ description: x.description, amount: Number(x.amount), year: x.year, month: x.month, parentCategory: x.parentCategory, subcategory: x.subcategory })),
        30,
        { essenciais: true },
      ).filter((i) => i.tipo === "assinatura" && !cortadas.has(i.chave));
      // Parcelas que já caem no mês que vem (a fatura importada lança as próximas sozinha).
      const prox = new Date(ano, mes, 1);
      const [parcelas, contas] = await Promise.all([
        prisma.monthlyEntry.aggregate({ where: { ...dono, year: prox.getFullYear(), month: prox.getMonth() + 1, category: "EXPENSE", importBatchId: { not: null } }, _sum: { amount: true } }),
        // As contas que ela já cadastrou em Recorrentes (aluguel, luz, internet), todo mês e com valor.
        prisma.contaAPagar.findMany({ where: { ...dono, repete: true, quitada: false, valor: { not: null }, OR: [{ intervalo: null }, { intervalo: 1, unidade: "meses" }] }, select: { id: true, nome: true, valor: true } }),
      ]);
      const doRaioX = itens.map((i) => ({ chave: i.chave, nome: i.nome, mensal: i.mensal }));
      const jaTem = new Set(doRaioX.map((f) => normalizarDescricao(f.nome)));
      const cadastradas = contas.filter((c) => !jaTem.has(normalizarDescricao(c.nome))).map((c) => ({ chave: `conta:${c.id}`, nome: c.nome, mensal: Number(c.valor) }));
      const fixas = [...cadastradas, ...doRaioX].sort((a, b) => b.mensal - a.mensal);
      return { n: 4, fixas, parcelas: Number(parcelas._sum.amount ?? 0) };
    }
    case 5: {
      const e = await tres();
      const renda = (await quantoEntra(ctx, e)).valor;
      const categorias = PARENT_CATEGORIES.filter((c) => courseShareOf(c, ctx.profileKind) > 0)
        .map((cat) => {
          const valor = media(e, (x) => x.category === "EXPENSE" && x.parentCategory === cat).valor;
          return { cat, nome: categoryLabel(ctx.categorias ?? ctx.profileKind, cat), voce: renda > 0 ? valor / renda : 0, regua: courseShareOf(cat, ctx.profileKind), valor };
        })
        .sort((a, b) => b.voce - b.regua - (a.voce - a.regua));
      // Regra do remanejo da Dani: Moradia, Saúde e Educação nunca levam teto (e imposto não se corta).
      const pior = categorias.find((c) => c.voce > c.regua && !INTOCAVEIS.has(c.cat));
      const marcasDaPior = pior ? marcasQueMaisLevam(comMarca(e.filter((x) => x.parentCategory === pior.cat)), mesesCom(e), 4) : [];
      return { n: 5, categorias, renda, pior: pior?.cat ?? null, marcasDaPior };
    }
    case 7: {
      const e = await tres();
      const sai = media(e, (x) => x.category === "EXPENSE").valor;
      const entra = (await quantoEntra(ctx, e)).valor;
      return { n: 7, sai, pctDaRenda: entra > 0 ? sai / entra : null, fixas: extras.fixasTotal ?? null, marcas: marcasQueMaisLevam(comMarca(e), mesesCom(e), 4) };
    }
    case 9: {
      const p = await plano();
      return { n: 9, guardar: p && p.plannedInvestment > 0 ? p.plannedInvestment : null, renda: p?.plannedIncome ?? null };
    }
    case 10: {
      const [f, goals] = await Promise.all([getEmergencyFund(ctx), listGoalsWithProgress(ctx)]);
      return { n: 10, reserva: reservaDaTela(f, goals) };
    }
    case 11: {
      const g = sonhoDasMetas(await listGoalsWithProgress(ctx));
      return { n: 11, sonho: g ? { nome: g.name, valor: Number(g.targetAmount), data: g.targetDate ? g.targetDate.toISOString().slice(0, 10) : null } : null };
    }
    case 12: {
      const [p, alvos] = await Promise.all([plano(), getSavingsTargets(ctx)]);
      const guardar = p && p.plannedInvestment > 0 ? p.plannedInvestment : null;
      const { slices, leftover } = splitSavings(guardar ?? 0, alvos);
      return { n: 12, guardar, fatias: slices.map((s) => ({ nome: s.name, tipo: s.kind, valor: s.amount })), sobra: leftover };
    }
    case 13: {
      const [dividas, selic] = await Promise.all([listarDividas(ctx), selicAnual(ctx.userId)]);
      return {
        n: 13,
        dividas: dividas.map((d) => ({ id: d.id, credor: descricaoDoCredor(d.credor), nome: d.apelido ? `${d.credor} · ${d.apelido}` : d.credor, tipo: d.tipo, porMes: Number(d.porMes), saldo: Number(d.saldo), saude: saudeDe(d, selic ?? SELIC_DE_RESERVA) })),
      };
    }
    case 14: {
      const prox = new Date(ano, mes, 1);
      const r = await prisma.monthlyEntry.aggregate({ where: { ...dono, year: prox.getFullYear(), month: prox.getMonth() + 1, category: "EXPENSE" }, _sum: { amount: true } });
      return { n: 14, proximaFatura: Number(r._sum.amount ?? 0) };
    }
    case 15: {
      const [foco, user] = await Promise.all([carregarFoco(ctx), getOwnUser(ctx)]);
      const l = foco.foco.livre;
      return { n: 15, livreSemana: l.tipo === "semana" || l.tipo === "mes" ? l.porSemana : null, ritmo: user.ritmoAcompanhamento ?? null };
    }
    case 17: {
      // O "hoje não": as marcas de delivery e compra que ela mais usa (para o desafio ter cara).
      const e = await tres();
      const marcas = marcasQueMaisLevam(comMarca(e.filter((x) => x.parentCategory === "LAZER" || x.parentCategory === "OUTROS" || x.parentCategory === "ALIMENTACAO")), mesesCom(e), 8);
      return { n: 17, marcas: marcas.filter((m) => m.parentCategory !== "MORADIA").slice(0, 4) };
    }
    case 20: {
      const desde = new Date(Date.now() - 7 * 86_400_000);
      const [semana, e, daSemana] = await Promise.all([
        prisma.monthlyEntry.aggregate({ where: { ...dono, category: "EXPENSE", entryDate: { gte: desde } }, _sum: { amount: true } }),
        tres(),
        prisma.monthlyEntry.findMany({ where: { ...dono, category: "EXPENSE", entryDate: { gte: desde } }, select: { description: true, amount: true, year: true, month: true, parentCategory: true } }),
      ]);
      const mediaMes = media(e, (x) => x.category === "EXPENSE").valor;
      return { n: 20, semana: Number(semana._sum.amount ?? 0), mediaSemana: mediaMes / 4.33, marcas: marcasQueMaisLevam(daSemana.map((l) => ({ ...l, amount: Number(l.amount) })), 1, 4) };
    }
    case 21: {
      const [foco, p, fund, goals, user, fechou, orcamento] = await Promise.all([
        carregarFoco(ctx),
        plano(),
        getEmergencyFund(ctx),
        listGoalsWithProgress(ctx),
        getOwnUser(ctx),
        prisma.decisao.count({ where: { ...dono, tipo: "fechamento" } }),
        prisma.budget.count({ where: { ...dono, year: ano, month: mes, plannedAmount: { gt: 0 } } }),
      ]);
      const l = foco.foco.livre;
      const sonho = sonhoDasMetas(goals);
      const reserva = reservaDaTela(fund, goals);
      return {
        n: 21,
        livreSemana: l.tipo === "semana" || l.tipo === "mes" ? l.porSemana : null,
        guardar: p && p.plannedInvestment > 0 ? p.plannedInvestment : null,
        reserva: reserva?.alvo ?? null,
        reservaTem: reserva?.tem ?? 0,
        sonho: sonho ? { nome: sonho.name, data: sonho.targetDate ? sonho.targetDate.toISOString().slice(0, 10) : null } : null,
        ritmo: user.ritmoAcompanhamento ?? null,
        fechouMes: fechou > 0,
        temOrcamento: orcamento > 0,
      };
    }
    default:
      return { n };
  }
}
