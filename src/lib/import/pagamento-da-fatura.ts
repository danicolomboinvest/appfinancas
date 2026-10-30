import { parseInstallment } from "@/lib/entries/recurrence";
import { diaDoIso, diasValidos, faturaDe, faturaQueVenceEm, isoDoDia, type Fatura } from "@/lib/cartao/fatura";

/**
 * O pagamento da fatura no extrato: ele é dinheiro mudando de conta QUANDO a fatura que ele paga
 * já está no app, compra por compra. Aí ele fica de fora (ou sai, se a fatura chegou depois).
 *
 * Até 30/10/2026 a regra olhava só a data: "alguma compra à vista de fatura entre 30 e 8 dias antes
 * do pagamento". Sem comparar valor nem escolher a fatura, o Pix que pagava a fatura de SETEMBRO
 * (não importada) sumia porque a fatura de outubro, importada, tinha compras do fim de agosto; o
 * mês ficava mais barato do que foi. E a fatura só de parcelas nunca cobria pagamento nenhum.
 *
 * Regra desde 30/10/2026: o pagamento só casa com UMA fatura do app quando
 *   1. a data dele cabe na janela dessa fatura (do fechamento até ~10 dias depois do vencimento), e
 *   2. o valor pago bate com o total dessa fatura (tolerância pequena: até 1% do total, no máximo
 *      R$ 10). Pagamento mínimo ou parcial não bate, e aí NÃO sai: continua gasto do cartão.
 * Cada fatura paga no máximo um pagamento; cada pagamento casa com no máximo uma fatura.
 *
 * O que é "uma fatura do app":
 *   - lançamento ligado a um cartão com os dias (fechamento e vencimento): a fatura que a regra do
 *     cartão diz (lib/cartao/fatura.ts), com as datas certas. Vale para a fatura importada e para a
 *     compra lançada à mão no cartão ("fechada pelo cartão");
 *   - lote de fatura importada sem cartão com dias, compras com dia: o ciclo das compras (os 31
 *     dias com mais compras; a parcela projetada nos meses seguintes fica de fora). A fatura fecha
 *     depois da última compra e vence uns dias depois: o pagamento cabe da última compra até 25
 *     dias depois dela;
 *   - lote de fatura importada no modelo antigo (tudo num mês, sem dia): o mês em que ela foi
 *     gravada. Ela escolhia o mês ("a fatura que vence em setembro é de agosto"), então o
 *     pagamento pode ser do mês de antes (a partir do dia 20), do mês ou do seguinte.
 *
 * Só a regra, sem banco.
 */

export type LinhaDeFatura = {
  /** O lote de importação (nulo = lançado à mão no cartão). */
  loteId: string | null;
  year: number;
  month: number;
  /** "AAAA-MM-DD" ou nulo (modelo antigo, sem dia). */
  entryDate: string | null;
  /** Com o sinal: a compra positiva, o estorno negativo. */
  valor: number;
  descricao: string | null;
  /** O cartão cadastrado da linha, com os dias, quando tem. */
  cartaoId?: string | null;
  cartao?: { diaFechamento: number | null; diaVencimento: number | null } | null;
};

export type FaturaNoApp = {
  /** "cartao:<id>:<AAAA-MM>" ou "lote:<id>". */
  chave: string;
  /** A janela em que o pagamento dela cai ("AAAA-MM-DD", as duas pontas incluídas). */
  pagavelDe: string;
  pagavelAte: string;
  /** O que a fatura soma no app (compras menos estornos). */
  total: number;
  /** Quantas linhas entram no total. */
  linhas: number;
};

export type PagamentoNoApp = { id: string; data: string; valor: number };

const DIA_MS = 86_400_000;
const instante = (iso: string) => Date.parse(`${iso}T12:00:00Z`);
const isoDoInstante = (t: number) => new Date(t).toISOString().slice(0, 10);
const somarDias = (iso: string, n: number) => isoDoInstante(instante(iso) + n * DIA_MS);
const centavos = (v: number) => Math.round(v * 100) / 100;
const pad = (n: number) => String(n).padStart(2, "0");

/** Dias depois do vencimento em que o pagamento ainda é "desta fatura" (atraso de alguns dias). */
export const DIAS_DEPOIS_DO_VENCIMENTO = 10;
/** Sem o cartão: da última compra do ciclo até quantos dias depois dela o pagamento cabe. */
export const DIAS_DEPOIS_DA_ULTIMA_COMPRA = 25;
/** O ciclo de uma fatura: 31 dias. */
const DIAS_DO_CICLO = 31;

