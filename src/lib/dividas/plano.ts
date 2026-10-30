import { ordemDeAtaque, taxaDe, temTetoDeCem, type Divida } from '@/lib/dividas/tipos'

/**
 * Copiado do app Rota (~/Claude/app-educacao/lib/dividas/plano.ts): o SPI e o Rota precisam dar a
 * mesma data para as mesmas dívidas.
 *
 * DIVERGÊNCIA INTENCIONAL COM O ROTA (14/10/2026, escolha do assistente a pedido da Dani, que disse
 * "você veja o que é melhor"; ela pode rever): o "quanto falta pagar" é o saldo para quitar HOJE, e
 * quando a dívida tem parcelas restantes conhecidas (`parcelasAbertas`), a quitação NUNCA passa do fim
 * do contrato. No último mês do contrato o que sobrar é dado como pago (e entra no total pago).
 * Sem `parcelasAbertas` (e no Rota, que não tem o campo) a conta é exatamente a de antes. Se o Rota
 * quiser a mesma data, copiar o bloco marcado "PRAZO DO CONTRATO" de volta para lá.
 *
 * O passo "agir" do §6.3: quanto tempo leva para sair e em que ordem cada
 * dívida cai.
 *
 * O método é avalanche com bola de neve de pagamento: continua saindo o que já
 * sai hoje de cada dívida, o dinheiro extra vai todo para a mais cara, e quando
 * uma dívida termina o valor dela se junta ao extra em vez de sumir no mês.
 *
 * Mensal e determinística. Nenhum arredondamento esconde juros: o total pago é
 * a soma do que saiu da conta, mês a mês.
 *
 * No rotativo e no parcelamento de fatura vale o teto legal: os juros somados
 * não passam do saldo de hoje (o app não sabe o valor original, e usar o saldo
 * de hoje é a leitura mais cautelosa). Sem isso o mapa dizia que o rotativo
 * "sobe todo mês" sem fim, contra o que a atividade do teto acabou de ensinar.
 */
export type Quitacao = { id: string; nome: string; mes: number }

export type Plano = {
  meses: number
  totalPago: number
  totalJuros: number
  quitacoes: Quitacao[]
  /** Primeira dívida a cair. É a vitória que faz a pessoa continuar. */
  primeira: Quitacao | null
}

export type PlanoImpossivel = {
  impossivel: true
  /** Quanto falta por mês para cada dívida parar de crescer. */
  travando: { id: string; nome: string; faltaPorMes: number }[]
}

const LIMITE_DE_MESES = 600

export function ehImpossivel(p: Plano | PlanoImpossivel): p is PlanoImpossivel {
  return 'impossivel' in p
}

/** A dívida do SPI traz as parcelas que faltam; a do Rota não (aí o prazo do contrato não se aplica). */
type DividaComPrazo = Divida & { parcelasAbertas?: number | null; semParcela?: boolean }

/** PRAZO DO CONTRATO: parcelas que faltam, só quando existem e a dívida tem parcela fixa. */
function prazoDoContrato(d: DividaComPrazo): number | null {
  const n = d.parcelasAbertas
  return !d.semParcela && typeof n === 'number' && n > 0 ? n : null
}

