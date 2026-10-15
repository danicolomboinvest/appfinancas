import type { ParentCategory, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { doDono, type AuthContext } from "@/lib/auth/session";
import { installmentDescription } from "@/lib/entries/recurrence";
import { listarLancamentosParcelaveis } from "@/lib/repositories/monthly-entry.repo";
import {
  PREFIXO_COMPRA_APAGADA,
  PREFIXO_NAO_PARCELA,
  acharParcela,
  parcelasDoMes,
  chaveCompraApagada,
  chaveNaoParcela,
  doIndice,
  indice,
  type ContaParcelada,
  type Mes,
  type ParcelaParaMudar,
  type ParcelasDoMes,
} from "@/lib/contas/parcelas-do-mes";

/**
 * Mudar uma parcela pelo menu "…" de Recorrentes (13/10/2026). A Dani: "se você colocar alguma
 * parcela ali, deveria ter uma opção de editar, arrastar para o lado, excluir".
 *
 * - Editar: valor da parcela, "parcela N de T", dia e categoria. Muda este mês e os seguintes
 *   (cria os que faltam, apaga os que passaram do novo fim); dos meses passados só o "N/T" do nome,
 *   para a compra continuar uma série só.
 * - Apagar esta compra: este mês e os projetados; os passados só com "apagar também as que já
 *   passaram". A conta parcelada cadastrada que é a mesma compra vai junto. Ficou passado: a compra
 *   é lembrada (ContaRecusada) para não voltar como prevista.
 * - Não é parcela: a série é recusada (ContaRecusada, como o "Não é assinatura") e os meses
 *   projetados somem. O deste mês e os passados viram gasto comum.
 *
 * Tudo preso a quem olha (userId + perfil): no Casal, a parcela do outro aparece mas não é achada
 * aqui. Cada mudança devolve o que o "Desfazer" precisa para voltar (ver desfazerMudancaDaParcela).
 */

/** O que voltar no Desfazer: o que foi criado some, o que mudou ou sumiu volta como era. */
export type MudancaDaParcela = {
  criados: string[];
  lancamentos: Record<string, unknown>[];
  contas: Record<string, unknown>[];
  recusas: string[];
};

export async function listarRecusasDeParcela(ctx: AuthContext): Promise<Set<string>> {
  const linhas = await prisma.contaRecusada.findMany({
    where: { ...doDono(ctx), OR: [{ chave: { startsWith: PREFIXO_NAO_PARCELA } }, { chave: { startsWith: PREFIXO_COMPRA_APAGADA } }] },
    select: { chave: true },
  });
  return new Set(linhas.map((l) => l.chave));
}

async function contasParceladas(ctx: AuthContext): Promise<ContaParcelada[]> {
  const contas = await prisma.contaAPagar.findMany({
    where: { ...doDono(ctx), quitada: false, parcelas: { gt: 1 } },
    select: { id: true, nome: true, valor: true, parcelas: true, parcelaAtual: true, categoria: true, diaDoMes: true },
  });
  return contas.map((c) => ({ id: c.id, nome: c.nome, valor: c.valor == null ? null : Number(c.valor), parcelas: c.parcelas, parcelaAtual: c.parcelaAtual, categoria: c.categoria, diaDoMes: c.diaDoMes }));
}

/** A parcela da chave, só com os dados de quem olha. */
export async function lerParcelaParaMudar(ctx: AuthContext, mes: Mes, chave: string): Promise<ParcelaParaMudar | null> {
  const [lancamentos, contas, recusas] = await Promise.all([
    listarLancamentosParcelaveis(ctx, mes, { soMeus: true, mesesParaFrente: 48 }),
    contasParceladas(ctx),
    listarRecusasDeParcela(ctx),
  ]);
  return acharParcela(lancamentos, mes, contas, recusas, chave);
}

/**
 * As parcelas de um mês (este ou um dos próximos) para as telas que só precisam do número ou da
 * lista: o Decidir ("Posso comprar?", a regra dos 15% da renda) e o Money Reset (missões 2 e 4).
 * A conta é a de sempre (parcelasDoMes): as lançadas, as previstas que ainda não chegaram e as
 * contas parceladas de Recorrentes, sem as recusadas no "Não é parcela" e, no Casal, com as
 * parcelas visíveis do outro (listarLancamentosParcelaveis usa o filtro dos totais).
 *
 * Os dados são os mesmos da Previsão (contas não quitadas com mais de uma parcela, com o
 * vencimento, que faz a parcela andar nos meses seguintes). Antes, o Decidir lia só os gastos
 * dela com "/" deste mês e do passado (sem recusa e sem o Casal) e o Money Reset somava qualquer
 * gasto importado do mês seguinte como parcela.
 */
export async function carregarParcelasDoMes(ctx: AuthContext, mes: Mes): Promise<ParcelasDoMes> {
  const [lancamentos, recusas, contas] = await Promise.all([
    listarLancamentosParcelaveis(ctx, mes),
    listarRecusasDeParcela(ctx),
    prisma.contaAPagar.findMany({
      where: { ...doDono(ctx), quitada: false, parcelas: { gt: 1 } },
      select: { id: true, nome: true, valor: true, parcelas: true, parcelaAtual: true, categoria: true, diaDoMes: true, vencimento: true },
      take: 300,
    }),
  ]);
  const parceladas: ContaParcelada[] = contas.map((c) => ({
    id: c.id,
    nome: c.nome,
    valor: c.valor == null ? null : Number(c.valor),
    parcelas: c.parcelas,
    parcelaAtual: c.parcelaAtual,
    categoria: (c.categoria as string | null) ?? null,
    diaDoMes: c.diaDoMes,
    vencimento: c.vencimento.toISOString().slice(0, 10),
  }));
  return parcelasDoMes(lancamentos, mes, parceladas, recusas);
}

// O recibo é JSON: Decimal e Date viram marcas e voltam do mesmo jeito.
function guardar(linha: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(linha)) {
    if (v instanceof Date) r[k] = { $t: v.toISOString() };
    else if (v !== null && typeof v === "object" && typeof (v as { toFixed?: unknown }).toFixed === "function") r[k] = { $d: String(v) };
    else r[k] = v;
  }
  return r;
}

