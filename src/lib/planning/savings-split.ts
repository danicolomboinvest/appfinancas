export type SavingsTarget = {
  id: string;
  name: string;
  kind: "reserva" | "meta";
  /** Quanto ainda falta pra fechar. */
  remaining: number;
  /** Quanto por mês fecha no prazo (reserva: o aporte combinado; meta: o cálculo da meta). */
  monthlyNeeded: number;
};

export type SavingsSlice = { id: string; name: string; kind: "reserva" | "meta" | "livre"; amount: number };

const cents = (v: number) => Math.round(v * 100) / 100;

/**
 * Pra onde vai o que a pessoa guarda por mês. Ordem: reserva de emergência primeiro (é o que
 * evita dívida num imprevisto), depois as metas por prazo, e o que sobrar fica livre pra
 * liberdade financeira. A reserva não engole tudo: com metas na fila, leva o maior entre o
 * aporte combinado dela e 60% do valor, pra meta não ficar parada meses a fio.
 */
export function splitSavings(amount: number, targets: SavingsTarget[]): { slices: SavingsSlice[]; leftover: number } {
  if (amount <= 0) return { slices: [], leftover: 0 };
  let left = amount;
  const slices: SavingsSlice[] = [];
  const reserva = targets.find((t) => t.kind === "reserva" && t.remaining > 0);
  const metas = targets.filter((t) => t.kind === "meta" && t.remaining > 0);

  if (reserva) {
    // Com metas na fila, a reserva leva entre 60% e 80% do valor (o aporte combinado dela
    // manda dentro dessa faixa); sem metas, leva tudo.
    const cap = metas.length > 0 ? Math.min(amount * 0.8, Math.max(reserva.monthlyNeeded, amount * 0.6)) : amount;
    const take = cents(Math.min(left, reserva.remaining, cap));
    if (take > 0) {
      slices.push({ id: reserva.id, name: reserva.name, kind: "reserva", amount: take });
      left = cents(left - take);
    }
  }
  for (const meta of metas) {
    if (left <= 0) break;
    const take = cents(Math.min(left, meta.remaining, meta.monthlyNeeded > 0 ? meta.monthlyNeeded : left));
    if (take > 0) {
      slices.push({ id: meta.id, name: meta.name, kind: "meta", amount: take });
      left = cents(left - take);
    }
  }
  if (left > 0) slices.push({ id: "livre", name: "Liberdade financeira", kind: "livre", amount: left });
  return { slices, leftover: left };
}
