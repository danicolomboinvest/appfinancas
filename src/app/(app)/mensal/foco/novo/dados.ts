import type { LucideIcon } from "lucide-react";
import type { ParentCategory } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AuthContext } from "@/lib/auth/session";
import { comFiltro, lancamentosDosTotais } from "@/lib/casa/regras";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { CUSTOM_CATEGORY_ICON_MAP, categoryIcon, categoryLabel, colorForCategorySlice, isParentCategoryKey } from "@/lib/categories";
import { listCustomCategories } from "@/lib/repositories/custom-category.repo";
import { mesesAte, valoresDosMeses } from "@/lib/consolidation/seis-meses";
import { sobrouDoMes } from "@/lib/consolidation/sobrou";
import { CATEGORIAS_FIXAS } from "@/lib/decisoes/semana-fixa";
import { parcelasDoMes } from "@/lib/contas/parcelas-do-mes";
import { listarLancamentosParcelaveis } from "@/lib/repositories/monthly-entry.repo";
import { listarRecusasDeParcela } from "@/lib/repositories/parcelas.repo";
import { cacarDinheiroPerdido, type Achado } from "@/lib/dinheiro-perdido/detectar";
import { chavesDasAssinaturasDela, lancamentosParaCacar, listarAchadosGuardados } from "@/lib/repositories/dinheiro-perdido.repo";
import { carregarFoco, MESES } from "../dados";
import { chaveDaSemana } from "../ritmo";
import { ondeMostrarFechamento } from "../fechamento/quando-mostrar";
import { listarDispensasDeSugestao } from "./dispensas";
import {
  categoriaQueCaiu,
  categoriaQueSubiu,
  categoriasQueMudaram,
  compararAteOMesmoDia,
  curvaAcumulada,
  diaDeCorte,
  diasNoMes,
  escolherCaso,
  escolherSugestao,
  limiteProposto,
  mesAnterior,
  porcentagemQueFicou,
  type CasoDoTopo,
  type Comparacao,
  type GastoDoDia,
  type Mes,
  type SinalDoMes,
  type Sugestao,
} from "./regras";

const ENVIAR = "/comecar?passo=volta";
const chaveMes = (m: Mes) => `${m.ano}-${m.mes}`;
const nomeDoMes = (m: Mes) => MESES[m.mes - 1];
const ddmm = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
/** Pagamento da fatura lançado no extrato da conta: entra como um gasto só. */
const PAGAMENTO_DE_FATURA = /fatura|pgto\.? ?cart|pagamento (de )?cart|pag fat/i;

export type InfoDaCategoria = { chave: string; nome: string; icone: LucideIcon; cor: string };
export type LinhaDeCategoria = InfoDaCategoria & { atual: number; passado: number; diferenca: number; compras: number };
export type LinhaParaOndeFoi = InfoDaCategoria & { valor: number; compras: number; pct: number };

export type HeroiDiaADia = {
  comparacao: Comparacao;
  /** O acumulado do mês de agora até o corte, e o do mês passado inteiro (a linha tracejada). */
  curvaAtual: number[];
  curvaPassado: number[];
  diasDoMes: number;
  /** "Ficou com você em setembro", com a diferença contra agosto. Só com 2 meses ou mais. */
  ficouPassado: { valor: number; contraRetrasado: number | null } | null;
  /** "Guardado em 2026", e a % do que entrou no ano. */
  guardadoNoAno: { valor: number; pct: number | null } | null;
};

export type HeroiMesFechado = {
  mes: Mes;
  entrou: number;
  ficou: number;
  pct: number | null;
  pctAnterior: number | null;
  /** As 6 barras de "quanto ficou", em %, do mais antigo ao mês que fechou. */
  barras: { rotulo: string; pct: number | null }[];
};

