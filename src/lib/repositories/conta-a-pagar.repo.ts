import { prisma } from "@/lib/db/prisma";
import { doDono, type AuthContext } from "@/lib/auth/session";
import { type ContaParaRegra } from "@/lib/contas/contas";
import { depoisDePagarComRegra, regraDaConta } from "@/lib/contas/frequencia";
import { casaAtiva, daCasaAutomatico } from "@/lib/casa/regras";
import { contaVaria, origemPadrao, origensDoPaguei, tipoDaOrigem, valoresDeAntes, type OrigemDoPaguei } from "@/lib/contas/paguei";
import { categoriaDoPaguei } from "@/lib/contas/paguei-categoria";

/** Os campos da frequência livre (seção 3.17). Opcionais: quem chama sem eles grava como antes. */
export type CamposDeFrequencia = {
  intervalo?: number | null;
  unidade?: string | null;
  mesesEscolhidos?: number[];
  parcelas?: number | null;
  parcelaAtual?: number | null;
  valorEhTotal?: boolean;
  aproximado?: boolean;
};

export type ContaAPagarInput = {
  nome: string;
  /** null = o valor muda todo mês (contas de antes). A aproximada guarda a estimativa aqui. */
  valor: number | null;
  vencimento: Date;
  repete: boolean;
  lembrar: boolean;
} & CamposDeFrequencia;

export type ContaDaTela = ContaParaRegra & {
  pagaEm: Date | null;
  diaDoMes: number | null;
  intervalo: number | null;
  unidade: string | null;
  mesesEscolhidos: number[];
  parcelas: number | null;
  parcelaAtual: number | null;
  valorEhTotal: boolean;
  aproximado: boolean;
  /** "historico" = o app achou no extrato e cadastrou sozinho (selo "do extrato"); nulo = ela cadastrou. */
  origem: string | null;
};

type Linha = {
  id: string; nome: string; valor: unknown; vencimento: Date; repete: boolean; lembrar: boolean; quitada: boolean; pagaEm: Date | null; diaDoMes: number | null;
  intervalo: number | null; unidade: string | null; mesesEscolhidos: number[] | null; parcelas: number | null; parcelaAtual: number | null; valorEhTotal: boolean; aproximado: boolean; origem: string | null;
};

function paraTela(c: Linha): ContaDaTela {
  return {
    id: c.id, nome: c.nome, valor: c.valor == null ? null : Number(c.valor), vencimento: c.vencimento, repete: c.repete, lembrar: c.lembrar, quitada: c.quitada, pagaEm: c.pagaEm,
    diaDoMes: c.diaDoMes, intervalo: c.intervalo, unidade: c.unidade, mesesEscolhidos: c.mesesEscolhidos ?? [], parcelas: c.parcelas, parcelaAtual: c.parcelaAtual, valorEhTotal: c.valorEhTotal, aproximado: c.aproximado, origem: c.origem,
  };
}

/** Só contas: a assinatura posta à mão (tipo "assinatura") mora em Assinaturas. */
export const SO_CONTAS = { OR: [{ tipo: null }, { tipo: { not: "assinatura" } }] };

/** As contas em aberto do perfil, da que vence primeiro. As quitadas não voltam. */
export async function listarContasAPagar(ctx: AuthContext): Promise<ContaDaTela[]> {
  const contas = await prisma.contaAPagar.findMany({ where: { ...doDono(ctx), quitada: false, ...SO_CONTAS }, orderBy: [{ vencimento: "asc" }, { nome: "asc" }] });
  return contas.map(paraTela);
}

/** As últimas que ela pagou e não repetem (pra desfazer um "paguei" sem querer). */
export async function listarQuitadasRecentes(ctx: AuthContext, limite = 5): Promise<ContaDaTela[]> {
  const contas = await prisma.contaAPagar.findMany({ where: { ...doDono(ctx), quitada: true, ...SO_CONTAS }, orderBy: { pagaEm: "desc" }, take: limite });
  return contas.map(paraTela);
}

