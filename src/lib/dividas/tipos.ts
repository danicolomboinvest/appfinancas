/**
 * Dívidas no SPI Finance (11/10/2026): o motor do app Rota, copiado de
 * ~/Claude/app-educacao/lib/dividas/tipos.ts. Mudou só o que é de tela: o emoji
 * do tipo virou o nome de um ícone de traço (o SPI não usa emoji na interface),
 * e a dívida ganhou os campos do cadastro do SPI (para que foi, se foi planejada).
 *
 * No Rota: quem declara dívida não recebe uma aula sobre endividamento. Recebe
 * ajuda para mapear a situação real e transformar isso em plano.
 *
 * FONTE: material 15 da metodologia, "Como Sair das Dívidas", passos 1 a 3.
 * As faixas de juros e a ordem de ataque são dela, não minhas. A primeira
 * versão deste arquivo usava taxas e uma ordem que eu inventei; as duas coisas
 * estavam diferentes do que ela ensina.
 */

export type TipoDeDivida =
  | 'rotativo'
  | 'cheque_especial'
  | 'carne_loja'
  | 'cartao_parcelado'
  | 'emprestimo'
  | 'consignado'
  | 'financiamento_veiculo'
  | 'financiamento_imovel'
  | 'conta_essencial'
  | 'pessoa'
  | 'outra'

/**
 * Os quatro grupos da ordem de ataque dela (material 15, passo 3):
 * 1. juros altos · 2. risco de penhora de bens · 3. essenciais · 4. outras.
 */
export type Grupo = 1 | 2 | 3 | 4

export type IconeDoTipo = "cartao" | "banco" | "sacola" | "fatura" | "moedas" | "folha" | "carro" | "casa" | "raio" | "pessoas" | "etiqueta"

export type PerfilDeTipo = {
  id: TipoDeDivida
  nome: string
  exemplo: string
  /** Ícone de traço do tipo (nome em `IconeDoTipo`). É o que faz a grade ser escaneável. */
  icone: IconeDoTipo
  /** Faixa ao mês, em %, como ela publica no material 15. */
  faixa: [number, number]
  /** O bem vai junto se você parar de pagar. */
  riscoDeBem: boolean
  /** Parar de pagar corta um serviço de que você depende. */
  essencial: boolean
  /** Dívida que rola sozinha quando não é paga, em vez de ter parcela fixa. */
  rotativa: boolean
  /**
   * §110 — quando a lei põe um teto na taxa ao mês, a estimativa de quem não
   * sabe a própria taxa é o teto, não o meio da faixa.
   */
  tetoLegal?: number
}

/** De onde vêm as faixas. Só para quem mantém o app: nunca vai para a tela. */
export const REFERENCIA_DAS_ESTIMATIVAS = 'material 15 da metodologia'

/**
 * Teto legal do cartão (Lei 14.690/2023, Resolução CMN 5.112/2023, desde
 * 3/1/2024): no rotativo e no parcelamento de fatura, juros e encargos não
 * passam de 100% do valor original. A dívida pode no máximo dobrar.
 */
export function temTetoDeCem(tipo: TipoDeDivida): boolean {
  return tipo === 'rotativo' || tipo === 'cartao_parcelado'
}

/** Acima disto, a dívida entra no grupo 1 dela, "juros altos". */
export const LIMIAR_DE_JURO_ALTO = 4

export const TIPOS: PerfilDeTipo[] = [
  { id: 'rotativo', nome: 'Rotativo do cartão', exemplo: 'você não pagou a fatura inteira', icone: 'cartao', faixa: [7, 15], riscoDeBem: false, essencial: false, rotativa: true },
  // Cheque especial: teto de 8% ao mês desde 6/1/2020 (Resolução CMN
  // 4.765/2019). O material 15 dizia 8% a 14%, de antes do teto (§110).
  { id: 'cheque_especial', nome: 'Cheque especial', exemplo: 'a conta ficou negativa', icone: 'banco', faixa: [7, 8], riscoDeBem: false, essencial: false, rotativa: true, tetoLegal: 8 },
  { id: 'carne_loja', nome: 'Carnê de loja', exemplo: 'crediário, loja de departamento', icone: 'sacola', faixa: [4, 8], riscoDeBem: false, essencial: false, rotativa: false },
  { id: 'cartao_parcelado', nome: 'Parcelamento de fatura', exemplo: 'o banco parcelou o que você devia', icone: 'fatura', faixa: [4, 10], riscoDeBem: false, essencial: false, rotativa: false },
  { id: 'emprestimo', nome: 'Empréstimo pessoal', exemplo: 'banco, fintech ou financeira', icone: 'moedas', faixa: [2, 6], riscoDeBem: false, essencial: false, rotativa: false },
  { id: 'consignado', nome: 'Consignado', exemplo: 'desconta direto na folha', icone: 'folha', faixa: [1.2, 2.5], riscoDeBem: false, essencial: false, rotativa: false },
  { id: 'financiamento_veiculo', nome: 'Financiamento de veículo', exemplo: 'o carro fica alienado ao banco', icone: 'carro', faixa: [1, 3], riscoDeBem: true, essencial: false, rotativa: false },
  { id: 'financiamento_imovel', nome: 'Financiamento de imóvel', exemplo: 'o imóvel fica alienado ao banco', icone: 'casa', faixa: [0.5, 1.5], riscoDeBem: true, essencial: false, rotativa: false },
  { id: 'conta_essencial', nome: 'Conta atrasada', exemplo: 'luz, água, gás, aluguel', icone: 'raio', faixa: [1, 3], riscoDeBem: false, essencial: true, rotativa: false },
  { id: 'pessoa', nome: 'Devo para alguém', exemplo: 'família, amigo, sócio', icone: 'pessoas', faixa: [0, 0], riscoDeBem: false, essencial: false, rotativa: false },
  { id: 'outra', nome: 'Outra', exemplo: 'imposto, mensalidade, multa', icone: 'etiqueta', faixa: [1, 3], riscoDeBem: false, essencial: false, rotativa: false },
]

