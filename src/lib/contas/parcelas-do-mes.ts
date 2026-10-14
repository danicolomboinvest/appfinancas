/**
 * As parcelas do mês (13/10/2026, pedido da Dani: "Eu tenho algumas parcelas de coisa e você não
 * conseguiu identificar"). Um número só para a aba Recorrentes ("Renda com dono") e para o gasto
 * da semana (semana-fixa.ts), sem contar a mesma parcela duas vezes:
 *
 * - lançada: a parcela que já está no mês ("Amazon Marketplace Cc (9/10)" de outubro), vinda da
 *   fatura ou projetada por uma fatura anterior;
 * - prevista: a compra parcelada que continua neste mês mas ainda não tem lançamento. É o caso
 *   das faturas antigas do BTG, cujo "(4/6)" o app não projetava: a Airbnb 3/6 de setembro diz
 *   que a 4/6 cai em outubro. A conta é a mesma da importação: a parcela k é do mês da compra +
 *   (k - 1);
 * - conta: a compra parcelada cadastrada à mão em Recorrentes (a geladeira em 10x), quando ela não
 *   é a mesma de uma parcela da fatura.
 *
 * Antes, Recorrentes só somava a conta cadastrada à mão: com tudo vindo da fatura, dava R$ 0.
 *
 * Puro, sem banco. Datas em "AAAA-MM-DD".
 */
import { installmentCanonical, parseInstallment } from "@/lib/entries/recurrence";

export type Mes = { year: number; month: number };

export type LancamentoParcelavel = {
  id: string;
  year: number;
  month: number;
  descricao: string | null;
  valor: number;
  /** O dia gravado ("AAAA-MM-DD"), ou null. */
  dia: string | null;
  /** A categoria-mãe ou a personalizada (o id), como as chaves do orçamento. */
  categoria: string | null;
};

export type ContaParcelada = { id: string; nome: string; valor: number | null; parcelas: number | null; parcelaAtual: number | null; categoria: string | null; diaDoMes: number | null };

export type ParcelaDoMes = {
  chave: string;
  /** O nome sem o "(N/T)": "Amazon Marketplace Cc". */
  nome: string;
  /** A descrição como está no lançamento, para o logo. */
  descricao: string;
  atual: number;
  total: number;
  valor: number;
  /** Quantas faltam pagar, contando a deste mês (a 9 de 10 tem 2; a última tem 1). */
  faltam: number;
  /** O mês da última parcela. */
  acabaEm: Mes;
  /** Dia do mês em que cai, quando se sabe. */
  dia: number | null;
  origem: "lancada" | "prevista" | "conta";
  categoria: string | null;
};

export type ParcelasDoMes = {
  itens: ParcelaDoMes[];
  /** Soma das lançadas no mês. */
  lancadas: number;
  /** Soma das previstas (ainda sem lançamento) e das contas parceladas. */
  aLancar: number;
  total: number;
};

const indice = (m: Mes) => m.year * 12 + (m.month - 1);
const doIndice = (i: number): Mes => ({ year: Math.floor(i / 12), month: (i % 12) + 1 });

const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** "Amazon Marketplace Cc (9/10)" → "Amazon Marketplace Cc"; "LOJA X PARC 03/10" → "LOJA X". */
export function nomeSemParcela(descricao: string): string {
  const semNT = installmentCanonical(descricao)
    .replace(/\(?\s*\b\d{1,2}\s*(\/|de)\s*\d{1,2}\b\s*\)?/gi, " ")
    .replace(/\b(parc(ela)?|presta[çc][ãa]o)\b\.?:?/gi, " ")
    .replace(/\s*-\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  return semNT || descricao.trim();
}

/** A série de uma parcela: o nome sem o "N/T", normalizado, e o total ("amazon marketplace cc|10").
 * Duas parcelas da mesma série podem ser da mesma compra (ou de duas compras iguais). */
export function serieDaParcela(descricao: string, total: number): string {
  return `${normalizar(nomeSemParcela(descricao))}|${total}`;
}

/**
 * O lançamento é parcela? Com certeza (parseInstallment: "PARC", "2 de 6", "(9/10)", total acima
 * de 12) sempre; o "LOJA 03/10" ambíguo só quando a importação o gravou sem dia, que é como ela
 * grava a parcela que não é compra do mês ("POSTO SHELL 03/09" com dia é a data da compra).
 */
export function ehParcela(descricao: string | null, temDia: boolean): { atual: number; total: number } | null {
  const p = parseInstallment(descricao);
  if (!p) return null;
  if (!p.confident && temDia) return null;
  return { atual: p.current, total: p.total };
}

/** Centavos de diferença entre parcelas da mesma compra (a primeira absorve o arredondamento). */
const mesmoValor = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, Math.max(a, b) * 0.02);

const diaDe = (iso: string | null) => (iso ? Number(iso.slice(8, 10)) || null : null);

type Lida = LancamentoParcelavel & { atual: number; total: number; nome: string; serie: string; origem: number; mes: number };

/**
 * As parcelas do mês `mes`. `lancamentos`: os gastos com cara de parcela de uma janela larga
 * (meses antes e depois), de onde saem as séries. `contas`: as contas parceladas de Recorrentes.
 */