export async function criarContaAPagar(ctx: AuthContext, d: ContaAPagarInput) {
  return prisma.contaAPagar.create({ data: { ...doDono(ctx), ...d, diaDoMes: d.vencimento.getUTCDate() } });
}

/**
 * Mudar a data muda o dia de sempre também: ela escolheu outro dia. Conta achada no histórico que
 * ela editou fica dela: o extrato seguinte não sobrescreve mais.
 */
export async function editarContaAPagar(ctx: AuthContext, id: string, d: ContaAPagarInput) {
  return prisma.contaAPagar.updateMany({ where: { id, ...doDono(ctx) }, data: { ...d, diaDoMes: d.vencimento.getUTCDate(), editadaPelaPessoa: true } });
}

/** Apagar uma conta achada no histórico guarda a recusa: o app nunca cria de novo. */
export async function apagarContaAPagar(ctx: AuthContext, id: string) {
  const c = await prisma.contaAPagar.findFirst({ where: { id, ...doDono(ctx) }, select: { chaveDoHistorico: true, nome: true, valor: true } });
  if (c?.chaveDoHistorico) {
    await prisma.contaRecusada.createMany({ data: [{ ...doDono(ctx), chave: c.chaveDoHistorico, nome: c.nome, valor: c.valor }], skipDuplicates: true });
  }
  return prisma.contaAPagar.deleteMany({ where: { id, ...doDono(ctx) } });
}

/**
 * Só passa o vencimento: a que repete vai pro mês seguinte; a outra fica quitada. Sem gasto. Quem
 * marca "Paguei" na tela usa `pagarContaComGasto`; isto ficou para quem só precisa andar a conta.
 *
 * O `vencimento` no filtro do update segura o toque duplo: o segundo "paguei" não acha mais a
 * conta no vencimento antigo e não pula mais um mês.
 */
export async function marcarContaPaga(ctx: AuthContext, id: string) {
  const c = await prisma.contaAPagar.findFirst({ where: { id, ...doDono(ctx), quitada: false } });
  if (!c) return null;
  const depois = depoisDePagarComRegra(c, regraDaConta(c), c.diaDoMes ?? undefined);
  const r = await prisma.contaAPagar.updateMany({ where: { id, ...doDono(ctx), vencimento: c.vencimento, quitada: false }, data: { ...depois, pagaEm: new Date() } });
  if (r.count === 0) return null;
  return { antes: c.vencimento, antesParcela: c.parcelaAtual, ...depois };
}

/** O que a linha do "Paguei" mandou: quanto, que dia ("AAAA-MM-DD") e de onde saiu. */
export type EscolhaDoPaguei = { valor: number; dia: string; origem: string };

/**
 * "Paguei" (versão B, 15/10/2026): cria o gasto, marca a conta como paga e passa o vencimento,
 * tudo junto. O gasto leva a categoria da conta (ver categoriaDoPaguei), o nome da conta, o valor,
 * o dia, a origem e a ligação com a conta (contaAPagarId). Quando o extrato chegar com o mesmo
 * pagamento, os dois viram um só (lib/import/paguei-no-extrato.ts).
 *
 * Casal simples: quem pagou é quem tocou (o gasto é de quem está logado). A conta da casa
 * (Moradia, como o aluguel e a luz) nasce Da casa; as outras ficam com a regra da casa de sempre.
 *
 * O `vencimento` no filtro do update segura o toque duplo: o segundo "Pronto" não acha a conta no
 * vencimento antigo, não pula mais um mês e não cria um segundo gasto.
 */
