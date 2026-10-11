export type SavingsTarget = {
  id: string;
  name: string;
  kind: "reserva" | "meta";
  /** Quanto ainda falta pra fechar. */
  remaining: number;
  /** Quanto por mês fecha no prazo (reserva: o aporte combinado; meta: o cálculo da meta). */
  monthlyNeeded: number;
  /**
   * Só na reserva: quantos meses do custo de vida ela já cobre (reserva atual ÷ custo de vida).
   * É o que decide a regra dos aportes. Sem o número (custo de vida desconhecido), a reserva
   * é tratada como curta: o dinheiro do imprevisto vem antes.
   */
  monthsCovered?: number;
};

export type SavingsSlice = { id: string; name: string; kind: "reserva" | "meta" | "livre"; amount: number };

const cents = (v: number) => Math.round(v * 100) / 100;

/** Abaixo disto a reserva é curta e leva todo o dinheiro novo (regra 3.11, rodada 22). */
export const MESES_RESERVA_CURTA = 3;
/** De 3 meses até a meta da reserva: esta parte vai para a reserva e o resto para as metas. */
export const PARTE_DA_RESERVA = 0.7;

/** Quantos meses do custo de vida a reserva cobre. Sem custo de vida, não dá para dizer: null. */
export function mesesDeReserva(reservaAtual: number, custoDeVidaMensal: number): number | null {
  if (!(custoDeVidaMensal > 0)) return null;
  return Math.max(0, reservaAtual) / custoDeVidaMensal;
}

export type RegraDosAportes = {
  /** Parte do dinheiro NOVO que vai para a reserva, em %: 100, 70 ou 0. */
  reserva: 100 | 70 | 0;
  /** O resto, para as metas e a liberdade: 0, 30 ou 100. */
  sonhos: 0 | 30 | 100;
  faixa: "curta" | "montando" | "completa";
};

/**
 * A regra do dinheiro novo (não mexe na carteira já montada):
 * - reserva com menos de 3 meses do custo de vida: 100% para ela;
 * - de 3 meses até a meta da reserva: 70% reserva, 30% metas;
 * - reserva na meta (ou acima): 0% reserva, 100% metas e liberdade.
 * `meses` nulo (sem custo de vida) conta como reserva curta.
 */
export function regraDosAportes(meses: number | null, reservaCompleta: boolean): RegraDosAportes {
  if (reservaCompleta) return { reserva: 0, sonhos: 100, faixa: "completa" };
  if (meses === null || meses < MESES_RESERVA_CURTA) return { reserva: 100, sonhos: 0, faixa: "curta" };
  return { reserva: 70, sonhos: 30, faixa: "montando" };
}

/**
 * Pra onde vai o que a pessoa guarda por mês. A reserva de emergência segue a regra dos aportes
 * (acima); depois as metas por prazo, cada uma até o que precisa no mês; o que sobrar fica livre
 * pra liberdade financeira.
 *
 * Reserva curta: leva tudo, até o que falta pra ela. Se completar no meio do caminho, o resto
 * segue para as metas. Reserva montando (3 meses ou mais): leva 70%; o que as metas não usarem
 * dos 30% volta para a reserva antes de virar liberdade, porque ela ainda não está pronta.
 */
export function splitSavings(amount: number, targets: SavingsTarget[]): { slices: SavingsSlice[]; leftover: number } {
  // Reparte em centavos desde o começo: sem isso, um valor abaixo de meio centavo (0,004)
  // passava do "> 0" e virava uma fatia "livre" de fração de centavo.
  const total = cents(amount);
  if (total <= 0) return { slices: [], leftover: 0 };
  let left = total;
  const slices: SavingsSlice[] = [];
  const reserva = targets.find((t) => t.kind === "reserva" && t.remaining > 0);
  const metas = targets.filter((t) => t.kind === "meta" && t.remaining > 0);
  let daReserva = 0;

  if (reserva) {
    const regra = regraDosAportes(reserva.monthsCovered ?? null, false);
    const cap = regra.reserva === 100 || metas.length === 0 ? total : total * PARTE_DA_RESERVA;
    daReserva = cents(Math.min(left, reserva.remaining, cap));
    left = cents(left - daReserva);
  }
  const fatiasDeMeta: SavingsSlice[] = [];
  for (const meta of metas) {
    if (left <= 0) break;
    const take = cents(Math.min(left, meta.remaining, meta.monthlyNeeded > 0 ? meta.monthlyNeeded : left));
    if (take > 0) {
      fatiasDeMeta.push({ id: meta.id, name: meta.name, kind: "meta", amount: take });
      left = cents(left - take);
    }
  }
  // O que as metas não usaram volta para a reserva que ainda não está pronta.
  if (reserva && left > 0) {
    const volta = cents(Math.min(left, reserva.remaining - daReserva));
    if (volta > 0) {
      daReserva = cents(daReserva + volta);
      left = cents(left - volta);
    }
  }
  if (reserva && daReserva > 0) slices.push({ id: reserva.id, name: reserva.name, kind: "reserva", amount: daReserva });
  slices.push(...fatiasDeMeta);
  if (left > 0) slices.push({ id: "livre", name: "Liberdade financeira", kind: "livre", amount: left });
  return { slices, leftover: left };
}
