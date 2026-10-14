/**
 * Conserto das parcelas antigas (13/10/2026). Puro: recebe os lançamentos, devolve o plano. Quem
 * lê e grava no banco é scripts/consertar-parcelas-antigas.ts.
 *
 * Até 13/10/2026 a importação:
 * - não reconhecia o "(N/T)" com T ≤ 12 sem a palavra "parcela" (o BTG escreve
 *   "Amazon Marketplace Cc (9/10)"), então não projetava as parcelas seguintes;
 * - gravava toda parcela sem dia (entryDate nulo, "Sem data" nas Transações).
 * As importações novas já fazem certo. Isto conserta o que ficou para trás, com as MESMAS regras:
 * parseInstallment decide o que é parcela com certeza, installmentDescription escreve o "N/T" da
 * próxima, diaDaParcela põe o dia da compra no mês da parcela, ehLojaDeTudo decide se a categoria
 * passa adiante e mesmaParcela é a folga de centavos.
 *
 * Uma compra = mesmo dono (userId + perfil), mesma série (nome sem o "N/T" + total, ver
 * serieDaParcela), mesmo valor (folga de mesmaParcela) e o mesmo mês de compra (mês - (N - 1)),
 * com um mês de folga: a fatura antiga ia inteira pro mês do vencimento, a nova vai pro mês da
 * compra + (N - 1).
 *
 * Por compra:
 * 1. Parcela sem dia ganha o dia da compra, se alguma parcela da mesma compra tem dia. Sem
 *    nenhuma, fica sem dia: a importação nova também não inventa dia quando a linha não traz data
 *    (mesDaCompra devolve dia nulo). Só preenche entryDate NULO: o app não guarda marca de edição,
 *    e nada do que a pessoa mudou na linha é tocado.
 * 2. As parcelas que faltam (da maior N conhecida + 1 até T) entram nos meses seguintes ao da
 *    maior N, como a importação projeta: mesmo valor, perfil, userId, a descrição do banco com o
 *    "N/T" novo, o MESMO lote da parcela de origem (é assim que a próxima fatura reconhece a
 *    parcela projetada no mês vizinho e não duplica, ver ehProjecao em import-actions) e a
 *    categoria só quando não é loja de tudo (Amazon, Mercado Livre): lá a categoria de uma compra
 *    não diz nada da outra, e o histórico não guarda se foi ela que escolheu.
 * 3. Pula: compra que a importação antiga JÁ lia ("parcela", "N de T", total > 12) e cujas
 *    seguintes não estão no app: ela projetava essas, então a falta pode ser de propósito (ela
 *    apagou, ou desfez a fatura que tinha adotado as projetadas). Essas só ganham o dia; projetar
 *    só com --incluir-as-que-ja-eram-lidas. Também só o dia quando a mesma compra está em outro
 *    perfil da mesma conta (projetar nos dois contaria o gasto duas vezes). Pula também: descrição ambígua ("POSTO 03/09", que é data), compra cujas N não fecham (N repetida,
 *    duas compras iguais misturadas), total > 48 (parseInstallment nem lê), compra dividida com
 *    alguém, e projeção quando a parcela mais recente não veio de uma fatura fechada importada
 *    (lançada à mão, Open Finance, print da fatura aberta, série de "Repetir todo mês").
 *
 * Empresa e Casal: a importação projeta do mesmo jeito em todo perfil. A única diferença é o
 * Casal, que grava quem pagou (`pessoa`) e se é da casa; a projetada copia esses campos da parcela
 * de origem (e o userId dela, que no Casal pode ser o do par).
 */
import type { EntryCategory, ParentCategory } from "@prisma/client";
import { installmentDescription, mesmaParcela, parseInstallment } from "@/lib/entries/recurrence";
import { serieDaParcela } from "@/lib/contas/parcelas-do-mes";
import { ehLojaDeTudo } from "@/lib/import/comerciante";
import { diaDaParcela, type Mes } from "@/lib/import/mes-da-compra";

