import type { AssetClass, FixedIncomeIndex } from "@prisma/client";
import { dataDoDia, dia, diaDe, diasUteis } from "./calendario-anbima";

/**
 * Quanto vale HOJE uma renda fixa ou um título do Tesouro, pela taxa que ela cadastrou e pelos
 * índices do Banco Central (decisão da Dani, 15/10/2026). É a fonte única: o cron de indicadores,
 * a abertura da Carteira e o Novo ativo chamam estas funções, gravam o resultado em
 * Asset.currentValue, e todas as telas (Carteira, metas, Reserva, Estratégia) leem só ele.
 *
 * Valor BRUTO, antes do IR (o IR não é calculado aqui).
 *
 * Fórmulas, em [início, fim): o dia da compra conta, o dia do cálculo não.
 * - Pós-fixado (CDI): investido × ∏(1 + CDI_dia × percentual), cada dia útil com CDI publicado
 *   (série 12 do BC, que só tem dias úteis), da compra até o último dia com dado.
 * - IPCA+: investido × ∏(1 + IPCA_mês)^(du_no_mês / du_do_mês) × (1 + taxa real)^(du / 252). Mês
 *   inteiro entra inteiro; o da compra e o corrente entram pró-rata pelos dias úteis. Mês sem IPCA
 *   divulgado ainda (o corrente e, até o dia ~10, o anterior) usa o último IPCA conhecido e o
 *   resultado fica marcado como estimado.
 * - Prefixado: investido × (1 + taxa)^(du / 252), du pelo calendário ANBIMA (calendario-anbima.ts).
 * - Sem taxa ("Não sei a taxa"): 100% do CDI, marcado como estimado.
 * - Tesouro com a quantidade de títulos: quantidade × preço do dia (feito por quem chama, ver
 *   atualizar-renda-fixa.ts); sem a quantidade, a fórmula do indexador.
 *
 * Aportes e resgates no mesmo ativo (ContributionAllocation, positiva ou negativa): cada um rende
 * da SUA data até hoje, por superposição. Como os fatores se multiplicam (F(a,c) = F(a,b)·F(b,c)),
 * isso é exatamente igual a seguir o saldo dia a dia: o resgate tira R e o que sobrou continua
 * rendendo. O app não guarda o valor da primeira compra, só o investido de hoje (o "Resgatei"
 * reduz o investido na proporção do resgate); `principalDaCompra` refaz a conta de trás para a
 * frente com a mesma regra para achar o valor da compra.
 */

/** Um ponto da série, já em FRAÇÃO: o CDI de um dia (0.00055131) ou o IPCA de um mês (0.0082). */
export type PontoDoIndice = { dia: number; valor: number };

export type Series = {
  /** CDI de cada dia útil, em ordem de data. */
  cdi: PontoDoIndice[];
  /** IPCA de cada mês, datado no dia 1 do mês, em ordem de data. */
  ipca: PontoDoIndice[];
};

export type ComoRende =
  | { como: "cdi"; percentual: number; semTaxa: boolean }
  | { como: "ipca"; taxa: number }
  | { como: "pre"; taxa: number };

/** Aporte (valor > 0) ou resgate (valor < 0) no ativo, no dia em que aconteceu. */
export type Movimento = { dia: number; valor: number };

export type Fator = { fator: number; ate: number | null; estimado: boolean };

/** O que a tela e o banco recebem do cálculo. */
export type Rendimento = {
  valor: number;
  /** O último dia do índice usado: o último CDI, o dia 1 do último IPCA divulgado, ou o dia do cálculo no prefixado. */
  referenteA: number;
  como: "cdi" | "ipca" | "pre";
  estimado: boolean;
};

const POUPANCA = /poupan/i;

/**
 * Como o ativo rende, pelo que ela cadastrou. Poupança fica de fora (rende 0,5% ao mês + TR ou
 * 70% da Selic, regra própria que este cálculo não faz): devolve null e o valor fica como está.
 */
export function comoRendeDoAtivo(a: { name: string; assetClass: AssetClass | string; fixedIncomeIndex: FixedIncomeIndex | string | null; taxaCompra: number | null }): ComoRende | null {
  if (a.assetClass !== "RENDA_FIXA" && a.assetClass !== "TESOURO_DIRETO") return null;
  if (POUPANCA.test(a.name)) return null;
  const tesouroSelic = a.assetClass === "TESOURO_DIRETO" && (a.fixedIncomeIndex === "POS_FIXADO" || /selic/i.test(a.name));
  // O Tesouro Selic não pergunta a taxa: rende a Selic, que anda colada no CDI.
  if (tesouroSelic) return { como: "cdi", percentual: 1, semTaxa: false };
  if (a.taxaCompra === null || !(a.taxaCompra > 0)) return { como: "cdi", percentual: 1, semTaxa: true };
  if (a.fixedIncomeIndex === "IPCA") return { como: "ipca", taxa: a.taxaCompra };
  if (a.fixedIncomeIndex === "PREFIXADO") return { como: "pre", taxa: a.taxaCompra };
  return { como: "cdi", percentual: a.taxaCompra, semTaxa: false };
}