function voltar(linha: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(linha)) {
    if (v !== null && typeof v === "object" && "$t" in v) r[k] = new Date(String((v as { $t: string }).$t));
    else if (v !== null && typeof v === "object" && "$d" in v) r[k] = String((v as { $d: string }).$d);
    else r[k] = v;
  }
  return r;
}

const dataDoDia = (m: Mes, dia: number) => {
  const ultimo = new Date(Date.UTC(m.year, m.month, 0)).getUTCDate();
  return new Date(Date.UTC(m.year, m.month - 1, Math.min(dia, ultimo), 12));
};

async function recusar(ctx: AuthContext, chave: string, nome: string, valor: number, mudanca: MudancaDaParcela) {
  const ja = await prisma.contaRecusada.findFirst({ where: { ...doDono(ctx), chave }, select: { id: true } });
  if (ja) return;
  await prisma.contaRecusada.create({ data: { ...doDono(ctx), chave, nome: nome.slice(0, 80), valor } });
  mudanca.recusas.push(chave);
}

/** Apaga os lançamentos (só os de quem olha) guardando como eram. */
async function apagarLancamentos(ctx: AuthContext, ids: string[], mudanca: MudancaDaParcela) {
  if (ids.length === 0) return;
  const linhas = await prisma.monthlyEntry.findMany({ where: { ...doDono(ctx), id: { in: ids }, goalId: null } });
  if (linhas.length === 0) return;
  mudanca.lancamentos.push(...linhas.map((l) => guardar(l as unknown as Record<string, unknown>)));
  await prisma.monthlyEntry.deleteMany({ where: { ...doDono(ctx), id: { in: linhas.map((l) => l.id) } } });
}

async function apagarContas(ctx: AuthContext, ids: string[], mudanca: MudancaDaParcela) {
  if (ids.length === 0) return;
  const contas = await prisma.contaAPagar.findMany({ where: { ...doDono(ctx), id: { in: ids } } });
  mudanca.contas.push(...contas.map((c) => guardar(c as unknown as Record<string, unknown>)));
  await prisma.contaAPagar.deleteMany({ where: { ...doDono(ctx), id: { in: contas.map((c) => c.id) } } });
}

const vazia = (): MudancaDaParcela => ({ criados: [], lancamentos: [], contas: [], recusas: [] });

export type EdicaoDaParcela = {
  valor: number;
  /** A parcela deste mês (1 a total). */
  atual: number;
  total: number;
  /** Dia do mês, ou null para não mexer. */
  dia: number | null;
  /** Categoria-mãe, ou null para não mexer. */
  categoria: ParentCategory | null;
};