export type LancamentoAntigo = {
  id: string;
  userId: string;
  profileId: string | null;
  /** PESSOAL, EMPRESA, CASAL... (só pra contar no relatório). */
  perfilTipo: string | null;
  year: number;
  month: number;
  category: EntryCategory;
  parentCategory: ParentCategory | null;
  customCategoryId: string | null;
  subcategory: string | null;
  /** Como está no app (pode ter sido renomeada). */
  description: string | null;
  /** O nome que o banco deu (Decisao "descricao_original"), quando ela renomeou. */
  descricaoDoBanco: string | null;
  amount: number;
  /** "AAAA-MM-DD" ou null. */
  entryDate: string | null;
  importBatchId: string | null;
  /** docType do lote ("fatura" | "extrato"), null sem lote. */
  loteTipo: string | null;
  loteAberto: boolean;
  pessoa: string | null;
  doCasal: boolean | null;
  soMeu: boolean;
  autorUserId: string | null;
  noCartao: boolean | null;
  divididoCom: string | null;
  recurrenceId: string | null;
  externalId: string | null;
};

export type ParcelaACriar = {
  userId: string;
  profileId: string | null;
  year: number;
  month: number;
  category: EntryCategory;
  parentCategory: ParentCategory | null;
  customCategoryId: string | null;
  subcategory: string | null;
  description: string;
  amount: number;
  entryDate: string | null;
  importBatchId: string;
  pessoa: string | null;
  doCasal: boolean | null;
  soMeu: boolean;
  autorUserId: string | null;
  noCartao: boolean | null;
  /** De qual lançamento ela foi projetada (só pro relatório). */
  origemId: string;
  parcela: number;
  total: number;
};

export type DiaADar = { id: string; userId: string; dia: string };

export type MotivoPulada =
  | "ambigua_parece_data"
  | "n_repetida"
  | "n_nao_fecham"
  | "dividida_com_alguem"
  | "origem_nao_e_fatura"
  | "origem_print_fatura_aberta"
  | "origem_repetir_todo_mes"
  | "importacao_antiga_ja_projetava"
  | "mesma_compra_em_outro_perfil";

export const MOTIVOS: Record<MotivoPulada, string> = {
  ambigua_parece_data: "\"N/T\" sem parênteses e sem a palavra parcela, T ≤ 12: pode ser a data da compra (lançamentos)",
  n_repetida: "a mesma parcela N aparece duas vezes (compra em dobro ou duas compras iguais)",
  n_nao_fecham: "as parcelas não fecham numa compra só (meses de compra a mais de um mês um do outro)",
  dividida_com_alguem: "compra dividida com alguém (o valor é só a parte dela)",
  origem_nao_e_fatura: "a parcela mais recente não veio de fatura importada (à mão ou Open Finance): só o dia, sem projetar",
  origem_print_fatura_aberta: "a parcela mais recente veio do print da fatura aberta: quem projeta é a fatura fechada",
  origem_repetir_todo_mes: "a parcela mais recente é de uma série \"Repetir todo mês\"",
  mesma_compra_em_outro_perfil:
    "a mesma compra (série, valor e mês) está também em outro perfil da mesma conta: projetar nos dois contaria o gasto duas vezes. Só o dia",
  importacao_antiga_ja_projetava:
    "a importação antiga já lia esta parcela (\"parcela\", \"N de T\" ou total > 12) e projetava as seguintes: se não estão no app, ela pode ter apagado (ou desfeito a fatura que as tinha). Só o dia, sem projetar (--incluir-as-que-ja-eram-lidas projeta)",
};

export type CompraPlanejada = {
  chave: string;
  userId: string;
  profileId: string | null;
  perfilTipo: string | null;
  nome: string;
  valor: number;
  total: number;
  conhecidas: { id: string; n: number; mes: Mes; dia: string | null }[];
  criar: ParcelaACriar[];
  darDia: DiaADar[];
  /** Parcelas que continuam sem dia porque nenhuma parcela da compra tem. */
  semDiaConhecido: number;
  pulada: MotivoPulada | null;
};

export type Plano = {
  compras: CompraPlanejada[];
  /** Lançamentos ambíguos (cara de data), fora de qualquer compra. */
  ambiguas: number;
  lancamentosComParcela: number;
};

