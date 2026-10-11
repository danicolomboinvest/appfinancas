import type { StrategyAssetClass } from "@prisma/client";
import { planContribution, type ClassGap } from "./contribution-plan";
import { PARTE_DA_RESERVA, regraDosAportes } from "@/lib/planning/savings-split";

/**
 * "Seus próximos aportes" na Estratégia (pedido da Dani, 11/10/2026): o que fazer com o próximo
 * dinheiro para seguir a estratégia dela. Nunca manda vender: só divide o dinheiro NOVO.
 *
 * Reserva primeiro, pela regra dos aportes (savings-split.ts): com menos de 3 meses de reserva,
 * 100% vai para ela; de 3 meses até a meta, 70% reserva e 30% para as classes; reserva completa
 * (ou sem reserva montada), tudo para as classes. Nas classes, vai para as que estão mais abaixo
 * do alvo; se tudo já está no alvo, divide pelos pesos do alvo (planContribution).
 */
export type DivisaoDoAporte = {
  reserva: number;
  classes: { classe: StrategyAssetClass; valor: number; hoje: number; depois: number; alvo: number }[];
  /** A linha do por quê (curta). */
  porque: string;
  faixa: "curta" | "montando" | "completa" | "sem_reserva";
};

const c2 = (v: number) => Math.round(v * 100) / 100;

export function dividirProximoAporte(input: {
  valor: number;
  posicoes: ClassGap[];
  /** Meses que a reserva cobre; null sem custo de vida conhecido. Sem reserva montada: `semReserva`. */
  mesesDeReserva: number | null;
  reservaCompleta: boolean;
  semReserva?: boolean;
  nomes: Record<StrategyAssetClass, string>;
}): DivisaoDoAporte {
  const valor = c2(Math.max(0, input.valor));
  const regra = input.semReserva ? null : regraDosAportes(input.mesesDeReserva, input.reservaCompleta);
  const faixa = regra ? regra.faixa : "sem_reserva";
  const reserva = regra ? c2(valor * (regra.reserva / 100)) : 0;
  const paraClasses = c2(valor - reserva);
  const total = input.posicoes.reduce((s, p) => s + p.currentValue, 0);
  const fatias = paraClasses > 0 ? planContribution(input.posicoes, paraClasses) : [];
  const novoTotal = total + paraClasses;
  const classes = fatias
    .filter((f) => f.amount > 0)
    .map((f) => {
      const p = input.posicoes.find((x) => x.assetClass === f.assetClass)!;
      return {
        classe: f.assetClass,
        valor: c2(f.amount),
        hoje: total > 0 ? p.currentValue / total : 0,
        depois: novoTotal > 0 ? (p.currentValue + f.amount) / novoTotal : 0,
        alvo: p.targetPercent,
      };
    });

  let porque: string;
  if (faixa === "curta") {
    porque = input.mesesDeReserva === null ? "Sua reserva vem primeiro: até cobrir 3 meses, todo aporte vai para ela." : `Sua reserva cobre ${input.mesesDeReserva.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${input.mesesDeReserva >= 1.95 ? "meses" : "mês"}. Até 3 meses, todo aporte vai para ela.`;
  } else {
    const abaixo = input.posicoes
      .map((p) => ({ p, gap: p.targetPercent - (total > 0 ? p.currentValue / total : 0) }))
      .sort((a, b) => b.gap - a.gap)[0];
    const pontos = abaixo ? Math.round(abaixo.gap * 100) : 0;
    porque =
      abaixo && pontos >= 1
        ? `${input.nomes[abaixo.p.assetClass]} está ${pontos} ${pontos === 1 ? "ponto" : "pontos"} abaixo do seu alvo.`
        : "Tudo no alvo: o aporte segue os pesos da sua estratégia.";
    if (faixa === "montando") porque = `${Math.round(PARTE_DA_RESERVA * 100)}% ainda vai para a reserva. ${porque}`;
  }
  return { reserva, classes, porque, faixa };
}
