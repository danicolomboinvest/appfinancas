import { simulateFinancingVsRent } from "@/lib/simulators/financing-vs-rent";
import { simulateAmortizeVsInvest } from "@/lib/simulators/amortize-vs-invest";
import { simulateConsortiumVsFinancing } from "@/lib/simulators/consortium";
import { simulateCarComparison } from "@/lib/simulators/car";
import { simulateMarkToMarket } from "@/lib/simulators/mark-to-market";
import { annualToMonthly } from "@/lib/finance/rate-conversion";
import {
  entradaAmortizar,
  entradaCarro,
  entradaConsorcio,
  entradaFinanciar,
  entradaMarcacao,
  type ValoresDaCalculadora,
} from "./entradas";

/**
 * O que a tela mostra de cada resultado (versão nova, 11/10/2026). Só LÊ o que as contas de
 * `lib/simulators/*` devolvem e escolhe as palavras: nenhuma conta nova mora aqui.
 *
 * - `frase`: o veredito curto do herói ("Financiar vence").
 * - `numero`: a diferença a favor de quem venceu, sempre positiva.
 * - `barras`: os dois caminhos, com o vencedor marcado.
 */
export type Barra = { chave: string; rotulo: string; valor: number; vence: boolean };

export type Veredito = {
  erro?: string;
  frase: string;
  numero: number;
  barras: Barra[];
  /** Nas contas de custo (consórcio, carro) a barra menor é a que vence. */
  menorVence: boolean;
};

export const PRAZO_FINANCIAR_INVALIDO = "Informe o prazo do financiamento, em meses";
export const PRAZOS_CONSORCIO_INVALIDOS = "Informe os dois prazos, em meses";

export function vereditoFinanciar(v: ValoresDaCalculadora) {
  const r = simulateFinancingVsRent(entradaFinanciar(v));
  const financia = r.winner === "FINANCIAR";
  const veredito: Veredito = r.invalidTerm
    ? { erro: PRAZO_FINANCIAR_INVALIDO, frase: PRAZO_FINANCIAR_INVALIDO, numero: 0, barras: [], menorVence: false }
    : {
        frase: financia ? "Financiar vence" : "Alugar e investir vence",
        numero: Math.abs(r.finalFinancingPatrimony - r.finalInvestedPatrimony),
        barras: [
          { chave: "fin", rotulo: "Financiar", valor: r.finalFinancingPatrimony, vence: financia },
          { chave: "alu", rotulo: "Alugar", valor: r.finalInvestedPatrimony, vence: !financia },
        ],
        menorVence: false,
      };
  // Ano a ano: o patrimônio de cada lado no fim de cada ano (e no último mês, se o prazo não fecha o ano).
  const anos = [{ ano: 0, financiar: Number(v.downPayment), alugar: Number(v.downPayment) }];
  for (const m of r.schedule) {
    if (m.month % 12 === 0 || m.month === r.schedule.length) anos.push({ ano: Math.ceil(m.month / 12), financiar: m.financingPatrimony, alugar: m.investedPatrimony });
  }
  return { r, veredito, anos, primeiraParcela: r.schedule[0]?.installment ?? 0 };
}

export function vereditoAmortizar(v: ValoresDaCalculadora) {
  const r = simulateAmortizeVsInvest(entradaAmortizar(v));
  const quita = r.winner === "AMORTIZAR";
  const veredito: Veredito = {
    frase: quita ? "Amortizar vence" : "Investir vence",
    numero: r.differenceInFavorOfWinner,
    barras: [
      { chave: "amo", rotulo: "Amortizar", valor: r.amortizeGain, vence: quita },
      { chave: "inv", rotulo: "Investir", valor: r.investmentGain, vence: !quita },
    ],
    menorVence: false,
  };
  // Para a frase "a dívida custa X% ao mês, o dinheiro rende Y% ao mês": só conversão de taxa.
  const dividaAoMes = annualToMonthly(Number(v.cetAnnualRate)).toNumber();
  const rendeAoMes = annualToMonthly(r.netInvestmentAnnualRate).toNumber();
  return { r, veredito, dividaAoMes, rendeAoMes };
}