const indice = (m: Mes) => m.year * 12 + (m.month - 1);
const doIndice = (i: number): Mes => ({ year: Math.floor(i / 12), month: (i % 12) + 1 });

type Lida = LancamentoAntigo & { n: number; t: number; desc: string; mes: number; origem: number; confiante: boolean };

/** O nome que vale pra ler a parcela: o do banco (ela pode ter renomeado a linha). */
const descricaoParaLer = (l: LancamentoAntigo) => l.descricaoDoBanco ?? l.description;

export type OpcoesDoConserto = {
  /** Projeta também as compras que a importação antiga já lia (ver "importacao_antiga_ja_projetava"). */
  incluirJaLidas?: boolean;
};

/**
 * A importação de antes de 13/10 já tinha certeza desta parcela? Era a mesma regra, sem a dos
 * parênteses: tirando os parênteses, parseInstallment decide como decidia.
 */
export function importacaoAntigaJaLia(descricao: string): boolean {
  return parseInstallment(descricao.replace(/[()]/g, " "))?.confident === true;
}

export function planejarConserto(lancamentos: LancamentoAntigo[], opcoes: OpcoesDoConserto = {}): Plano {
  const lidas: Lida[] = [];
  for (const l of lancamentos) {
    if (!(l.amount > 0)) continue;
    const desc = descricaoParaLer(l);
    const p = parseInstallment(desc);
    if (!p || !desc) continue;
    const mes = indice(l);
    lidas.push({ ...l, n: p.current, t: p.total, desc, mes, origem: mes - (p.current - 1), confiante: p.confident });
  }

  // Séries por dono. As ambíguas entram só na checagem de "já existe" (nunca dão origem a nada).
  const porSerie = new Map<string, Lida[]>();
  for (const l of lidas) {
    const k = `${l.userId}|${l.profileId ?? ""}|${serieDaParcela(l.desc, l.t)}`;
    porSerie.set(k, [...(porSerie.get(k) ?? []), l]);
  }

  // A mesma série em todos os perfis da conta (a fatura subida no Pessoal e no Casal, por exemplo).
  const daConta = new Map<string, Lida[]>();
  for (const l of lidas) {
    const k = `${l.userId}|${serieDaParcela(l.desc, l.t)}`;
    daConta.set(k, [...(daConta.get(k) ?? []), l]);
  }

  const compras: CompraPlanejada[] = [];
  for (const [serie, todas] of porSerie) {
    const confiantes = todas.filter((l) => l.confiante);
    const ambiguas = todas.filter((l) => !l.confiante);
    // Agrupa em compras: mesmo valor e mês de compra até um mês de distância de alguma do grupo.
    const grupos: Lida[][] = [];
    for (const l of [...confiantes].sort((a, b) => a.origem - b.origem || a.mes - b.mes || a.id.localeCompare(b.id))) {
      const g = grupos.find((c) => c.some((x) => Math.abs(x.origem - l.origem) <= 1 && mesmaParcela(x.amount, l.amount, l.t)));
      if (g) g.push(l);
      else grupos.push([l]);
    }
    const [userId, profileId] = serie.split("|");
    const outrosPerfis = (daConta.get(`${userId}|${serie.split("|").slice(2).join("|")}`) ?? []).filter((l) => (l.profileId ?? "") !== profileId);
    for (const g of grupos) compras.push(planejarCompra(serie, g, ambiguas, outrosPerfis, opcoes));
  }
  compras.sort((a, b) => a.chave.localeCompare(b.chave));
  return { compras, ambiguas: lidas.filter((l) => !l.confiante).length, lancamentosComParcela: lidas.length };
}