export type HeroiPrimeiraVez = {
  mes: Mes;
  entrou: number;
  saiu: number;
  ficou: number;
  pct: number | null;
  /** Só a fatura: total e quantas compras. */
  cartao: { total: number; compras: number } | null;
  paraOndeFoi: LinhaParaOndeFoi[];
  /** A fatura que entrou como um gasto só, no extrato. */
  faturaUmGasto: number | null;
  parcelas: { n: number; valor: number; acabaEm: Mes } | null;
  tarifas: { n: number; mensal: number } | null;
};

export type HeroiDigitou = { total: number; n: number; ultimo: { nome: string; hoje: boolean } | null };

export type ResumoNovo = {
  caso: CasoDoTopo;
  hoje: Date;
  mes: Mes;
  passado: Mes;
  diaADia: HeroiDiaADia | null;
  mesFechado: HeroiMesFechado | null;
  primeiraVez: HeroiPrimeiraVez | null;
  digitou: HeroiDigitou | null;
  /** Bloco 2: as 4 categorias que mais mudaram. */
  categorias: LinhaDeCategoria[];
  /** Bloco 1: uma sugestão (ou nada) e quantas decisões esperam no Decidir. */
  sugestao: Sugestao | null;
  marca: string;
  maisNoDecidir: number;
  /** "pelo extrato de 12/10" ou "pelos lançamentos até 13/10". */
  dataDoDado: string;
  foco: Awaited<ReturnType<typeof carregarFoco>>;
};

/**
 * Tudo que o Resumo novo desenha, de uma vez. Reaproveita o carregarFoco (a semana, o "falta o
 * cartão", o revisar, o fechamento) para os números baterem com o Resumo de hoje.
 */
