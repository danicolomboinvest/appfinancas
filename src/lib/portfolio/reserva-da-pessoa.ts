/**
 * A reserva da pessoa para a Estratégia e os "Próximos aportes" da Carteira (decisão da dona,
 * 12/10/2026): a meta "Reserva de emergência" (tipo reserva) É a reserva. O que ela tem guardado é
 * o valor da meta e o alvo é o alvo da meta. Quem ainda tem a reserva do simulador antigo
 * (EmergencyFund) fica com o maior dos dois valores guardados. O custo de vida (para "meses de
 * reserva") vem do simulador antigo, ou do gasto típico do mês quando só existe a meta.
 */
export type MetaParaReserva = { icon: string; name: string; targetAmount: number; atual: number };
export type ReservaAntiga = { atual: number; alvo: number; custoDeVida: number };
export type ReservaDaPessoa = { atual: number; meta: number; custoDeVida: number; idDaMeta: string | null };

/** A meta que é a reserva: o tipo reserva; sem nenhuma, a de nome "reserva". */
export function acharMetaDaReserva<T extends { icon: string; name: string }>(metas: T[]): T | null {
  return metas.find((m) => m.icon === "RESERVA") ?? metas.find((m) => /reserva/i.test(m.name)) ?? null;
}

export function reservaDaPessoa(e: {
  meta: (MetaParaReserva & { id: string }) | null;
  antiga: ReservaAntiga | null;
  /** Os ativos marcados "reserva de emergência" na Carteira (contavam junto com a antiga). */
  naCarteira?: number;
  /** Gasto típico do mês, para os meses de reserva quando não há o simulador antigo. */
  gastoTipico?: number | null;
}): ReservaDaPessoa | null {
  const antigaAtual = e.antiga ? Math.max(e.antiga.atual, e.naCarteira ?? 0) : null;
  if (e.meta) {
    return {
      atual: Math.max(e.meta.atual, antigaAtual ?? 0),
      meta: e.meta.targetAmount,
      custoDeVida: e.antiga && e.antiga.custoDeVida > 0 ? e.antiga.custoDeVida : Math.max(0, e.gastoTipico ?? 0),
      idDaMeta: e.meta.id,
    };
  }
  if (e.antiga) return { atual: antigaAtual ?? 0, meta: e.antiga.alvo, custoDeVida: e.antiga.custoDeVida, idDaMeta: null };
  return null;
}