function planejarCompra(serie: string, g: Lida[], ambiguas: Lida[], outrosPerfis: Lida[], opcoes: OpcoesDoConserto): CompraPlanejada {
  const base = [...g].sort((a, b) => b.n - a.n || b.mes - a.mes)[0];
  const compra: CompraPlanejada = {
    chave: `${serie}|${Math.min(...g.map((l) => l.origem))}|${base.amount.toFixed(2)}`,
    userId: base.userId,
    profileId: base.profileId,
    perfilTipo: base.perfilTipo,
    nome: serie.split("|").slice(2, -1).join("|"),
    valor: base.amount,
    total: base.t,
    conhecidas: [...g].sort((a, b) => a.n - b.n).map((l) => ({ id: l.id, n: l.n, mes: doIndice(l.mes), dia: l.entryDate })),
    criar: [],
    darDia: [],
    semDiaConhecido: 0,
    pulada: null,
  };
  const ns = g.map((l) => l.n);
  if (new Set(ns).size !== ns.length) return { ...compra, pulada: "n_repetida" };
  const origens = g.map((l) => l.origem);
  if (Math.max(...origens) - Math.min(...origens) > 1) return { ...compra, pulada: "n_nao_fecham" };
  // (Duas parcelas seguidas no MESMO mês fecham: a fatura antiga ia pro mês do vencimento e a
  // nova vai pro mês da compra + (N - 1), um mês antes. A N+1 num mês anterior ao da N já cai acima.)
  const porN = [...g].sort((a, b) => a.n - b.n);
  if (g.some((l) => l.divididoCom)) return { ...compra, pulada: "dividida_com_alguem" };

  // 1. O dia: o da compra, lido da parcela de menor N que tem dia.
  const comDia = porN.find((l) => l.entryDate);
  for (const l of g) {
    if (l.entryDate || l.loteTipo !== "fatura") continue;
    if (comDia) compra.darDia.push({ id: l.id, userId: l.userId, dia: diaDaParcela(comDia.entryDate!, doIndice(l.mes)) });
    else compra.semDiaConhecido += 1;
  }

  // 2. As que faltam, a partir da mais recente.
  if (base.n >= base.t) return compra;
  if (base.loteTipo !== "fatura" || !base.importBatchId) return { ...compra, pulada: "origem_nao_e_fatura" };
  if (base.loteAberto) return { ...compra, pulada: "origem_print_fatura_aberta" };
  if (base.recurrenceId) return { ...compra, pulada: "origem_repetir_todo_mes" };
  if (!opcoes.incluirJaLidas && importacaoAntigaJaLia(base.desc)) return { ...compra, pulada: "importacao_antiga_ja_projetava" };
  const origemDaCompra = Math.min(...origens);
  if (outrosPerfis.some((l) => mesmaParcela(l.amount, base.amount, base.t) && Math.abs(l.origem - origemDaCompra) <= 1)) {
    return { ...compra, pulada: "mesma_compra_em_outro_perfil" };
  }
  const herda = !ehLojaDeTudo(base.desc);
  for (let n = base.n + 1; n <= base.t; n += 1) {
    // Já existe? Inclusive escrita sem parênteses ("Amazon 10/10", que a importação antiga não lia).
    const existe = ambiguas.some(
      (a) => a.n === n && mesmaParcela(a.amount, base.amount, base.t) && Math.abs(a.origem - origemDaCompra) <= 1,
    );
    if (existe) continue;
    const mes = doIndice(base.mes + (n - base.n));
    compra.criar.push({
      userId: base.userId,
      profileId: base.profileId,
      year: mes.year,
      month: mes.month,
      category: base.category,
      parentCategory: herda && base.category === "EXPENSE" ? base.parentCategory : null,
      customCategoryId: herda ? base.customCategoryId : null,
      subcategory: herda ? base.subcategory : null,
      description: installmentDescription(base.desc, n, base.t),
      amount: base.amount,
      entryDate: comDia ? diaDaParcela(comDia.entryDate!, mes) : null,
      importBatchId: base.importBatchId,
      pessoa: base.pessoa,
      doCasal: base.doCasal,
      soMeu: base.soMeu,
      autorUserId: base.autorUserId,
      noCartao: base.noCartao,
      origemId: base.id,
      parcela: n,
      total: base.t,
    });
  }
  return compra;
}

// ---------------------------------------------------------------------------------------------
// Aplicar e desfazer, sobre um banco qualquer (Prisma no script, memória nos testes)

export type NovoLancamento = Omit<ParcelaACriar, "origemId" | "parcela" | "total">;