export async function carregarResumoNovo(ctx: AuthContext, hojeDeTeste: Date | null = null): Promise<ResumoNovo> {
  const hoje = hojeDeTeste ?? nowInBrazil();
  const mes: Mes = { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
  const passado = mesAnterior(mes);
  const retrasado = mesAnterior(passado);
  const dia = hoje.getDate();
  const doze = mesesAte(mes.ano, mes.mes, 12);
  const base = lancamentosDosTotais(ctx);
  const dono = { userId: ctx.userId, profileId: ctx.profileId };

  const [foco, valores, gastos, porLote, digitadosPorMes, ultimoLote, personalizadas, dispensas, parcelaveis, recusas, paraCacar, assinaturasDela, guardados, mesesPorCategoria] = await Promise.all([
    carregarFoco(ctx),
    valoresDosMeses(ctx, doze),
    // Os gastos dos dois meses da comparação.
    prisma.monthlyEntry.findMany({
      where: comFiltro(base, { category: "EXPENSE", OR: [{ year: mes.ano, month: mes.mes }, { year: passado.ano, month: passado.mes }] }),
      select: { year: true, month: true, amount: true, entryDate: true, createdAt: true, parentCategory: true, customCategoryId: true, description: true, importBatchId: true, externalId: true },
      take: 8000,
    }),
    // De onde veio o dado de cada mês: que lotes (extrato ou fatura) têm lançamento nele.
    prisma.monthlyEntry.groupBy({
      by: ["year", "month", "importBatchId"],
      where: comFiltro(base, { importBatchId: { not: null }, OR: doze.map((m) => ({ year: m.ano, month: m.mes })) }),
      _count: { _all: true },
    }),
    prisma.monthlyEntry.groupBy({
      by: ["year", "month"],
      where: comFiltro(base, { category: "EXPENSE", importBatchId: null, externalId: null, OR: [{ year: mes.ano, month: mes.mes }, { year: passado.ano, month: passado.mes }] }),
      _count: { _all: true },
    }),
    prisma.importBatch.findFirst({ where: dono, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    listCustomCategories(ctx),
    listarDispensasDeSugestao(ctx),
    listarLancamentosParcelaveis(ctx, { year: mes.ano, month: mes.mes }),
    listarRecusasDeParcela(ctx),
    lancamentosParaCacar(ctx, hoje),
    chavesDasAssinaturasDela(ctx),
    listarAchadosGuardados(ctx),
    // Cada categoria nos 3 meses fechados antes deste: a média vira o limite proposto.
    prisma.monthlyEntry.groupBy({
      by: ["year", "month", "parentCategory", "customCategoryId"],
      where: comFiltro(base, { category: "EXPENSE", OR: mesesAte(passado.ano, passado.mes, 3).map((m) => ({ year: m.ano, month: m.mes })) }),
      _sum: { amount: true },
    }),
  ]);

  // ---------------------------------------------------------------- categorias
  const nomePersonalizada = new Map(personalizadas.map((c) => [c.id, c]));
  const categoriasDoPerfil = ctx.categorias ?? ctx.profileKind;
  const info = (chave: string): InfoDaCategoria => {
    if (isParentCategoryKey(chave)) {
      return { chave, nome: categoryLabel(categoriasDoPerfil, chave as ParentCategory), icone: categoryIcon(categoriasDoPerfil, chave as ParentCategory), cor: colorForCategorySlice({ kind: "parent", value: chave }, categoriasDoPerfil) };
    }
    const c = nomePersonalizada.get(chave);
    return { chave, nome: c?.name ?? "Outros", icone: CUSTOM_CATEGORY_ICON_MAP[c?.icon ?? "tag"] ?? CUSTOM_CATEGORY_ICON_MAP.tag, cor: colorForCategorySlice({ kind: "custom", value: chave }, categoriasDoPerfil) };
  };
  const chaveDe = (g: { customCategoryId: string | null; parentCategory: string | null }) => g.customCategoryId ?? g.parentCategory ?? "OUTROS";

  // O dia de cada gasto dentro do mês dele. Sem data: o dia em que entrou no app, se foi naquele
  // mês (a fatura sem dia por compra vale pelo dia da importação); senão, desde o dia 1.
  const diaNoMes = (g: (typeof gastos)[number]): number | null => {
    if (g.entryDate) {
      const y = g.entryDate.getUTCFullYear();
      const m = g.entryDate.getUTCMonth() + 1;
      if (y === g.year && m === g.month) return g.entryDate.getUTCDate();
      return y * 12 + m < g.year * 12 + g.month ? null : 99;
    }
    const criado = nowInBrazil(g.createdAt);
    return criado.getFullYear() === g.year && criado.getMonth() + 1 === g.month ? criado.getDate() : null;
  };
  const doMes = (m: Mes): GastoDoDia[] => gastos.filter((g) => g.year === m.ano && g.month === m.mes).map((g) => ({ valor: Number(g.amount), dia: diaNoMes(g), categoria: chaveDe(g) }));
  const gastosAtual = doMes(mes);
  const gastosPassado = doMes(passado);

  // ---------------------------------------------------------------- de onde veio o dado
  const idsDosLotes = [...new Set(porLote.map((l) => l.importBatchId).filter((x): x is string => x !== null))];
  const lotes = idsDosLotes.length > 0 ? await prisma.importBatch.findMany({ where: { id: { in: idsDosLotes } }, select: { id: true, docType: true } }) : [];
  const tipoDoLote = new Map(lotes.map((l) => [l.id, l.docType]));
  const arquivosPorMes = new Map<string, { extrato: boolean; fatura: boolean }>();
  for (const l of porLote) {
    const k = `${l.year}-${l.month}`;
    const a = arquivosPorMes.get(k) ?? { extrato: false, fatura: false };
    const tipo = tipoDoLote.get(l.importBatchId ?? "");
    if (tipo === "fatura") a.fatura = true;
    else if (tipo) a.extrato = true;
    arquivosPorMes.set(k, a);
  }
  const valorDe = (m: Mes) => valores.find((v) => v.ano === m.ano && v.mes === m.mes) ?? { entrou: 0, gastou: 0, guardou: 0 };
  const digitadosDe = (m: Mes) => digitadosPorMes.find((d) => d.year === m.ano && d.month === m.mes)?._count._all ?? 0;
  const sinal = (m: Mes): SinalDoMes => {
    const v = valorDe(m);
    const a = arquivosPorMes.get(chaveMes(m)) ?? { extrato: false, fatura: false };
    return { gastos: v.gastou, entradas: v.entrou, extrato: a.extrato, fatura: a.fatura, digitados: digitadosDe(m) };
  };
  const comDado = (v: { entrou: number; gastou: number; guardou: number }) => v.entrou !== 0 || v.gastou !== 0 || v.guardou !== 0;
  const mesesComDado = doze.filter((m) => comDado(valorDe(m))).length;
  const comArquivo = [...doze].reverse().find((m) => arquivosPorMes.has(chaveMes(m)));
  const caso = escolherCaso({
    dia,
    atual: sinal(mes),
    passado: sinal(passado),
    mesesComDado,
    ultimoArquivo: comArquivo ? { mes: comArquivo, ...arquivosPorMes.get(chaveMes(comArquivo))! } : null,
  });

  // ---------------------------------------------------------------- comparação até o mesmo dia
  const corte = diaDeCorte(gastosAtual, dia);
  const comparacao = compararAteOMesmoDia(gastosAtual, gastosPassado, corte, passado);
  const mudaram = categoriasQueMudaram(gastosAtual, gastosPassado, comparacao.corte, comparacao.cortePassado, CATEGORIAS_FIXAS, 99);
  const categorias = mudaram.slice(0, 4).map((c) => ({ ...info(c.categoria), ...c }));

  // ---------------------------------------------------------------- o herói de cada caso
  const ficouDe = (m: Mes) => sobrouDoMes(valorDe(m));
  let diaADia: HeroiDiaADia | null = null;
  let mesFechado: HeroiMesFechado | null = null;
  let primeiraVez: HeroiPrimeiraVez | null = null;
  let digitou: HeroiDigitou | null = null;

  if (caso === "dia-a-dia") {
    const doAno = doze.filter((m) => m.ano === mes.ano).map(valorDe);
    const guardado = doAno.reduce((s, v) => s + v.guardou, 0);
    const entrouNoAno = doAno.reduce((s, v) => s + v.entrou, 0);
    diaADia = {
      comparacao,
      curvaAtual: curvaAcumulada(gastosAtual, comparacao.corte),
      curvaPassado: curvaAcumulada(gastosPassado, diasNoMes(passado)),
      diasDoMes: diasNoMes(mes),
      ficouPassado: mesesComDado >= 2 && comDado(valorDe(passado)) ? { valor: ficouDe(passado), contraRetrasado: comDado(valorDe(retrasado)) ? ficouDe(passado) - ficouDe(retrasado) : null } : null,
      guardadoNoAno: mesesComDado >= 2 && guardado > 0 ? { valor: guardado, pct: porcentagemQueFicou(entrouNoAno, guardado) } : null,
    };
  } else if (caso === "mes-fechado") {
    const v = valorDe(passado);
    const seis = mesesAte(passado.ano, passado.mes, 6);
    mesFechado = {
      mes: passado,
      entrou: v.entrou,
      ficou: ficouDe(passado),
      pct: porcentagemQueFicou(v.entrou, ficouDe(passado)),
      pctAnterior: comDado(valorDe(retrasado)) ? porcentagemQueFicou(valorDe(retrasado).entrou, ficouDe(retrasado)) : null,
      barras: seis.map((m) => ({ rotulo: nomeDoMes(m).slice(0, 3), pct: comDado(valorDe(m)) ? porcentagemQueFicou(valorDe(m).entrou, ficouDe(m)) : null })),
    };
  } else if ((caso === "extrato" || caso === "extrato-fatura" || caso === "fatura") && comArquivo) {
    primeiraVez = await carregarPrimeiraVez(ctx, comArquivo, caso, info, chaveDe, valorDe(comArquivo), paraCacar, assinaturasDela, recusas);
  } else if (caso === "digitou") {
    const doMesAgora = gastos.filter((g) => g.year === mes.ano && g.month === mes.mes).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const ultimo = doMesAgora[0];
    digitou = {
      total: doMesAgora.reduce((s, g) => s + Number(g.amount), 0),
      n: doMesAgora.length,
      ultimo: ultimo ? { nome: info(chaveDe(ultimo)).nome, hoje: nowInBrazil(ultimo.createdAt).getDate() === dia && nowInBrazil(ultimo.createdAt).getMonth() === hoje.getMonth() } : null,
    };
  }

  // ---------------------------------------------------------------- a fila de sugestões
  const m = foco.m;
  const fila: Sugestao[] = [];
  const nomePassado = nomeDoMes(passado);
  if (caso === "dia-a-dia" || caso === "mes-fechado") {
    // 1. Falta um dado que muda o número.
    if (foco.faltaOCartao) {
      const desde = foco.faltaOCartao.mes === mes.mes ? `dia ${foco.faltaOCartao.dia}` : `${foco.faltaOCartao.dia}/${String(foco.faltaOCartao.mes).padStart(2, "0")}`;
      fila.push({ tipo: "falta-dado", id: "cartao", texto: `Faltam os gastos do cartão desde ${desde}.`, botao: { rotulo: "Mandar a fatura", href: ENVIAR } });
    }
    const pagamentoDeFatura = !(arquivosPorMes.get(chaveMes(mes))?.fatura ?? false)
      ? gastos.filter((g) => g.year === mes.ano && g.month === mes.mes && g.importBatchId && PAGAMENTO_DE_FATURA.test(g.description ?? "")).reduce((s, g) => s + Number(g.amount), 0)
      : 0;
    if (pagamentoDeFatura >= 1) fila.push({ tipo: "falta-dado", id: "fatura-um-gasto", texto: `A fatura de ${m(pagamentoDeFatura)} entrou como um gasto só. Mande a fatura e eu abro por categoria.`, botao: { rotulo: "Mandar a fatura", href: ENVIAR } });
    const n = foco.lancamentosParaRevisar;
    if (n > 0) fila.push({ tipo: "falta-dado", id: "revisar", texto: n === 1 ? "1 lançamento para revisar." : `${n} lançamentos para revisar.`, botao: { rotulo: "Revisar", href: "/mensal/foco/revisar" } });

    // 2. Dinheiro escapando: o maior achado ainda sem resposta.
    const decididos = new Set(guardados.filter((g) => g.estado !== "aberto").map((g) => g.chave));
    const achado = cacarDinheiroPerdido(paraCacar, { assinaturasDela }).achados.filter((a) => !decididos.has(a.chave)).sort((a, b) => b.anual - a.anual)[0];
    if (achado) fila.push({ tipo: "dinheiro", id: achado.chave, texto: fraseDoAchado(achado, m), botao: { rotulo: "Ver", href: "/orcamento/contas/perdido" } });

    // 3. Categoria que subiu.
    const subiu = caso === "dia-a-dia" ? categoriaQueSubiu(mudaram) : null;
    if (subiu) {
      const nome = info(subiu.categoria).nome;
      const meses = mesesAte(passado.ano, passado.mes, 3).map((mm) =>
        mesesPorCategoria.filter((r) => r.year === mm.ano && r.month === mm.mes && (r.customCategoryId ?? r.parentCategory) === subiu.categoria).reduce((s, r) => s + Number(r._sum.amount ?? 0), 0),
      );
      const limite = limiteProposto(meses);
      const planejado = foco.categorias.find((c) => c.key === subiu.categoria)?.planejado ?? 0;
      const texto =
        planejado > 0
          ? `${nome} subiu ${m(subiu.diferenca)} contra ${nomePassado}. O limite é ${m(planejado)}.`
          : limite
            ? `${nome} subiu ${m(subiu.diferenca)} contra ${nomePassado}. Quer um limite de ${m(limite)}?`
            : `${nome} subiu ${m(subiu.diferenca)} contra ${nomePassado}.`;
      fila.push({ tipo: "categoria", id: subiu.categoria, texto, botao: { rotulo: planejado > 0 ? "Ver limite" : "Criar limite", href: "/orcamento" } });
    }

    // 4. Parcela que acaba neste mês: a partir do mês que vem, sobra o valor dela.
    const acabam = parcelasDoMes(parcelaveis, { year: mes.ano, month: mes.mes }, [], recusas).itens.filter((p) => p.acabaEm.year === mes.ano && p.acabaEm.month === mes.mes);
    if (acabam.length > 0) {
      const valor = acabam.reduce((s, p) => s + p.valor, 0);
      const seguinte = MESES[mes.mes % 12];
      fila.push({
        tipo: "parcela",
        id: `${mes.ano}-${mes.mes}`,
        texto: `${acabam.length === 1 ? "1 parcela acaba" : `${acabam.length} parcelas acabam`} em ${nomeDoMes(mes)}. A partir de ${seguinte}, sobram ${m(valor)} por mês.`,
        botao: { rotulo: "Ver parcelas", href: "/orcamento/contas" },
      });
    }

    // 5. Hora do mês: fechar o mês passado (dias 1 a 7 vem logo depois do dado que falta) e o ritual.
    const ondeFechar = ondeMostrarFechamento({ ritmo: foco.ritmo, fechamentoFeito: foco.fechamentoFeito, mesAnteriorTinhaPlano: foco.mesAnteriorTinhaPlano, dia });
    if (ondeFechar) {
      fila.push({
        tipo: "hora-do-mes",
        id: `fechar-${passado.ano}-${passado.mes}`,
        texto: `Fechar ${nomePassado} leva 3 minutos e monta o plano de ${nomeDoMes(mes)}.`,
        botao: { rotulo: `Fechar ${nomePassado}`, href: "/mensal/foco/fechamento" },
        prioridade: dia <= 7 ? 0.5 : undefined,
      });
    }
    const diaDaSemana = hoje.getDay();
    if (foco.ritmo !== "mensal" && !foco.ritualFeito && (diaDaSemana === 1 || diaDaSemana === 2)) {
      fila.push({ tipo: "hora-do-mes", id: `ritual-${chaveDaSemana(hoje)}`, texto: "O ritual da semana leva 2 minutos.", botao: { rotulo: "Começar", href: "/mensal/foco/ritual" } });
    }

    // 6. Algo indo bem (só quando nada acima acende, e no máximo uma vez por semana).
    const caiu = caso === "dia-a-dia" ? categoriaQueCaiu(mudaram) : null;
    if (caiu) fila.push({ tipo: "indo-bem", id: caiu.categoria, texto: `${info(caiu.categoria).nome} está ${m(-caiu.diferenca)} abaixo de ${nomePassado}.`, botao: null });
  }

  const marca = (ultimoLote?.createdAt ?? null)?.toISOString() ?? "sem-extrato";
  const sugestao = escolherSugestao(fila, dispensas, { marca, agora: new Date(), semana: chaveDaSemana(hoje) });
  const dataDoDado = ultimoLote && nowInBrazil(ultimoLote.createdAt).getMonth() + 1 === mes.mes ? `pelo extrato de ${ddmm(nowInBrazil(ultimoLote.createdAt))}` : `até ${String(comparacao.corte).padStart(2, "0")}/${String(mes.mes).padStart(2, "0")}`;

  return {
    caso,
    hoje,
    mes,
    passado,
    diaADia,
    mesFechado,
    primeiraVez,
    digitou,
    categorias: caso === "dia-a-dia" ? categorias : [],
    sugestao,
    marca,
    maisNoDecidir: foco.empresa ? 0 : foco.foco.atencao.length,
    dataDoDado,
    foco,
  };
}

function fraseDoAchado(a: Achado, m: (v: number) => string): string {
  if (a.tipo === "repetida") return `Achei uma cobrança repetida de ${m(a.valorDaCobranca ?? a.unico ?? 0)}: ${a.quem}.`;
  if (a.tipo === "aumento" && a.antes && a.agora) return `${a.quem} subiu de ${m(a.antes)} para ${m(a.agora)} por mês.`;
  if (a.tipo === "tarifa") return a.mensal ? `Achei uma tarifa de ${m(a.mensal)} por mês: ${a.nome}.` : `Achei uma tarifa de ${m(a.unico ?? 0)}: ${a.nome}.`;
  return `Achei uma assinatura de ${m(a.mensal ?? 0)} por mês: ${a.quem}.`;
}

/** A primeira vez: o mês do arquivo, para onde foi, e os achados das duas pontas. */
async function carregarPrimeiraVez(
  ctx: AuthContext,
  mes: Mes,
  caso: CasoDoTopo,
  info: (chave: string) => InfoDaCategoria,
  chaveDe: (g: { customCategoryId: string | null; parentCategory: string | null }) => string,
  valor: { entrou: number; gastou: number; guardou: number },
  paraCacar: Awaited<ReturnType<typeof lancamentosParaCacar>>,
  assinaturasDela: Set<string>,
  recusas: Set<string>,
): Promise<HeroiPrimeiraVez> {
  const [linhas, parcelaveis] = await Promise.all([
    prisma.monthlyEntry.findMany({
      where: comFiltro(lancamentosDosTotais(ctx), { year: mes.ano, month: mes.mes, category: "EXPENSE" }),
      select: { amount: true, parentCategory: true, customCategoryId: true, description: true, importBatch: { select: { docType: true } } },
      take: 5000,
    }),
    listarLancamentosParcelaveis(ctx, { year: mes.ano, month: mes.mes }),
  ]);
  const soFatura = caso === "fatura";
  const doCartao = linhas.filter((l) => l.importBatch?.docType === "fatura");
  const consideradas = soFatura ? doCartao : linhas;
  const temFatura = doCartao.length > 0;
  const faturaUmGasto = temFatura ? 0 : linhas.filter((l) => l.importBatch && PAGAMENTO_DE_FATURA.test(l.description ?? "")).reduce((s, l) => s + Number(l.amount), 0);

  const porCategoria = new Map<string, { valor: number; compras: number }>();
  for (const l of consideradas) {
    const k = !temFatura && l.importBatch && PAGAMENTO_DE_FATURA.test(l.description ?? "") ? "__fatura" : chaveDe(l);
    const c = porCategoria.get(k) ?? { valor: 0, compras: 0 };
    c.valor += Number(l.amount);
    c.compras += 1;
    porCategoria.set(k, c);
  }
  const total = consideradas.reduce((s, l) => s + Number(l.amount), 0);
  const paraOndeFoi = [...porCategoria.entries()]
    .filter(([k, c]) => k !== "__fatura" && c.valor >= 1)
    .sort((a, b) => b[1].valor - a[1].valor)
    .slice(0, soFatura ? 3 : 4)
    .map(([k, c]) => ({ ...info(k), valor: c.valor, compras: c.compras, pct: total > 0 ? Math.round((c.valor / total) * 100) : 0 }));

  const parcelas = parcelasDoMes(parcelaveis, { year: mes.ano, month: mes.mes }, [], recusas).itens;
  const ultimaParcela = parcelas.reduce<Mes | null>((fim, p) => {
    const m = { ano: p.acabaEm.year, mes: p.acabaEm.month };
    return !fim || m.ano * 12 + m.mes > fim.ano * 12 + fim.mes ? m : fim;
  }, null);
  const achados = cacarDinheiroPerdido(paraCacar, { assinaturasDela }).achados.filter((a) => a.tipo === "tarifa" && a.mensal);

  const ficou = sobrouDoMes(valor);
  return {
    mes,
    entrou: valor.entrou,
    saiu: valor.gastou,
    ficou,
    pct: porcentagemQueFicou(valor.entrou, ficou),
    cartao: soFatura ? { total, compras: consideradas.length } : null,
    paraOndeFoi,
    faturaUmGasto: faturaUmGasto >= 1 ? faturaUmGasto : null,
    parcelas: parcelas.length > 0 && ultimaParcela ? { n: parcelas.length, valor: parcelas.reduce((s, p) => s + p.valor, 0), acabaEm: ultimaParcela } : null,
    tarifas: achados.length > 0 ? { n: achados.length, mensal: achados.reduce((s, a) => s + (a.mensal ?? 0), 0) } : null,
  };
}