export async function pagarContaComGasto(ctx: AuthContext, id: string, e: EscolhaDoPaguei) {
  const c = await prisma.contaAPagar.findFirst({ where: { id, ...doDono(ctx), quitada: false } });
  if (!c) return null;
  const ultimo = await prisma.monthlyEntry.findFirst({
    where: { ...doDono(ctx), contaAPagarId: c.id, category: "EXPENSE" },
    orderBy: { createdAt: "desc" },
    select: { parentCategory: true, customCategoryId: true, subcategory: true },
  });
  const cat = categoriaDoPaguei({ nome: c.nome, categoria: c.categoria, ultima: ultimo, profileKind: ctx.profileKind });
  const depois = depoisDePagarComRegra(c, regraDaConta(c), c.diaDoMes ?? undefined);
  const dia = new Date(`${e.dia}T12:00:00Z`);
  const casa = casaAtiva(ctx);
  const tipo = tipoDaOrigem(e.origem);
  const r = await prisma.$transaction(async (tx) => {
    const m = await tx.contaAPagar.updateMany({ where: { id, ...doDono(ctx), vencimento: c.vencimento, quitada: false }, data: { ...depois, pagaEm: new Date() } });
    if (m.count === 0) return null;
    const lancamento = await tx.monthlyEntry.create({
      data: {
        ...doDono(ctx),
        year: dia.getUTCFullYear(),
        month: dia.getUTCMonth() + 1,
        entryDate: dia,
        category: "EXPENSE",
        parentCategory: cat.customCategoryId ? null : cat.parentCategory,
        customCategoryId: cat.customCategoryId,
        subcategory: cat.subcategory,
        description: c.nome,
        amount: Math.round(e.valor * 100) / 100,
        contaAPagarId: c.id,
        origemDoPagamento: e.origem,
        noCartao: tipo === "cartao" ? true : tipo === null ? null : false,
        // Login do par no Nós dois: quem tocou é o autor.
        ...(ctx.par ? { autorUserId: ctx.userId } : {}),
        // Casal simples: a conta da casa nasce Da casa; o resto fica com a regra da casa.
        ...(casa && daCasaAutomatico({ parentCategory: cat.parentCategory, subcategory: cat.subcategory, description: c.nome }) ? { doCasal: true } : {}),
      },
      select: { id: true },
    });
    return lancamento;
  });
  if (!r) return null;
  return { antes: c.vencimento, antesParcela: c.parcelaAtual, lancamentoId: r.id, nome: c.nome, ...depois };
}

/**
 * Desfaz o "Paguei": volta o vencimento e apaga o gasto que ele criou. Só apaga o lançamento do
 * próprio "Paguei" (ligado à conta e ainda sem lote de importação): a linha do extrato que já
 * ficou no lugar dele nunca sai por aqui. Sem o id (o "Desfazer" das "Pagas há pouco"), é o
 * último gasto do "Paguei" desta conta, criado depois que ela foi marcada como paga.
 */
export async function desfazerContaPaga(ctx: AuthContext, id: string, vencimentoAntes: Date, parcelaAntes?: number | null, lancamentoId?: string | null) {
  const c = await prisma.contaAPagar.findFirst({ where: { id, ...doDono(ctx) }, select: { pagaEm: true } });
  if (!c) return { count: 0 };
  const doPaguei = { ...doDono(ctx), contaAPagarId: id, importBatchId: null, category: "EXPENSE" as const };
  const alvo = lancamentoId
    ? { id: lancamentoId, ...doPaguei }
    : c.pagaEm
      ? { ...doPaguei, createdAt: { gte: new Date(c.pagaEm.getTime() - 60_000) } }
      : null;
  return prisma.$transaction(async (tx) => {
    if (alvo) {
      const ultimo = await tx.monthlyEntry.findFirst({ where: alvo, orderBy: { createdAt: "desc" }, select: { id: true } });
      if (ultimo) await tx.monthlyEntry.deleteMany({ where: { id: ultimo.id, ...doPaguei } });
    }
    return tx.contaAPagar.updateMany({ where: { id, ...doDono(ctx) }, data: { vencimento: vencimentoAntes, quitada: false, pagaEm: null, ...(parcelaAntes !== undefined ? { parcelaAtual: parcelaAntes } : {}) } });
  });
}

