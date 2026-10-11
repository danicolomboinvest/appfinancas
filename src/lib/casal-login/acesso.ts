import { GUARDADO_SEM_RENOVAR_MS } from "./regras";

/**
 * O par entra grátis: o acesso dele vale enquanto o Casal da titular valer (o app dela ativo e o
 * adicional "Conta do parceiro"). Se ela não renovar, o par perde o acesso na hora e o histórico
 * fica guardado 90 dias: nesse tempo ele ainda baixa a cópia do que lançou, e se ela renovar tudo
 * volta como estava. Passados os 90 dias, ele sai de vez (ver limparParesVencidos).
 */

export type SituacaoDoPar =
  | { tipo: "liberado" }
  | { tipo: "pausado"; desde: Date; ate: Date }
  | { tipo: "encerrado" };

export function decidirSituacaoDoPar(d: {
  /** O app da titular está valendo (compra ativa, ou ela é admin). */
  titularAtiva: boolean;
  /** A titular tem o adicional da conta do parceiro (hoje sempre, até a cobrança ligar). */
  temAdicional: boolean;
  /** Primeira vez que o app viu o Casal sem valer (MembroCasal.bloqueadoEm). */
  bloqueadoEm: Date | null;
  agora: Date;
}): SituacaoDoPar {
  if (d.titularAtiva && d.temAdicional) return { tipo: "liberado" };
  const desde = d.bloqueadoEm ?? d.agora;
  const ate = new Date(desde.getTime() + GUARDADO_SEM_RENOVAR_MS);
  if (d.agora.getTime() >= ate.getTime()) return { tipo: "encerrado" };
  return { tipo: "pausado", desde, ate };
}

/** Ainda dá pra baixar a cópia do que ele lançou? Depois de sair, os mesmos 90 dias. */
export function podeBaixarCopia(saiuEm: Date | null, agora: Date): boolean {
  if (!saiuEm) return true;
  return agora.getTime() < saiuEm.getTime() + GUARDADO_SEM_RENOVAR_MS;
}
