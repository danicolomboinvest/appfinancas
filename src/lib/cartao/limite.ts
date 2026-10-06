/**
 * Limite do cartão (06/10/2026). Cliente: "somos autônomos, renda variável; o cartão é o ponto
 * fraco; quero colocar o limite de quanto podemos gastar no mês no cartão e ser avisada de quanto
 * falta para não passar".
 *
 * O que conta como cartão: o gasto que ela marcou "no cartão" ao lançar e a linha de fatura
 * importada (que vem do cartão por definição, mesmo as importadas antes de existir a marcação).
 * Marcar "não foi no cartão" numa linha de fatura tira ela da conta. O mês é o mesmo que o app já
 * usa em todo lugar (year/month do lançamento): a compra lançada à mão conta no mês da compra; a
 * linha de fatura, no mês da fatura, como já aparece em Gastos.
 *
 * Sem banco aqui: as contas e as regras, para testar.
 */

/** Os avisos: um de cada, por mês. */
export const MARCOS_DO_LIMITE = [70, 90, 100] as const;
export type Marco = (typeof MARCOS_DO_LIMITE)[number];

/** "ok" até 70%, "atencao" de 70% a 90%, "perto" de 90% a 100%, "passou" de 100% em diante. */
export type NivelDoLimite = "ok" | "atencao" | "perto" | "passou";

export type SituacaoDoLimite = {
  limite: number;
  gasto: number;
  /** Quanto ainda cabe. Negativo quando passou. */
  falta: number;
  /** Do limite já usado, de 0 em diante (passa de 100 quando estoura). */
  pct: number;
  nivel: NivelDoLimite;
};

/** O lançamento conta no cartão? Marcação dela primeiro; sem marcação, a origem (fatura). */
export function ehDoCartao(e: { noCartao: boolean | null; importBatch?: { docType: string } | null }): boolean {
  if (e.noCartao !== null) return e.noCartao;
  return e.importBatch?.docType === "fatura";
}

export function situacaoDoLimite(gasto: number, limite: number): SituacaoDoLimite {
  const g = Math.round(gasto * 100) / 100;
  const pct = limite > 0 ? (g / limite) * 100 : 0;
  const nivel: NivelDoLimite = pct >= 100 ? "passou" : pct >= 90 ? "perto" : pct >= 70 ? "atencao" : "ok";
  return { limite, gasto: g, falta: Math.round((limite - g) * 100) / 100, pct, nivel };
}

/** Os marcos que o gasto já alcançou (70, 90, 100), do menor para o maior. */
export function marcosAlcancados(gasto: number, limite: number): Marco[] {
  if (!(limite > 0)) return [];
  const pct = (gasto / limite) * 100;
  return MARCOS_DO_LIMITE.filter((m) => pct >= m);
}

/**
 * O aviso a mandar agora: o MAIOR marco alcançado que ainda não foi avisado neste mês. Quem pula
 * de 60% para 95% numa compra só recebe o de 90%, não dois seguidos; os menores ficam marcados
 * como avisados junto (`marcar`), para não chegarem atrasados depois.
 */
export function avisoDevido(gasto: number, limite: number, jaAvisados: ReadonlySet<Marco>): { marco: Marco; marcar: Marco[] } | null {
  const alcancados = marcosAlcancados(gasto, limite);
  const maior = alcancados[alcancados.length - 1];
  if (maior === undefined || jaAvisados.has(maior)) return null;
  return { marco: maior, marcar: alcancados.filter((m) => !jaAvisados.has(m)) };
}

/** Chave do aviso no NotificationLog: uma por perfil, mês e marco. */
export function chaveDoAviso(profileId: string, ano: number, mes: number, marco: Marco): string {
  return `cartao:${profileId}:${ano}-${String(mes).padStart(2, "0")}:${marco}`;
}