const ehParcela = (descricao: string | null) => Boolean(parseInstallment(descricao)?.confident);

/**
 * O valor pago bate com o total da fatura? Até 1% do total de folga, no máximo R$ 10 e no mínimo
 * R$ 0,05 (arredondamento). O pagamento mínimo (15%) e o parcial ficam de fora de propósito.
 */
export function valorBate(pago: number, total: number): boolean {
  if (!(total > 0) || !(pago > 0)) return false;
  const folga = Math.max(0.05, Math.min(total * 0.01, 10));
  return Math.abs(pago - total) <= folga + 1e-9;
}

function janelaDaFaturaDoCartao(f: Fatura): { pagavelDe: string; pagavelAte: string } {
  return { pagavelDe: isoDoDia(f.fechamento), pagavelAte: somarDias(isoDoDia(f.vencimento), DIAS_DEPOIS_DO_VENCIMENTO) };
}

/** As faturas que as linhas de um lote sem cartão formam (uma só: o ciclo com mais compras). */
function faturaDoLote(loteId: string, linhas: LinhaDeFatura[]): FaturaNoApp | null {
  const comDia = linhas.filter((l) => l.entryDate);
  if (comDia.length === 0) {
    // Modelo antigo: tudo no mês escolhido; a parcela projetada cai nos meses seguintes.
    const primeiro = linhas.reduce((min, l) => (l.year * 12 + l.month < min.year * 12 + min.month ? l : min), linhas[0]);
    const doMes = linhas.filter((l) => l.year === primeiro.year && l.month === primeiro.month);
    const antes = new Date(Date.UTC(primeiro.year, primeiro.month - 2, 20));
    const depois = new Date(Date.UTC(primeiro.year, primeiro.month + 1, 0));
    return {
      chave: `lote:${loteId}`,
      pagavelDe: antes.toISOString().slice(0, 10),
      pagavelAte: depois.toISOString().slice(0, 10),
      total: centavos(doMes.reduce((s, l) => s + l.valor, 0)),
      linhas: doMes.length,
    };
  }
  // Os 31 dias com mais compras: as compras à vista pesam, a parcela (que pode ser projeção de
  // outra fatura ou desta) só acompanha.
  const datas = [...new Set(comDia.map((l) => l.entryDate!))].sort();
  let melhor: { de: string; ate: string; peso: number } | null = null;
  for (const de of datas) {
    const ate = somarDias(de, DIAS_DO_CICLO - 1);
    const dentro = comDia.filter((l) => l.entryDate! >= de && l.entryDate! <= ate);
    const peso = dentro.reduce((s, l) => s + (ehParcela(l.descricao) ? 0.5 : 1), 0);
    if (!melhor || peso > melhor.peso) melhor = { de, ate, peso };
  }
  if (!melhor) return null;
  const { de, ate } = melhor;
  const noCiclo = comDia.filter((l) => l.entryDate! >= de && l.entryDate! <= ate);
  const ultima = noCiclo.reduce((max, l) => (l.entryDate! > max ? l.entryDate! : max), de);
  // A linha sem dia do mesmo lote (compra que caiu no começo do ciclo) entra se o mês dela é um dos do ciclo.
  const mesesDoCiclo = new Set(noCiclo.map((l) => `${l.year}-${pad(l.month)}`));
  const semDia = linhas.filter((l) => !l.entryDate && mesesDoCiclo.has(`${l.year}-${pad(l.month)}`));
  const total = [...noCiclo, ...semDia].reduce((s, l) => s + l.valor, 0);
  return {
    chave: `lote:${loteId}`,
    pagavelDe: ultima,
    pagavelAte: somarDias(ultima, DIAS_DEPOIS_DA_ULTIMA_COMPRA),
    total: centavos(total),
    linhas: noCiclo.length + semDia.length,
  };
}