export function vereditoConsorcio(v: ValoresDaCalculadora) {
  const r = simulateConsortiumVsFinancing(entradaConsorcio(v));
  const consorcio = r.winner === "CONSORCIO";
  const veredito: Veredito = r.invalidTerm
    ? { erro: PRAZOS_CONSORCIO_INVALIDOS, frase: PRAZOS_CONSORCIO_INVALIDOS, numero: 0, barras: [], menorVence: true }
    : {
        frase: consorcio ? "Consórcio custa menos" : "Financiamento custa menos",
        numero: r.differenceInFavorOfWinner,
        barras: [
          { chave: "con", rotulo: "Consórcio", valor: r.consortium.operationCost, vence: consorcio },
          { chave: "fin", rotulo: "Financiar", valor: r.financing.totalCostWithOpportunity, vence: !consorcio },
        ],
        menorVence: true,
      };
  return { r, veredito };
}

export function vereditoCarro(v: ValoresDaCalculadora) {
  const r = simulateCarComparison(entradaCarro(v));
  const assina = r.winner === "ASSINATURA";
  const veredito: Veredito = {
    frase: `${assina ? "Assinar" : "Comprar"} sai mais barato em 24 meses`,
    numero: r.differenceInFavorOfWinner,
    barras: [
      { chave: "as", rotulo: "Assinar", valor: r.netResultSubscription, vence: assina },
      { chave: "co", rotulo: "Comprar", valor: r.netResultPurchase, vence: !assina },
    ],
    menorVence: true,
  };
  // As partes de cada barra empilhada. Somam exatamente o total da conta: comprar = perda na
  // revenda + rendimento perdido + IPVA e seguro + combustível; assinar = mensalidade + combustível.
  const preco = Number(v.carPrice);
  const partesComprar = {
    perdaNaRevenda: preco - Number(v.priceAfter2Years),
    rendimentoPerdido: r.opportunityCost,
    ipvaESeguro: Number(v.annualFixedCosts) * 2,
    combustivel: Number(v.monthlyFuelCost) * 24,
  };
  const partesAssinar = { mensalidade: Number(v.subscriptionMonthlyFee) * 24, combustivel: Number(v.monthlyFuelCost) * 24 };
  return { r, veredito, partesComprar, partesAssinar };
}

/** Uma célula do mapa "se a taxa mudar": a mesma conta da marcação, com a taxa de hoje deslocada. */
export function variacaoDoPreco(taxaDaCompra: number, anos: number, pontos: number): number {
  const r = simulateMarkToMarket({ faceValue: 1, originalRate: taxaDaCompra, newRate: taxaDaCompra + pontos / 100, totalYears: anos, yearsRemaining: anos });
  return r.approximateSensitivity * 100;
}

export function vereditoMarcacao(v: ValoresDaCalculadora) {
  const r = simulateMarkToMarket(entradaMarcacao(v));
  const investido = Number(v.investedAmount) > 0 ? Number(v.investedAmount) : 0;
  // Com o valor do título, a conta devolve o que ele vale hoje e o lucro em reais; sem ele, por
  // título de R$ 1.000 no vencimento (o valor de face).
  const vendaHoje = r.scaledMarketValue ?? r.marketPrice;
  const naCurva = investido > 0 ? investido : r.carryingPrice;
  const resultado = r.scaledProfitOrLoss ?? r.profitOrLoss;
  return { r, vendaHoje, naCurva, resultado, lucro: resultado >= 0 };
}

/** "R$ 2,16 mi", "R$ 78 mil", "R$ 4.290": o número das colunas, curto o bastante para caber. */
export function valorCurto(v: number, simbolo: string, inteiro: (n: number) => string): string {
  const a = Math.abs(v);
  const sinal = v < 0 ? "−" : "";
  if (a >= 1e6) return `${sinal}${simbolo} ${(a / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi`;
  if (a >= 1e4) return `${sinal}${simbolo} ${Math.round(a / 1000).toLocaleString("pt-BR")} mil`;
  return `${sinal}${inteiro(a)}`;
}
