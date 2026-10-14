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
  /** Lançado por quem olha (no Casal, o do outro aparece mas só ele muda). Sem o campo: sim. */
  meu?: boolean;
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
  /** A série ("amazon marketplace cc|10"): é ela que o "Não é parcela" recusa. Vazia na conta. */
  serie: string;
  /** Quem olha pode mudar (Editar, Apagar, Não é parcela). */
  editavel: boolean;
  /** O "N/T" é parcela com certeza. O "LOJA 03/10" ambíguo só é parcela sem dia: não muda o dia. */
  confiante: boolean;
};

export type ParcelasDoMes = {
  itens: ParcelaDoMes[];
  /** Soma das lançadas no mês. */
  lancadas: number;
  /** Soma das previstas (ainda sem lançamento) e das contas parceladas. */
  aLancar: number;
  total: number;
};

export const indice = (m: Mes) => m.year * 12 + (m.month - 1);
export const doIndice = (i: number): Mes => ({ year: Math.floor(i / 12), month: (i % 12) + 1 });

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

/** Parcela e não recusada por ela ("Não é parcela" no menu "…"). */
export function ehParcelaDela(descricao: string | null, temDia: boolean, recusadas: ReadonlySet<string>): boolean {
  const p = ehParcela(descricao, temDia);
  return p !== null && !recusadas.has(chaveNaoParcela(serieDaParcela(descricao ?? "", p.total)));
}

/** Centavos de diferença entre parcelas da mesma compra (a primeira absorve o arredondamento). */
const mesmoValor = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, Math.max(a, b) * 0.02);

const diaDe = (iso: string | null) => (iso ? Number(iso.slice(8, 10)) || null : null);

/**
 * O que ela disse no menu "…" da parcela (13/10/2026), guardado em ContaRecusada (sem tabela
 * nova, como o "Não é assinatura"):
 * - "Não é parcela": a série inteira deixa de ser parcela (não soma, não projeta, a importação
 *   não projeta de novo);
 * - "Apagar esta compra": a compra (série + mês da compra) não volta como prevista pelas parcelas
 *   que ficaram nos meses passados.
 */
export const PREFIXO_NAO_PARCELA = "nao-parcela:";
export const PREFIXO_COMPRA_APAGADA = "parcela-apagada:";
export const chaveNaoParcela = (serie: string) => `${PREFIXO_NAO_PARCELA}${serie}`.slice(0, 160);
export const chaveCompraApagada = (serie: string, origem: number) => `${PREFIXO_COMPRA_APAGADA}${origem}|${serie}`.slice(0, 160);

/**
 * A importação não projeta a parcela que ela recusou: a série com "Não é parcela", ou a compra
 * apagada (mesma série e mês da compra, com um de folga). `recusadas`: as chaves do perfil.
 */
export function projecaoRecusada(recusadas: ReadonlySet<string>, descricao: string, total: number, origem: number): boolean {
  const serie = serieDaParcela(descricao, total);
  return recusadas.has(chaveNaoParcela(serie)) || compraFoiApagada(recusadas, [{ serie, origem }]);
}

/** A compra apagada pelo índice do mês da compra (com o mesmo mês de folga das séries). */
function compraFoiApagada(recusadas: ReadonlySet<string>, compra: { serie: string; origem: number }[]): boolean {
  return compra.some((l) => [-1, 0, 1].some((d) => recusadas.has(chaveCompraApagada(l.serie, l.origem + d))));
}

export type Lida = LancamentoParcelavel & { atual: number; total: number; nome: string; serie: string; origem: number; mes: number; confiante: boolean };

/** Os lançamentos que são parcela, já com a série e o mês da compra. Tira as séries recusadas. */
export function lerParcelas(lancamentos: LancamentoParcelavel[], recusadas: ReadonlySet<string> = new Set()): Lida[] {
  const lidas: Lida[] = [];
  for (const l of lancamentos) {
    if (!(l.valor > 0) || !l.descricao) continue;
    const p = ehParcela(l.descricao, l.dia !== null);
    if (!p) continue;
    const serie = serieDaParcela(l.descricao, p.total);
    if (recusadas.has(chaveNaoParcela(serie))) continue;
    const m = indice(l);
    lidas.push({ ...l, ...p, nome: nomeSemParcela(l.descricao), serie, origem: m - (p.atual - 1), mes: m, confiante: Boolean(parseInstallment(l.descricao)?.confident) });
  }
  return lidas;
}

/**
 * As compras: a série (nome + total) e o mês da compra, com um mês de folga, e o valor.
 * `todas`: também as ambíguas (para achar a compra de uma parcela que ela quer mudar); sem isso,
 * só as com certeza, que são as que prevêem meses (a ambígua não inventa mês nenhum).
 */