export async function editarParcela(ctx: AuthContext, mes: Mes, chave: string, e: EdicaoDaParcela): Promise<MudancaDaParcela | null> {
  const p = await lerParcelaParaMudar(ctx, mes, chave);
  if (!p) return null;
  const mudanca = vazia();

  if (p.tipo === "conta") {
    const conta = await prisma.contaAPagar.findFirst({ where: { ...doDono(ctx), id: p.contaId } });
    if (!conta) return null;
    mudanca.contas.push(guardar(conta as unknown as Record<string, unknown>));
    const venc = conta.vencimento;
    await prisma.contaAPagar.updateMany({
      where: { ...doDono(ctx), id: conta.id },
      data: {
        valor: e.valor,
        valorEhTotal: false,
        parcelas: e.total,
        parcelaAtual: e.atual,
        editadaPelaPessoa: true,
        ...(e.dia ? { diaDoMes: e.dia, vencimento: dataDoDia({ year: venc.getUTCFullYear(), month: venc.getUTCMonth() + 1 }, e.dia) } : {}),
        ...(e.categoria ? { categoria: e.categoria } : {}),
      },
    });
    return mudanca;
  }

  const alvo = indice(mes);
  const linhas = await prisma.monthlyEntry.findMany({ where: { ...doDono(ctx), id: { in: p.compra.map((l) => l.id) } } });
  const porId = new Map(linhas.map((l) => [l.id, l]));
  const compra = p.compra.filter((l) => porId.has(l.id));
  if (compra.length === 0) return null;
  mudanca.lancamentos.push(...linhas.map((l) => guardar(l as unknown as Record<string, unknown>)));

  // A parcela de cada mês a partir deste: atual, atual + 1… até o total.
  const nDoMes = (m: number) => e.atual + (m - alvo);
  const desejados = new Set<number>();
  for (let n = e.atual; n <= e.total; n += 1) desejados.add(alvo + (n - e.atual));
  const usados = new Set<number>();
  const apagar: string[] = [];
  const dia = p.item.confiante ? e.dia : null;
  const categoria = e.categoria ? { parentCategory: e.categoria, customCategoryId: null } : {};

  for (const l of compra) {
    const linha = porId.get(l.id)!;
    const descricao = linha.description ?? l.nome;
    if (l.mes < alvo) {
      // Passado: o valor pago fica; só o "N/T" acompanha, para a compra seguir uma série só.
      const n = nDoMes(l.mes) >= 1 ? nDoMes(l.mes) : l.atual;
      const nova = installmentDescription(descricao, Math.min(n, e.total), e.total);
      if (nova !== descricao) await prisma.monthlyEntry.updateMany({ where: { ...doDono(ctx), id: l.id }, data: { description: nova } });
      continue;
    }
    if (!desejados.has(l.mes) || usados.has(l.mes)) {
      // Passou do novo fim. (A segunda do mesmo mês é outra compra igual: fica como está.)
      if (!desejados.has(l.mes)) apagar.push(l.id);
      continue;
    }
    usados.add(l.mes);
    await prisma.monthlyEntry.updateMany({
      where: { ...doDono(ctx), id: l.id },
      data: {
        amount: e.valor,
        description: installmentDescription(descricao, nDoMes(l.mes), e.total),
        ...categoria,
        ...(dia ? { entryDate: dataDoDia(doIndice(l.mes), dia) } : {}),
      },
    });
  }
  if (apagar.length > 0) {
    await prisma.monthlyEntry.deleteMany({ where: { ...doDono(ctx), id: { in: apagar } } });
  }

  // Os meses que faltam (a prevista deste mês, ou um total maior): copiados do mais recente.
  const modelo = porId.get([...compra].sort((a, b) => b.mes - a.mes)[0].id)!;
  const diaDoModelo = dia ?? (modelo.entryDate ? modelo.entryDate.getUTCDate() : null);
  for (const m of [...desejados].sort((a, b) => a - b)) {
    if (usados.has(m)) continue;
    const doMes = doIndice(m);
    const criado = await prisma.monthlyEntry.create({
      data: {
        userId: modelo.userId,
        profileId: modelo.profileId,
        year: doMes.year,
        month: doMes.month,
        category: modelo.category,
        parentCategory: e.categoria ?? modelo.parentCategory,
        customCategoryId: e.categoria ? null : modelo.customCategoryId,
        subcategory: e.categoria ? null : modelo.subcategory,
        description: installmentDescription(modelo.description ?? p.item.nome, nDoMes(m), e.total),
        amount: e.valor,
        entryDate: diaDoModelo && p.item.confiante ? dataDoDia(doMes, diaDoModelo) : null,
        importBatchId: modelo.importBatchId,
        pessoa: modelo.pessoa,
        doCasal: modelo.doCasal,
        noCartao: modelo.noCartao,
        autorUserId: modelo.autorUserId,
        soMeu: modelo.soMeu,
      },
      select: { id: true },
    });
    mudanca.criados.push(criado.id);
  }
  return mudanca;
}