/** O motor. Recebe a ordem pronta para poder comparar estratégias. */
function simular(dividas: Divida[], extraMensal: number, ordem: string[]): Plano | null {
  const saldos = new Map(dividas.map((d) => [d.id, d.saldo]))
  const taxas = new Map(dividas.map((d) => [d.id, taxaDe(d).taxa / 100]))
  const fixos = new Map(dividas.map((d) => [d.id, d.porMes]))
  const nomes = new Map(dividas.map((d) => [d.id, d.nome]))
  const tetos = new Map(dividas.filter((d) => temTetoDeCem(d.tipo)).map((d) => [d.id, d.saldo]))
  const jurosCobrados = new Map(dividas.map((d) => [d.id, 0]))
  const prazos = new Map<string, number>()
  for (const d of dividas) {
    const n = prazoDoContrato(d)
    if (n !== null) prazos.set(d.id, n)
  }
  const quitacoes: Quitacao[] = []
  let totalPago = 0
  let mes = 0

  const aberto = () => [...saldos.values()].some((s) => s > 0.005)

  while (mes < LIMITE_DE_MESES && aberto()) {
    mes++

    for (const [id, saldo] of saldos) {
      if (saldo <= 0.005) continue
      let juros = saldo * (taxas.get(id) ?? 0)
      const teto = tetos.get(id)
      if (teto !== undefined) juros = Math.min(juros, Math.max(0, teto - (jurosCobrados.get(id) ?? 0)))
      jurosCobrados.set(id, (jurosCobrados.get(id) ?? 0) + juros)
      saldos.set(id, saldo + juros)
    }

    // O valor das dívidas já quitadas volta para o bolo em vez de sumir.
    const liberado = [...saldos.entries()]
      .filter(([, s]) => s <= 0.005)
      .reduce((soma, [id]) => soma + (fixos.get(id) ?? 0), 0)
    let sobra = extraMensal + liberado

    for (const [id, saldo] of saldos) {
      if (saldo <= 0.005) continue
      const pago = Math.min(fixos.get(id) ?? 0, saldo)
      saldos.set(id, saldo - pago)
      totalPago += pago
    }

    for (const id of ordem) {
      if (sobra <= 0.005) break
      const saldo = saldos.get(id) ?? 0
      if (saldo <= 0.005) continue
      const pago = Math.min(sobra, saldo)
      saldos.set(id, saldo - pago)
      sobra -= pago
      totalPago += pago
    }

    // PRAZO DO CONTRATO: no último mês do contrato o que restar está pago (o saldo digitado é o de
    // hoje; juros só sobre ele, uma vez, e a data não passa do fim das parcelas).
    for (const [id, saldo] of saldos) {
      const prazo = prazos.get(id)
      if (prazo !== undefined && mes >= prazo && saldo > 0.005) {
        totalPago += saldo
        saldos.set(id, 0)
      }
    }

    for (const [id, saldo] of saldos) {
      if (saldo <= 0.005 && !quitacoes.some((q) => q.id === id)) {
        quitacoes.push({ id, nome: nomes.get(id) ?? '', mes })
      }
    }
  }

  if (aberto()) return null

  const totalDevido = dividas.reduce((s, d) => s + d.saldo, 0)
  return {
    meses: mes,
    totalPago,
    totalJuros: totalPago - totalDevido,
    quitacoes,
    primeira: quitacoes[0] ?? null,
  }
}

export function simularQuitacao(dividas: Divida[], extraMensal: number): Plano | PlanoImpossivel {
  if (dividas.length === 0) {
    return { meses: 0, totalPago: 0, totalJuros: 0, quitacoes: [], primeira: null }
  }
  const plano = simular(dividas, extraMensal, ordemDeAtaque(dividas).map((d) => d.id))
  if (plano !== null) return plano

  const travando = dividas
    .map((d) => ({
      id: d.id,
      nome: d.nome,
      faltaPorMes: d.saldo * (taxaDe(d).taxa / 100) - d.porMes,
    }))
    .filter((t) => t.faltaPorMes > 0)
    .sort((a, b) => b.faltaPorMes - a.faltaPorMes)
  return { impossivel: true, travando }
}

/**
 * A avalanche contra atacar a menor dívida primeiro. É o número que sustenta a
 * atividade "Bola de neve ou avalanche", agora com os dados dela.
 */
export function comparacaoComBolaDeNeve(
  dividas: Divida[],
  extraMensal: number,
): { avalanche: Plano; bolaDeNeve: Plano; economia: number; mesesAMenos: number } | null {
  if (dividas.length < 2) return null
  const avalanche = simular(dividas, extraMensal, ordemDeAtaque(dividas).map((d) => d.id))
  const bolaDeNeve = simular(
    dividas,
    extraMensal,
    [...dividas].sort((a, b) => a.saldo - b.saldo).map((d) => d.id),
  )
  if (avalanche === null || bolaDeNeve === null) return null
  return {
    avalanche,
    bolaDeNeve,
    economia: bolaDeNeve.totalPago - avalanche.totalPago,
    mesesAMenos: bolaDeNeve.meses - avalanche.meses,
  }
}