/** Primeiro índice com dia >= alvo (busca binária). */
function primeiroDesde(serie: PontoDoIndice[], alvo: number): number {
  let lo = 0;
  let hi = serie.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (serie[m].dia < alvo) lo = m + 1;
    else hi = m;
  }
  return lo;
}

/**
 * ∏(1 + CDI_dia × percentual) nos dias com CDI em [desde, ate). `ate` do resultado é o último dia
 * com CDI antes de `ate` (o "CDI de 14/10" da tela). Sem série que cubra a compra (a série começa
 * mais de 7 dias depois dela), devolve null: faltariam dias e o valor sairia menor do que é.
 */
export function fatorCdi(cdi: PontoDoIndice[], percentual: number, desde: number, ate: number): Fator | null {
  if (cdi.length === 0) return null;
  if (cdi[0].dia > desde + 7) return null;
  let fator = 1;
  let i = primeiroDesde(cdi, desde);
  for (; i < cdi.length && cdi[i].dia < ate; i++) fator *= 1 + cdi[i].valor * percentual;
  const ultimo = primeiroDesde(cdi, ate) - 1;
  return { fator, ate: ultimo >= 0 ? cdi[ultimo].dia : null, estimado: false };
}

const mesDe = (d: number) => {
  const x = dataDoDia(d);
  return { ano: x.getUTCFullYear(), mes: x.getUTCMonth() + 1 };
};

/**
 * ∏(1 + IPCA_mês)^(dias úteis do período no mês / dias úteis do mês) em [desde, ate). Mês ainda
 * sem IPCA divulgado usa o último conhecido (estimado = true). Mês ANTES do primeiro da série:
 * null (a série não cobre a compra).
 */
export function fatorIpca(ipca: PontoDoIndice[], desde: number, ate: number): Fator | null {
  if (ipca.length === 0) return null;
  if (ate <= desde) return { fator: 1, ate: ipca[ipca.length - 1].dia, estimado: false };
  const porMes = new Map(ipca.map((p) => [p.dia, p.valor]));
  const ultimo = ipca[ipca.length - 1];
  let fator = 1;
  let estimado = false;
  let usado: number | null = null;
  let { ano, mes } = mesDe(desde);
  for (;;) {
    const inicioDoMes = dia(ano, mes, 1);
    if (inicioDoMes >= ate) break;
    const proximo = mes === 12 ? dia(ano + 1, 1, 1) : dia(ano, mes + 1, 1);
    const parte = diasUteis(Math.max(desde, inicioDoMes), Math.min(ate, proximo));
    if (parte > 0) {
      let v = porMes.get(inicioDoMes);
      if (v === undefined) {
        if (inicioDoMes < ipca[0].dia) return null;
        // Depois do último divulgado: o último conhecido. Buraco no meio da série: não inventa.
        if (inicioDoMes < ultimo.dia) return null;
        v = ultimo.valor;
        estimado = true;
        usado = ultimo.dia;
      } else if (usado === null || inicioDoMes > usado) usado = inicioDoMes;
      fator *= Math.pow(1 + v, parte / diasUteis(inicioDoMes, proximo));
    }
    mes += 1;
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
  }
  return { fator, ate: usado ?? ultimo.dia, estimado };
}

/** (1 + taxa)^(dias úteis / 252) em [desde, ate). */
export function fatorPre(taxa: number, desde: number, ate: number): Fator {
  return { fator: Math.pow(1 + taxa, diasUteis(desde, ate) / 252), ate: ate - 1, estimado: false };
}

/** O fator de [desde, ate) para o jeito que o ativo rende. */
export function fatorDoPeriodo(rende: ComoRende, series: Series, desde: number, ate: number): Fator | null {
  if (rende.como === "cdi") {
    const f = fatorCdi(series.cdi, rende.percentual, desde, ate);
    return f && { ...f, estimado: rende.semTaxa };
  }
  if (rende.como === "pre") return fatorPre(rende.taxa, desde, ate);
  const inflacao = fatorIpca(series.ipca, desde, ate);
  if (!inflacao) return null;
  return { fator: inflacao.fator * fatorPre(rende.taxa, desde, ate).fator, ate: inflacao.ate, estimado: inflacao.estimado };
}

/**
 * O valor na data `ate` partindo de um valor conhecido num dia (a compra, ou o valor que ela
 * informou), mais os aportes e resgates DEPOIS dessa base, cada um rendendo da própria data.
 * Movimento antes da base conta como feito na base. Nunca abaixo de zero.
 */
export function valorPeloIndice(input: { base: { dia: number; valor: number }; movimentos: Movimento[]; rende: ComoRende; series: Series; ate: number }): Rendimento | null {
  const { base, movimentos, rende, series, ate } = input;
  const principal = fatorDoPeriodo(rende, series, base.dia, ate);
  if (!principal || principal.ate === null) return null;
  let valor = base.valor * principal.fator;
  let estimado = principal.estimado;
  for (const m of movimentos) {
    const f = fatorDoPeriodo(rende, series, Math.max(m.dia, base.dia), ate);
    if (!f) return null;
    valor += m.valor * f.fator;
    estimado ||= f.estimado;
  }
  return { valor: Math.max(0, Math.round(valor * 100) / 100), referenteA: principal.ate, como: rende.como, estimado };
}