export async function apagarCompraParcelada(ctx: AuthContext, mes: Mes, chave: string, tambemAsQuePassaram: boolean): Promise<MudancaDaParcela | null> {
  const p = await lerParcelaParaMudar(ctx, mes, chave);
  if (!p) return null;
  const mudanca = vazia();
  if (p.tipo === "conta") {
    await apagarContas(ctx, [p.contaId], mudanca);
    return mudanca.contas.length > 0 ? mudanca : null;
  }
  const alvo = indice(mes);
  const ids = p.compra.filter((l) => tambemAsQuePassaram || l.mes >= alvo).map((l) => l.id);
  await apagarLancamentos(ctx, ids, mudanca);
  await apagarContas(ctx, p.contas, mudanca);
  // Ficaram parcelas passadas: a compra não volta como prevista por elas.
  if (p.compra.some((l) => !ids.includes(l.id))) await recusar(ctx, chaveCompraApagada(p.item.serie, p.origem), p.item.nome, p.item.valor, mudanca);
  return mudanca;
}

export async function naoEParcela(ctx: AuthContext, mes: Mes, chave: string): Promise<MudancaDaParcela | null> {
  const p = await lerParcelaParaMudar(ctx, mes, chave);
  if (!p || p.tipo !== "fatura") return null;
  const mudanca = vazia();
  const alvo = indice(mes);
  await recusar(ctx, chaveNaoParcela(p.item.serie), p.item.nome, p.item.valor, mudanca);
  // As projetadas (meses depois deste) somem; o deste mês e os passados viram gasto comum.
  await apagarLancamentos(ctx, p.compra.filter((l) => l.mes > alvo).map((l) => l.id), mudanca);
  return mudanca;
}

/** O "Desfazer": tira o que foi criado, volta o que mudou ou sumiu, esquece a recusa. */
export async function desfazerMudancaDaParcela(ctx: AuthContext, m: MudancaDaParcela): Promise<void> {
  const dono = doDono(ctx);
  const doDonoDaLinha = (l: Record<string, unknown>) => l.userId === dono.userId && l.profileId === dono.profileId && typeof l.id === "string";
  if (m.criados.length > 0) await prisma.monthlyEntry.deleteMany({ where: { ...dono, id: { in: m.criados } } });
  for (const salvo of m.lancamentos.map(voltar).filter(doDonoDaLinha)) {
    const { id, userId: _u, profileId: _p, createdAt: _c, ...resto } = salvo;
    void _u;
    void _p;
    void _c;
    const r = await prisma.monthlyEntry.updateMany({ where: { ...dono, id: id as string }, data: resto as Prisma.MonthlyEntryUncheckedUpdateManyInput });
    if (r.count === 0) await prisma.monthlyEntry.create({ data: salvo as unknown as Prisma.MonthlyEntryUncheckedCreateInput });
  }
  for (const salvo of m.contas.map(voltar).filter(doDonoDaLinha)) {
    const { id, userId: _u, profileId: _p, createdAt: _c, updatedAt: _a, ...resto } = salvo;
    void _u;
    void _p;
    void _c;
    void _a;
    const r = await prisma.contaAPagar.updateMany({ where: { ...dono, id: id as string }, data: resto as Prisma.ContaAPagarUncheckedUpdateManyInput });
    if (r.count === 0) await prisma.contaAPagar.create({ data: salvo as unknown as Prisma.ContaAPagarUncheckedCreateInput });
  }
  if (m.recusas.length > 0) await prisma.contaRecusada.deleteMany({ where: { ...dono, chave: { in: m.recusas } } });
}
