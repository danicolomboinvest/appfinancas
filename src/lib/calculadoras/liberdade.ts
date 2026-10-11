import { computeAccumulation } from "@/lib/planning/accumulation";
import { computeUsufruct } from "@/lib/planning/usufruct";

/**
 * Liberdade financeira, a calculadora (11/10/2026: a antiga tela de Aposentadoria vira uma
 * calculadora guiada em Calculadoras). As contas são as de sempre, sem mudar nada:
 * `computeAccumulation` (quanto ela chega a ter na idade de parar, em dinheiro de hoje) e
 * `computeUsufruct` (quanto isso paga por mês). Um teste trava os resultados antigos.
 *
 * Os valores são os mesmos campos que a Aposentadoria guardava em PlanningParams (taxas em
 * fração: 0.10 = 10% ao ano), para a Estratégia da Carteira continuar lendo o mesmo lugar.
 */
export type ValoresDaLiberdade = {
  /** Quanto ela quer por mês, em dinheiro de hoje. */
  rendaDesejada: number;
  /** Outra renda que já vai ter (aluguel, INSS). */
  outraRenda: number;
  idade: number;
  idadeParar: number;
  patrimonio: number;
  porMes: number;
  rendimento: number;
  inflacao: number;
  rendimentoNaRenda: number;
};

/** O exemplo de partida (as mesmas taxas do assistente antigo: 10%, 4,5% e 4% ao ano). */
export const EXEMPLO_LIBERDADE: ValoresDaLiberdade = {
  rendaDesejada: 8000,
  outraRenda: 0,
  idade: 35,
  idadeParar: 60,
  patrimonio: 0,
  porMes: 1000,
  rendimento: 0.1,
  inflacao: 0.045,
  rendimentoNaRenda: 0.04,
};

export function contaDaLiberdade(v: ValoresDaLiberdade) {
  const acumulo = computeAccumulation({
    currentAge: v.idade,
    retirementAge: v.idadeParar,
    currentPatrimony: v.patrimonio,
    monthlyContributionAccumulation: v.porMes,
    accumulationAnnualRate: v.rendimento,
    inflationAnnualRate: v.inflacao,
  });
  const renda = computeUsufruct({
    finalValueReal: acumulo.finalValueReal,
    usufructAnnualRate: v.rendimentoNaRenda,
    otherPassiveIncome: v.outraRenda,
    desiredPassiveIncome: v.rendaDesejada,
  });
  return { acumulo, renda, daPe: renda.surplusOrDeficit >= 0, anos: acumulo.years, precisa: patrimonioNecessario(v) };
}

/**
 * Quanto ela precisa ter para a renda que quer: a mesma conta do usufruto ao contrário
 * (renda que falta × 12 ÷ rendimento na fase de viver de renda), em dinheiro de hoje. É o valor da
 * meta "Liberdade financeira". Sem rendimento positivo, não há conta: null.
 */
export function patrimonioNecessario(v: ValoresDaLiberdade): number | null {
  if (!(v.rendimentoNaRenda > 0)) return null;
  return Math.round((Math.max(0, v.rendaDesejada - v.outraRenda) * 12) / v.rendimentoNaRenda);
}

/** O prazo da meta: o mês de hoje, daqui a (idade de parar − idade) anos. */
export function prazoDaLiberdade(v: ValoresDaLiberdade, hoje: Date): { ano: number; mes: number } {
  return { ano: hoje.getFullYear() + Math.max(1, v.idadeParar - v.idade), mes: hoje.getMonth() + 1 };
}

/** Para gravar em PlanningParams (o que a Estratégia da Carteira lê). */
export function paraParametros(v: ValoresDaLiberdade) {
  return {
    currentAge: v.idade,
    retirementAge: v.idadeParar,
    currentPatrimony: v.patrimonio,
    monthlyContributionAccumulation: v.porMes,
    accumulationAnnualRate: v.rendimento,
    inflationAnnualRate: v.inflacao,
    usufructAnnualRate: v.rendimentoNaRenda,
    desiredPassiveIncome: v.rendaDesejada,
    otherPassiveIncome: v.outraRenda,
  };
}

/** De PlanningParams (o que ela já salvou na Aposentadoria antiga) para a calculadora. */
export function deParametros(p: {
  currentAge: number;
  retirementAge: number;
  currentPatrimony: number;
  monthlyContributionAccumulation: number;
  accumulationAnnualRate: number;
  inflationAnnualRate: number;
  usufructAnnualRate: number;
  desiredPassiveIncome: number;
  otherPassiveIncome: number;
}): ValoresDaLiberdade {
  return {
    rendaDesejada: p.desiredPassiveIncome,
    outraRenda: p.otherPassiveIncome,
    idade: p.currentAge,
    idadeParar: p.retirementAge,
    patrimonio: p.currentPatrimony,
    porMes: p.monthlyContributionAccumulation,
    rendimento: p.accumulationAnnualRate,
    inflacao: p.inflationAnnualRate,
    rendimentoNaRenda: p.usufructAnnualRate,
  };
}