/**
 * Quanto ela pôs na COMPRA, a partir do investido de hoje. O app soma o aporte ao investido e, no
 * resgate, tira do investido a mesma fração que saiu do valor (assetAfterWithdrawal). Sem
 * resgate: investido − aportes. Com resgate, a fração depende do valor naquele dia, que depende da
 * compra: busca o valor da compra que reproduz o investido de hoje (a conta é crescente nele).
 *
 * Null quando não fecha (ela editou o investido à mão e os aportes não batem mais): aí quem chama
 * usa o investido de hoje como a compra e ignora os movimentos (aproximação documentada).
 */
export function principalDaCompra(input: { investido: number; compra: number; movimentos: Movimento[]; rende: ComoRende; series: Series }): number | null {
  const { investido, compra, rende, series } = input;
  const movimentos = [...input.movimentos].sort((a, b) => a.dia - b.dia);
  const aportes = movimentos.filter((m) => m.valor > 0).reduce((s, m) => s + m.valor, 0);
  if (!movimentos.some((m) => m.valor < 0)) {
    const p = investido - aportes;
    return p > 0.005 ? Math.round(p * 100) / 100 : null;
  }
  const investidoNoFim = (p: number): number | null => {
    let inv = p;
    for (let i = 0; i < movimentos.length; i++) {
      const m = movimentos[i];
      if (m.valor > 0) {
        inv += m.valor;
        continue;
      }
      const antes = valorPeloIndice({ base: { dia: compra, valor: p }, movimentos: movimentos.slice(0, i), rende, series, ate: Math.max(m.dia, compra) });
      if (!antes) return null;
      const fracao = antes.valor > 0 ? Math.min(1, -m.valor / antes.valor) : 1;
      inv *= 1 - fracao;
    }
    return inv;
  };
  let lo = 0;
  let hi = Math.max(investido, 1) * 20 + movimentos.reduce((s, m) => s + Math.abs(m.valor), 0) * 20;
  const noTopo = investidoNoFim(hi);
  if (noTopo === null || noTopo < investido) return null;
  for (let k = 0; k < 80; k++) {
    const meio = (lo + hi) / 2;
    const r = investidoNoFim(meio);
    if (r === null) return null;
    if (r < investido) lo = meio;
    else hi = meio;
  }
  const p = Math.round(hi * 100) / 100;
  return p > 0.005 ? p : null;
}

/**
 * O cálculo inteiro de um ativo: escolhe a base (o valor que ela informou ou a compra), acha o
 * valor da compra quando precisa e aplica os movimentos. Null = não dá para calcular (sem data,
 * sem série, poupança): o valor do ativo fica como está.
 */
export function rendimentoDoAtivo(input: {
  ativo: { name: string; assetClass: AssetClass | string; fixedIncomeIndex: FixedIncomeIndex | string | null; taxaCompra: number | null; investedValue: number | null };
  /** O dia da compra (dia 1 do mês quando ela não disse o dia). */
  compra: number | null;
  /** O valor que ela informou e o dia, quando há. */
  informado: { dia: number; valor: number } | null;
  /** Todos os aportes e resgates do ativo, com o dia em que aconteceram e se vieram depois do informado. */
  movimentos: (Movimento & { depoisDoInformado: boolean })[];
  series: Series;
  ate: number;
}): Rendimento | null {
  const rende = comoRendeDoAtivo(input.ativo);
  if (!rende) return null;
  if (input.informado) {
    return valorPeloIndice({ base: input.informado, movimentos: input.movimentos.filter((m) => m.depoisDoInformado), rende, series: input.series, ate: input.ate });
  }
  if (input.compra === null || input.compra >= input.ate || input.ativo.investedValue === null || !(input.ativo.investedValue > 0)) return null;
  const movimentos = input.movimentos.map((m) => ({ dia: m.dia, valor: m.valor }));
  const p = movimentos.length ? principalDaCompra({ investido: input.ativo.investedValue, compra: input.compra, movimentos, rende, series: input.series }) : input.ativo.investedValue;
  if (p === null) return valorPeloIndice({ base: { dia: input.compra, valor: input.ativo.investedValue }, movimentos: [], rende, series: input.series, ate: input.ate });
  return valorPeloIndice({ base: { dia: input.compra, valor: p }, movimentos, rende, series: input.series, ate: input.ate });
}

/** Série do banco (valor em %) para a conta (valor em fração), em ordem de data. */
export function serieEmFracao(linhas: { data: Date; valor: number }[]): PontoDoIndice[] {
  return linhas.map((l) => ({ dia: diaDe(l.data), valor: l.valor / 100 })).sort((a, b) => a.dia - b.dia);
}