/** As faturas que estão no app, a partir das linhas de fatura (importadas ou no cartão). */
export function faturasNoApp(linhas: LinhaDeFatura[]): FaturaNoApp[] {
  const doCartao = new Map<string, { janela: { pagavelDe: string; pagavelAte: string }; total: number; linhas: number }>();
  const porLote = new Map<string, LinhaDeFatura[]>();
  for (const l of linhas) {
    if (l.cartaoId && l.cartao && diasValidos(l.cartao)) {
      const dia = l.entryDate ? diaDoIso(l.entryDate) : null;
      const f = dia ? faturaDe(dia, l.cartao) : faturaQueVenceEm(l.year, l.month, l.cartao);
      const chave = `cartao:${l.cartaoId}:${f.chave}`;
      const atual = doCartao.get(chave) ?? { janela: janelaDaFaturaDoCartao(f), total: 0, linhas: 0 };
      atual.total += l.valor;
      atual.linhas += 1;
      doCartao.set(chave, atual);
      continue;
    }
    if (!l.loteId) continue;
    porLote.set(l.loteId, [...(porLote.get(l.loteId) ?? []), l]);
  }
  const faturas: FaturaNoApp[] = [];
  for (const [chave, f] of doCartao) faturas.push({ chave, ...f.janela, total: centavos(f.total), linhas: f.linhas });
  for (const [loteId, ls] of porLote) {
    const f = faturaDoLote(loteId, ls);
    if (f) faturas.push(f);
  }
  return faturas.filter((f) => f.total > 0);
}

/** A fatura que este pagamento paga, ou null: data na janela E valor batendo. Com mais de uma, a de valor mais perto. */
export function faturaQuePaga(pagamento: { data: string; valor: number }, faturas: FaturaNoApp[]): FaturaNoApp | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pagamento.data)) return null;
  const candidatas = faturas.filter((f) => pagamento.data >= f.pagavelDe && pagamento.data <= f.pagavelAte && valorBate(pagamento.valor, f.total));
  if (candidatas.length === 0) return null;
  return candidatas.reduce((a, b) => (Math.abs(b.total - pagamento.valor) < Math.abs(a.total - pagamento.valor) ? b : a));
}

/** A fatura que este pagamento paga já está no app? */
export function pagamentoTemFatura(pagamento: { data: string; valor: number }, faturas: FaturaNoApp[]): boolean {
  return faturaQuePaga(pagamento, faturas) !== null;
}

/**
 * A fatura chegou DEPOIS do extrato: quais pagamentos, já gravados como gasto, são de faturas que
 * agora estão no app e saem. Cada fatura leva no máximo um pagamento (o de valor mais perto; empate,
 * o mais perto do fim da janela, que é o vencimento).
 */
export function pagamentosDaFatura(pagamentos: PagamentoNoApp[], faturas: FaturaNoApp[]): Set<string> {
  const porFatura = new Map<string, { id: string; distancia: number; data: string }>();
  for (const p of pagamentos) {
    const f = faturaQuePaga(p, faturas);
    if (!f) continue;
    const distancia = Math.abs(f.total - p.valor);
    const atual = porFatura.get(f.chave);
    if (!atual || distancia < atual.distancia || (distancia === atual.distancia && p.data > atual.data)) porFatura.set(f.chave, { id: p.id, distancia, data: p.data });
  }
  return new Set([...porFatura.values()].map((x) => x.id));
}

/** Pagamento do cartão no extrato, com a fatura dele já no app: só mudou de conta. */
export const NOTA_PAGAMENTO_COM_FATURA =
  "Pagamento do cartão: só mudou de conta. A fatura já está no app com as compras uma a uma, então ele fica de fora para não contar duas vezes.";
/** …e sem a fatura: entra como gasto do cartão, e a fatura pode vir depois. */
export const NOTA_PAGAMENTO_SEM_FATURA =
  "Pagamento do cartão: entra como gasto em Outros. Se você trouxer a fatura depois, eu separo compra por compra e pergunto se tiro este pagamento.";

/**
 * O que fazer com a linha de pagamento da fatura do extrato. Nunca vira pergunta: com a fatura
 * no app (data e valor batendo) ela fica de fora ("só mudei de conta"); sem, entra como gasto em
 * Outros › Cartão de crédito, já classificada.
 */
export function pagamentoDoCartao(
  pagamento: { data: string; valor: number },
  faturas: FaturaNoApp[],
):
  | { ignorar: true; nota: string }
  | { parentCategory: "OUTROS"; customCategoryId: null; subcategory: string; autoClassified: true; nota: string } {
  return pagamentoTemFatura(pagamento, faturas)
    ? { ignorar: true, nota: NOTA_PAGAMENTO_COM_FATURA }
    : { parentCategory: "OUTROS", customCategoryId: null, subcategory: "Cartão de crédito", autoClassified: true, nota: NOTA_PAGAMENTO_SEM_FATURA };
}