/** O palpite da linha do "Paguei" para cada conta, e as origens. */
export type DadosDoPaguei = {
  origens: OrigemDoPaguei[];
  /** A origem que a linha abre marcada (a do último "Paguei"). */
  origem: string;
  /** Por conta que varia: os valores dos meses anteriores ("AAAA-MM"), o mais novo primeiro. */
  antes: Record<string, { mes: string; valor: number }[]>;
};

/**
 * O que a linha do "Paguei" precisa: as origens (as contas e os cartões dos extratos que ela
 * trouxe), a última usada e, nas contas que variam, os valores de antes.
 */
export async function carregarDadosDoPaguei(ctx: AuthContext, contas: { id: string; nome: string; valor: number | null; aproximado?: boolean | null }[], hoje: Date): Promise<DadosDoPaguei> {
  const variam = contas.filter(contaVaria);
  const [lotes, ultimo, pagos] = await Promise.all([
    prisma.importBatch.findMany({ where: doDono(ctx), orderBy: { createdAt: "desc" }, take: 40, select: { docType: true, fileName: true } }),
    prisma.monthlyEntry.findFirst({ where: { ...doDono(ctx), contaAPagarId: { not: null }, origemDoPagamento: { not: null } }, orderBy: { createdAt: "desc" }, select: { origemDoPagamento: true } }),
    variam.length
      ? prisma.monthlyEntry.findMany({
          where: { ...doDono(ctx), contaAPagarId: { in: variam.map((c) => c.id) }, category: "EXPENSE" },
          orderBy: { createdAt: "desc" },
          take: 60,
          select: { contaAPagarId: true, amount: true, year: true, month: true },
        })
      : Promise.resolve([]),
  ]);
  const origens = origensDoPaguei(lotes, ultimo?.origemDoPagamento ?? null);
  const antes: DadosDoPaguei["antes"] = {};
  const mesDeHoje = `${hoje.getUTCFullYear()}-${String(hoje.getUTCMonth() + 1).padStart(2, "0")}`;
  for (const c of variam.slice(0, 8)) {
    const dosPagueis = pagos
      .filter((p) => p.contaAPagarId === c.id)
      .map((p) => ({ mes: `${p.year}-${String(p.month).padStart(2, "0")}`, valor: Number(p.amount) }))
      .filter((p) => p.mes < mesDeHoje);
    const doExtrato = dosPagueis.length >= 2 ? [] : await historicoDaConta(ctx, c.nome, hoje);
    const lista = valoresDeAntes(dosPagueis, doExtrato);
    if (lista.length) antes[c.id] = lista;
  }
  return { origens, origem: origemPadrao(origens, ultimo?.origemDoPagamento ?? null), antes };
}

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Quanto a conta deu nos últimos 3 meses fechados, achada pelo nome nos gastos (descrição ou
 * subcategoria: "Luz" acha a "Enel" de subcategoria Luz). Um valor por mês, do mais antigo para o
 * mais novo. Só serve de sugestão: ela toca para usar.
 */
export async function historicoDaConta(ctx: AuthContext, nome: string, hoje: Date): Promise<{ mes: string; valor: number }[]> {
  const alvo = normalizar(nome);
  if (alvo.length < 3) return [];
  const meses = [1, 2, 3].map((k) => {
    const x = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - k, 1));
    return { year: x.getUTCFullYear(), month: x.getUTCMonth() + 1 };
  });
  const linhas = await prisma.monthlyEntry.findMany({
    where: { ...doDono(ctx), category: "EXPENSE", OR: meses },
    select: { year: true, month: true, description: true, subcategory: true, amount: true },
    take: 2000,
  });
  const casa = (t: string | null) => {
    if (!t) return false;
    const n = normalizar(t);
    return n.length >= 3 && (n.includes(alvo) || alvo.includes(n));
  };
  return meses
    .reverse()
    .map(({ year, month }) => ({
      mes: `${year}-${String(month).padStart(2, "0")}`,
      valor: Math.round(linhas.filter((l) => l.year === year && l.month === month && (casa(l.description) || casa(l.subcategory))).reduce((s, l) => s + Number(l.amount), 0) * 100) / 100,
    }))
    .filter((m) => m.valor > 0);
}