/** Só os campos que vão pro banco (origemId, parcela e total são do relatório). */
function semRelatorio(p: ParcelaACriar): NovoLancamento {
  const novo: Partial<ParcelaACriar> = { ...p };
  delete novo.origemId;
  delete novo.parcela;
  delete novo.total;
  return novo as NovoLancamento;
}

export interface BancoDoConserto {
  /** Roda `fn` numa transação: tudo ou nada. */
  transacao<T>(fn: (b: OperacoesDoConserto) => Promise<T>): Promise<T>;
}

export interface OperacoesDoConserto {
  /** Cria e devolve os ids, na mesma ordem. */
  criar(itens: NovoLancamento[]): Promise<string[]>;
  /** Põe o dia só onde entryDate ainda é nulo. Devolve os ids que mudaram. */
  darDia(itens: DiaADar[]): Promise<string[]>;
  /** Apaga pelos ids (e userId). Devolve quantos. */
  apagar(itens: { id: string; userId: string }[]): Promise<number>;
  /** Volta entryDate a nulo onde ainda está no dia que o conserto pôs. Devolve quantos. */
  tirarDia(itens: DiaADar[]): Promise<number>;
}

export type RegistroDoConserto = {
  versao: 1;
  /** Host do banco (sem usuário nem senha). */
  banco: string;
  inicio: string;
  lotes: { em: string; criados: { id: string; userId: string }[]; dias: DiaADar[] }[];
};

/**
 * Aplica o plano em lotes (cada lote uma transação, com as compras inteiras de alguns donos).
 * `aoGravar` recebe o registro depois de CADA lote confirmado: se cair no meio, o registro tem
 * exatamente o que foi gravado, e o desfazer apaga só isso.
 */
export async function aplicarPlano(
  plano: Plano,
  banco: BancoDoConserto,
  registro: RegistroDoConserto,
  aoGravar: (r: RegistroDoConserto) => Promise<void> | void,
  operacoesPorLote = 400,
): Promise<{ criados: number; comDia: number }> {
  const porDono = new Map<string, CompraPlanejada[]>();
  for (const c of plano.compras) {
    if (c.criar.length === 0 && c.darDia.length === 0) continue;
    const k = `${c.userId}|${c.profileId ?? ""}`;
    porDono.set(k, [...(porDono.get(k) ?? []), c]);
  }
  const lotes: CompraPlanejada[][] = [];
  let atual: CompraPlanejada[] = [];
  let ops = 0;
  for (const compras of porDono.values()) {
    atual.push(...compras);
    ops += compras.reduce((s, c) => s + c.criar.length + c.darDia.length, 0);
    if (ops >= operacoesPorLote) {
      lotes.push(atual);
      atual = [];
      ops = 0;
    }
  }
  if (atual.length > 0) lotes.push(atual);

  let criados = 0;
  let comDia = 0;
  for (const lote of lotes) {
    const r = await banco.transacao(async (b) => {
      const dias = await b.darDia(lote.flatMap((c) => c.darDia));
      const novos = lote.flatMap((c) => c.criar).map(semRelatorio);
      const ids = await b.criar(novos);
      return { ids: ids.map((id, i) => ({ id, userId: novos[i].userId })), dias: lote.flatMap((c) => c.darDia).filter((d) => dias.includes(d.id)) };
    });
    registro.lotes.push({ em: new Date().toISOString(), criados: r.ids, dias: r.dias });
    criados += r.ids.length;
    comDia += r.dias.length;
    await aoGravar(registro);
  }
  return { criados, comDia };
}

/** Desfaz o que o registro diz: apaga o que foi criado e tira o dia que foi posto (do último lote ao primeiro). */
export async function desfazerConserto(registro: RegistroDoConserto, banco: BancoDoConserto): Promise<{ apagados: number; semDia: number }> {
  let apagados = 0;
  let semDia = 0;
  for (const lote of [...registro.lotes].reverse()) {
    const r = await banco.transacao(async (b) => ({ apagados: await b.apagar(lote.criados), semDia: await b.tirarDia(lote.dias) }));
    apagados += r.apagados;
    semDia += r.semDia;
  }
  return { apagados, semDia };
}
