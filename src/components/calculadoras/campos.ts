import type { Campo } from "./AoVivo";

/**
 * Os números de cada calculadora na tela ao vivo, com os rótulos e as explicações do protótipo
 * aprovado. As chaves são as da conta (ver lib/calculadoras/entradas.ts).
 */
const SISTEMA = [
  { valor: "SAC", rotulo: "SAC" },
  { valor: "PRICE", rotulo: "Price" },
];

export const CAMPOS_FINANCIAR: { base: Campo[]; finos: Campo[] } = {
  base: [
    { k: "propertyValue", rotulo: "Valor do imóvel", tipo: "brl", min: 50000, max: 3000000, passo: 10000, atalhos: [300000, 500000, 800000], ajuda: "Quanto custa o imóvel hoje." },
    { k: "downPayment", rotulo: "Entrada", tipo: "brl", min: 0, max: 3000000, passo: 5000, atalhos: [50000, 100000, 200000], ajuda: "Quanto você dá de entrada. Quem aluga começa com esse dinheiro investido." },
    { k: "cetAnnualRate", rotulo: "Custo do financiamento (CET)", tipo: "pct", min: 5, max: 20, passo: 0.1, atalhos: [9, 11, 13], ajuda: "O custo efetivo total ao ano, com juros, seguros e tarifas." },
    { k: "termMonths", rotulo: "Prazo", tipo: "meses", min: 12, max: 420, passo: 12, atalhos: [240, 360, 420], ajuda: "Em quantos meses você paga o financiamento." },
    { k: "monthlyRent", rotulo: "Aluguel de um imóvel parecido", tipo: "brl", min: 300, max: 30000, passo: 100, atalhos: [1800, 2200, 3000], ajuda: "Quanto custaria alugar um imóvel igual." },
    { k: "investmentAnnualRate", rotulo: "Rendimento do investimento", tipo: "pct", min: 4, max: 18, passo: 0.1, atalhos: [10, 11, 12], ajuda: "Rendimento bruto ao ano de onde quem aluga investe a diferença." },
  ],
  finos: [
    { k: "system", rotulo: "Sistema de amortização", tipo: "seg", opcoes: SISTEMA, ajuda: "SAC: a parcela começa maior e cai. Price: a parcela é sempre igual." },
    { k: "propertyAppreciationAnnualRate", rotulo: "Valorização do imóvel", tipo: "pct", min: 0, max: 15, passo: 0.1, atalhos: [3, 5, 7], ajuda: "Quanto o imóvel valoriza por ano." },
    { k: "rentAnnualAdjustment", rotulo: "Reajuste do aluguel", tipo: "pct", min: 0, max: 15, passo: 0.1, atalhos: [4, 5, 6], ajuda: "Quanto o aluguel sobe a cada ano." },
    { k: "incomeTaxRate", rotulo: "Imposto de renda", tipo: "pct", min: 0, max: 22.5, passo: 0.5, atalhos: [0, 15, 22.5], ajuda: "O imposto sobre o rendimento. A conta usa o rendimento já sem ele." },
  ],
};

export const CAMPOS_AMORTIZAR: { base: Campo[]; finos: Campo[] } = {
  base: [
    { k: "outstandingBalance", rotulo: "Quanto ainda deve", tipo: "brl", min: 1000, max: 1500000, passo: 5000, atalhos: [100000, 200000, 400000], ajuda: "O saldo devedor de hoje." },
    { k: "cetAnnualRate", rotulo: "Custo da dívida (CET)", tipo: "pct", min: 1, max: 300, passo: 0.1, atalhos: [9, 11, 13], ajuda: "O custo efetivo total ao ano. Empréstimo de 2,9% ao mês são 40,9% ao ano." },
    { k: "remainingMonths", rotulo: "Prazo que falta", tipo: "meses", min: 1, max: 420, passo: 12, atalhos: [120, 240, 360], ajuda: "Quantas parcelas faltam." },
    { k: "extraAmount", rotulo: "Valor que você tem", tipo: "brl", min: 1000, max: 200000, passo: 1000, atalhos: [10000, 20000, 50000], ajuda: "O dinheiro que pode ir para a dívida ou para o investimento." },
    { k: "investmentAnnualRate", rotulo: "Rendimento do investimento", tipo: "pct", min: 4, max: 18, passo: 0.1, atalhos: [10, 12, 14], ajuda: "Rendimento bruto ao ano." },
  ],
  finos: [
    { k: "system", rotulo: "Sistema de amortização", tipo: "seg", opcoes: SISTEMA, ajuda: "Como a dívida é paga hoje." },
    {
      k: "incomeTaxRate",
      rotulo: "Imposto de renda",
      tipo: "seg",
      opcoes: [
        { valor: "0", rotulo: "0%" },
        { valor: "0.15", rotulo: "15%" },
        { valor: "0.225", rotulo: "22,5%" },
      ],
      ajuda: "O imposto sobre o rendimento do investimento.",
    },
  ],
};