export function parcelasDoMes(lancamentos: LancamentoParcelavel[], mes: Mes, contas: ContaParcelada[] = []): ParcelasDoMes {
  const alvo = indice(mes);
  const lidas: Lida[] = [];
  for (const l of lancamentos) {
    if (!(l.valor > 0) || !l.descricao) continue;
    const p = ehParcela(l.descricao, l.dia !== null);
    if (!p) continue;
    const nome = nomeSemParcela(l.descricao);
    const m = indice(l);
    lidas.push({ ...l, ...p, nome, serie: serieDaParcela(l.descricao, p.total), origem: m - (p.atual - 1), mes: m });
  }

  const itens: ParcelaDoMes[] = [];
  const parcela = (l: Lida, atual: number, origem: ParcelaDoMes["origem"]): ParcelaDoMes => ({
    chave: origem === "lancada" ? l.id : `${l.id}|${alvo}`,
    nome: l.nome,
    descricao: l.descricao ?? l.nome,
    atual,
    total: l.total,
    valor: l.valor,
    faltam: l.total - atual + 1,
    acabaEm: doIndice(alvo + (l.total - atual)),
    dia: diaDe(l.dia),
    origem,
    categoria: l.categoria,
  });

  // Cada compra: a série (nome + total) e o mês da compra, com um mês de folga, e o valor. Só a
  // parcela com certeza: a ambígua não inventa mês nenhum.
  const compras: Lida[][] = [];
  const porSerie = new Map<string, Lida[]>();
  for (const l of lidas) {
    if (!parseInstallment(l.descricao)?.confident) continue;
    porSerie.set(l.serie, [...(porSerie.get(l.serie) ?? []), l]);
  }
  for (const doGrupo of porSerie.values()) {
    const daSerie: Lida[][] = [];
    for (const l of [...doGrupo].sort((a, b) => a.origem - b.origem || a.mes - b.mes)) {
      const mesma = daSerie.find((c) => c.some((x) => Math.abs(x.origem - l.origem) <= 1 && mesmoValor(x.valor, l.valor)));
      if (mesma) mesma.push(l);
      else daSerie.push([l]);
    }
    compras.push(...daSerie);
  }
  // O dia em que a compra cai: o da parcela que tem dia (a 1ª, que veio como compra do mês).
  const diaDaCompra = new Map<string, number>();
  for (const compra of compras) {
    const d = diaDe(compra.find((l) => l.dia)?.dia ?? null);
    if (d) for (const l of compra) diaDaCompra.set(l.id, d);
  }
  const comDia = (p: ParcelaDoMes, l: Lida): ParcelaDoMes => ({ ...p, dia: p.dia ?? diaDaCompra.get(l.id) ?? null });

  // Lançadas: o que já está no mês.
  for (const l of lidas.filter((x) => x.mes === alvo)) itens.push(comDia(parcela(l, l.atual, "lancada"), l));

  // Previstas: a compra que não tem lançamento neste mês. A parcela vem do lançamento mais perto.
  for (const compra of compras) {
    if (compra.some((l) => l.mes === alvo)) continue;
    // O lançamento mais recente até este mês; sem nenhum antes, o primeiro depois.
    const antes = compra.filter((l) => l.mes < alvo).sort((a, b) => b.mes - a.mes || b.atual - a.atual)[0];
    const base = antes ?? compra.filter((l) => l.mes > alvo).sort((a, b) => a.mes - b.mes)[0];
    if (!base) continue;
    const atual = base.atual + (alvo - base.mes);
    if (atual < 1 || atual > base.total) continue;
    // Uma parcela que pularia o mês do lançamento seguinte: a série é de outra compra.
    const depois = compra.find((l) => l.mes > alvo);
    if (antes && depois && depois.atual <= atual) continue;
    itens.push(comDia({ ...parcela(base, atual, "prevista"), dia: null }, base));
  }

  // Contas parceladas cadastradas, menos a que é a mesma compra de uma parcela da fatura.
  for (const c of contas) {
    const v = c.valor ?? 0;
    if (!(v > 0) || !((c.parcelas ?? 0) > 1)) continue;
    const nome = normalizar(c.nome);
    const repetida = nome.length >= 3 && itens.some((i) => ` ${normalizar(i.nome)} `.includes(` ${nome} `) && mesmoValor(i.valor, v));
    if (repetida) continue;
    const atual = Math.min(c.parcelas ?? 1, Math.max(1, c.parcelaAtual ?? 1));
    itens.push({
      chave: `conta:${c.id}`,
      nome: c.nome,
      descricao: c.nome,
      atual,
      total: c.parcelas ?? 1,
      valor: v,
      faltam: (c.parcelas ?? 1) - atual + 1,
      acabaEm: doIndice(alvo + ((c.parcelas ?? 1) - atual)),
      dia: c.diaDoMes,
      origem: "conta",
      categoria: c.categoria,
    });
  }

  itens.sort((a, b) => (a.dia ?? 99) - (b.dia ?? 99) || b.valor - a.valor || a.nome.localeCompare(b.nome, "pt-BR"));
  const lancadas = itens.filter((i) => i.origem === "lancada").reduce((s, i) => s + i.valor, 0);
  const aLancar = itens.filter((i) => i.origem !== "lancada").reduce((s, i) => s + i.valor, 0);
  const r = (v: number) => Math.round(v * 100) / 100;
  return { itens, lancadas: r(lancadas), aLancar: r(aLancar), total: r(lancadas + aLancar) };
}

/** A janela de meses que basta para achar as séries: 4 anos para trás (48x) e 1 para frente. */
export function janelaDasParcelas(mes: Mes): { de: Mes; ate: Mes } {
  return { de: doIndice(indice(mes) - 48), ate: doIndice(indice(mes) + 12) };
}