export function agruparCompras(lidas: Lida[], todas = false): Lida[][] {
  const compras: Lida[][] = [];
  const porSerie = new Map<string, Lida[]>();
  for (const l of lidas) {
    if (!todas && !l.confiante) continue;
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
  return compras;
}

/** A conta parcelada cadastrada que é a mesma compra de uma parcela da fatura (nome e valor). */
export function contaEhAMesma(c: Pick<ContaParcelada, "nome" | "valor">, item: { nome: string; valor: number }): boolean {
  const nome = normalizar(c.nome);
  const v = c.valor ?? 0;
  return nome.length >= 3 && ` ${normalizar(item.nome)} `.includes(` ${nome} `) && mesmoValor(item.valor, v);
}

/**
 * As parcelas do mês `mes`. `lancamentos`: os gastos com cara de parcela de uma janela larga
 * (meses antes e depois), de onde saem as séries. `contas`: as contas parceladas de Recorrentes.
 */
export function parcelasDoMes(lancamentos: LancamentoParcelavel[], mes: Mes, contas: ContaParcelada[] = [], recusadas: ReadonlySet<string> = new Set()): ParcelasDoMes {
  const alvo = indice(mes);
  const lidas = lerParcelas(lancamentos, recusadas);

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
    serie: l.serie,
    editavel: l.meu !== false,
    confiante: l.confiante,
  });

  // Cada compra: a série e o mês da compra (ver agruparCompras). A apagada pelo menu não volta.
  const compras = agruparCompras(lidas).filter((c) => !compraFoiApagada(recusadas, c));
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
    // Já tem no mês a mesma parcela da mesma série (a compra com o valor editado, que não junta
    // mais com as pagas pelo valor): é ela, não outra.
    if (lidas.some((l) => l.mes === alvo && l.serie === base.serie && l.atual === atual)) continue;
    itens.push(comDia({ ...parcela(base, atual, "prevista"), dia: null }, base));
  }

  // Contas parceladas cadastradas, menos a que é a mesma compra de uma parcela da fatura.
  for (const c of contas) {
    const v = c.valor ?? 0;
    if (!(v > 0) || !((c.parcelas ?? 0) > 1)) continue;
    if (itens.some((i) => contaEhAMesma(c, i))) continue;
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
      serie: "",
      editavel: true,
      confiante: true,
    });
  }

  itens.sort((a, b) => (a.dia ?? 99) - (b.dia ?? 99) || b.valor - a.valor || a.nome.localeCompare(b.nome, "pt-BR"));
  const lancadas = itens.filter((i) => i.origem === "lancada").reduce((s, i) => s + i.valor, 0);
  const aLancar = itens.filter((i) => i.origem !== "lancada").reduce((s, i) => s + i.valor, 0);
  const r = (v: number) => Math.round(v * 100) / 100;
  return { itens, lancadas: r(lancadas), aLancar: r(aLancar), total: r(lancadas + aLancar) };
}

/** A janela de meses que basta para achar as séries: 4 anos para trás (48x) e 1 para frente. */
export function janelaDasParcelas(mes: Mes, paraFrente = 12): { de: Mes; ate: Mes } {
  return { de: doIndice(indice(mes) - 48), ate: doIndice(indice(mes) + paraFrente) };
}

/** A parcela que ela tocou no menu "…", com o que é preciso para mudar. */
export type ParcelaParaMudar =
  | { tipo: "conta"; item: ParcelaDoMes; contaId: string }
  | {
      tipo: "fatura";
      item: ParcelaDoMes;
      /** Todos os lançamentos da mesma compra (meses passados, este e os projetados). */
      compra: Lida[];
      /** O mês da compra (o índice), para lembrar a compra apagada. */
      origem: number;
      /** As contas parceladas cadastradas que são a mesma compra (somem junto com ela). */
      contas: string[];
    };

/**
 * Acha a parcela pela chave da tela, com os MESMOS dados que montaram a lista (só os de quem
 * olha: a parcela do outro, no Casal, não é achada). Null quando sumiu ou não é dela.
 */
export function acharParcela(
  lancamentos: LancamentoParcelavel[],
  mes: Mes,
  contas: ContaParcelada[],
  recusadas: ReadonlySet<string>,
  chave: string,
): ParcelaParaMudar | null {
  const item = parcelasDoMes(lancamentos, mes, contas, recusadas).itens.find((i) => i.chave === chave);
  if (!item || !item.editavel) return null;
  if (item.origem === "conta") return { tipo: "conta", item, contaId: chave.slice("conta:".length) };
  const id = item.origem === "lancada" ? chave : chave.split("|")[0];
  const compras = agruparCompras(lerParcelas(lancamentos, recusadas), true);
  const base = compras.find((c) => c.some((l) => l.id === id));
  if (!base) return null;
  // As pagas com outro valor (ela editou o valor daqui para frente) são da mesma compra: mesma
  // série, mesmo mês da compra e nenhum mês em comum.
  const juntas = compras.filter(
    (c) => c !== base && c[0].serie === base[0].serie && c.some((l) => base.some((b) => Math.abs(l.origem - b.origem) <= 1)) && !c.some((l) => base.some((b) => b.mes === l.mes)),
  );
  const compra = [...base, ...juntas.flat()];
  const meus = compra.filter((l) => l.meu !== false);
  return {
    tipo: "fatura",
    item,
    compra: meus.sort((a, b) => a.mes - b.mes),
    origem: Math.min(...meus.map((l) => l.origem)),
    contas: contas.filter((c) => (c.parcelas ?? 0) > 1 && contaEhAMesma(c, item)).map((c) => c.id),
  };
}