export const CAMPOS_CONSORCIO: { base: Campo[]; finos: Campo[] } = {
  base: [
    { k: "creditValue", rotulo: "Valor do bem", tipo: "brl", min: 10000, max: 1000000, passo: 5000, atalhos: [60000, 100000, 250000], ajuda: "Quanto custa o que você quer comprar." },
    { k: "consortiumAdminFeeRate", rotulo: "Taxa de administração total", tipo: "pct", min: 5, max: 30, passo: 0.5, atalhos: [15, 18, 22], ajuda: "A taxa do consórcio somada no prazo todo." },
    { k: "consortiumTermMonths", rotulo: "Prazo do consórcio", tipo: "meses", min: 12, max: 240, passo: 12, atalhos: [60, 120, 180], ajuda: "Em quantos meses o consórcio termina." },
    { k: "financingDownPayment", rotulo: "Entrada do financiamento", tipo: "brl", min: 0, max: 1000000, passo: 1000, atalhos: [0, 20000, 40000], ajuda: "Quanto você dá de entrada se financiar." },
    { k: "financingCetAnnualRate", rotulo: "Custo do financiamento (CET)", tipo: "pct", min: 5, max: 30, passo: 0.1, atalhos: [10, 12, 15], ajuda: "O custo efetivo total ao ano." },
    { k: "financingTermMonths", rotulo: "Prazo do financiamento", tipo: "meses", min: 12, max: 420, passo: 12, atalhos: [60, 120, 240], ajuda: "Em quantos meses você paga." },
  ],
  finos: [
    {
      k: "financingSystem",
      rotulo: "Sistema de amortização",
      tipo: "seg",
      opcoes: [
        { valor: "PRICE", rotulo: "Price" },
        { valor: "SAC", rotulo: "SAC" },
      ],
      ajuda: "Price: parcela igual. SAC: começa maior e cai.",
    },
    { k: "opportunityCostAnnualRate", rotulo: "Rendimento que a entrada teria", tipo: "pct", min: 0, max: 20, passo: 0.1, atalhos: [9, 11, 13], ajuda: "O que a entrada renderia ao ano se ficasse investida." },
  ],
};

export const CAMPOS_CARRO: { base: Campo[]; finos: Campo[] } = {
  base: [
    { k: "carPrice", rotulo: "Preço do carro", tipo: "brl", min: 20000, max: 400000, passo: 1000, atalhos: [70000, 100000, 150000], ajuda: "O preço do carro novo." },
    { k: "priceAfter2Years", rotulo: "Quanto vale depois de 2 anos", tipo: "brl", min: 0, max: 400000, passo: 1000, atalhos: [65000, 75000, 85000], ajuda: "Por quanto você venderia o carro no fim." },
    { k: "subscriptionMonthlyFee", rotulo: "Mensalidade da assinatura", tipo: "brl", min: 500, max: 15000, passo: 50, atalhos: [2000, 2500, 3000], ajuda: "O que a locadora cobra por mês." },
    { k: "monthlyFuelCost", rotulo: "Combustível por mês", tipo: "brl", min: 0, max: 5000, passo: 50, atalhos: [300, 400, 600], ajuda: "Igual nos dois casos." },
  ],
  finos: [
    { k: "annualFixedCosts", rotulo: "Custos fixos por ano", tipo: "brl", min: 0, max: 40000, passo: 500, atalhos: [3000, 4000, 6000], ajuda: "IPVA, seguro, revisões e licenciamento." },
    { k: "opportunityCostMonthlyRate", rotulo: "Rendimento do dinheiro", tipo: "pctMes", min: 0, max: 3, passo: 0.05, atalhos: [0.6, 0.8, 1], ajuda: "O que o dinheiro do carro renderia por mês se ficasse investido." },
  ],
};

/** O "?" do herói de cada uma (como ler o resultado). */
export const COMO_LER = {
  financiar: "Compara o patrimônio no fim do prazo: quem financia fica com o imóvel valorizado; quem aluga investe a entrada e, todo mês, a diferença entre a parcela e o aluguel, já sem o imposto.",
  amortizar: "Amortizar encurta o prazo e mantém a parcela. Para comparar de forma justa, cada parcela que deixa de ser paga é investida até o fim do prazo original; do outro lado, o valor fica investido o mesmo tempo.",
  consorcio: "Compara o custo de cada caminho: no consórcio, a taxa de administração; no financiamento, os juros mais o que a entrada renderia se ficasse investida.",
  carro: "Soma o que sai do bolso em 24 meses. Comprar inclui o carro, o uso, os custos fixos e o rendimento que o dinheiro perderia, menos a revenda.",
  marcacao: "Título prefixado muda de preço quando a taxa do mercado muda. Se a taxa de hoje é maior que a sua, vender antes dá prejuízo; levando até o vencimento você recebe o combinado.",
};