export function perfilDoTipo(tipo: TipoDeDivida): PerfilDeTipo {
  return TIPOS.find((t) => t.id === tipo) ?? TIPOS[TIPOS.length - 1]
}

/**
 * Meio da faixa dela, usado quando a pessoa não sabe a própria taxa. Quando
 * a lei tem teto, vale o teto.
 */
export function taxaEstimadaDoTipo(tipo: TipoDeDivida): number {
  const perfil = perfilDoTipo(tipo)
  if (perfil.tetoLegal !== undefined) return perfil.tetoLegal
  const [de, ate] = perfil.faixa
  return Math.round(((de + ate) / 2) * 10) / 10
}

export type Divida = {
  id: string
  tipo: TipoDeDivida
  /** Nome que a pessoa reconhece: "Cartão do mercado", "Empréstimo do Léo". */
  nome: string
  saldo: number
  /** Quanto sai da conta dela por mês para esta dívida, hoje. */
  porMes: number
  /** Taxa ao mês em %. Null quando ela não sabe; aí vale o meio da faixa. */
  taxaMensal: number | null
  atrasada: boolean
}

export function taxaDe(divida: Divida): { taxa: number; estimada: boolean } {
  if (divida.taxaMensal !== null) return { taxa: divida.taxaMensal, estimada: false }
  return { taxa: taxaEstimadaDoTipo(divida.tipo), estimada: true }
}

export function jurosDoMes(divida: Divida): number {
  return divida.saldo * (taxaDe(divida).taxa / 100)
}

/** Em qual dos quatro grupos dela esta dívida cai. */
export function grupoDe(divida: Divida): Grupo {
  const perfil = perfilDoTipo(divida.tipo)
  if (taxaDe(divida).taxa >= LIMIAR_DE_JURO_ALTO) return 1
  if (perfil.riscoDeBem) return 2
  if (perfil.essencial) return 3
  return 4
}

export const ROTULO_DO_GRUPO: Record<Grupo, string> = {
  1: 'Juros altos',
  2: 'Risco de perder o bem',
  3: 'Essencial',
  4: 'As outras',
}

/**
 * Ordem de ataque, material 15 passo 3: primeiro os juros altos, depois o que
 * tem risco de penhora, depois o essencial, depois o resto. Dentro do grupo,
 * quem cobra mais caro vem antes.
 *
 * O material dela não diz onde entra dívida atrasada, então ela só desempata
 * dentro do próprio grupo. Isso é interpolação minha e está marcada como tal.
 */
export function ordemDeAtaque(dividas: Divida[]): Divida[] {
  return [...dividas].sort((a, b) => {
    const ga = grupoDe(a)
    const gb = grupoDe(b)
    if (ga !== gb) return ga - gb
    if (a.atrasada !== b.atrasada) return a.atrasada ? -1 : 1
    return taxaDe(b).taxa - taxaDe(a).taxa
  })
}

export type Retrato = {
  total: number
  porMes: number
  jurosPorMes: number
  crescendo: Divida[]
  maisCara: Divida | null
  maiorSaldo: Divida | null
}

export function retratoDe(dividas: Divida[]): Retrato {
  const total = dividas.reduce((s, d) => s + d.saldo, 0)
  const porMes = dividas.reduce((s, d) => s + d.porMes, 0)
  const jurosPorMes = dividas.reduce((s, d) => s + jurosDoMes(d), 0)
  const crescendo = dividas.filter((d) => jurosDoMes(d) > d.porMes)
  const porJuros = [...dividas].sort((a, b) => jurosDoMes(b) - jurosDoMes(a))
  const porSaldo = [...dividas].sort((a, b) => b.saldo - a.saldo)
  return {
    total,
    porMes,
    jurosPorMes,
    crescendo,
    maisCara: porJuros[0] ?? null,
    maiorSaldo: porSaldo[0] ?? null,
  }
}

/**
 * Material 15, passo 2: mais de 30% da renda comprometida com dívida é sinal
 * de superendividamento. É o único número dela que vira diagnóstico na tela.
 */
export const LIMIAR_DE_SUPERENDIVIDAMENTO = 0.3

export function comprometimentoDaRenda(
  dividas: Divida[],
  rendaMensal: number,
): { proporcao: number; superendividada: boolean } | null {
  if (rendaMensal <= 0) return null
  const proporcao = retratoDe(dividas).porMes / rendaMensal
  return { proporcao, superendividada: proporcao > LIMIAR_DE_SUPERENDIVIDAMENTO }
}
