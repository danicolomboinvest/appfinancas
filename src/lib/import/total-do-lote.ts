import { descricaoComparavel, installmentDescription, parseInstallment } from "@/lib/entries/recurrence";

/**
 * O número que o histórico de importações mostra ao lado de cada lote.
 *
 * Antes era a soma de tudo que o lote criou: renda, gasto e aporte juntos, e na fatura também as
 * parcelas projetadas pros meses seguintes. O extrato com salário de R$ 5.000 e R$ 3.000 de gastos
 * aparecia como R$ 8.000; a fatura de R$ 1.000 com uma compra em 10x de R$ 100 aparecia como
 * R$ 1.900. Ela via um número maior que o arquivo e achava que a importação tinha duplicado.
 *
 * - Fatura: só os gastos do mês da fatura (o primeiro mês em que o lote gravou algo; as parcelas
 *   projetadas caem nos seguintes). Estorno já está negativo e desconta. É o total da fatura.
 * - Extrato (e Open Finance): o saldo com sinal, como na tela de confirmação. Renda soma; gasto
 *   e aporte subtraem.
 *
 * Na fatura, é "o total da fatura importada" (15/10/2026): toda tela que fala do ARQUIVO usa
 * este (o histórico de importações e o "Sua última fatura" da missão 2 do Money Reset). A tela
 * que fala do MÊS ("Seu cartão em outubro", limite do cartão) usa gastoNoCartao
 * (repositories/limite-cartao.repo.ts), que explica a diferença.
 */
export type LancamentoDoLote = { amount: number; category: string; year: number; month: number; description?: string | null };

/** A descrição sem o "N/T" da parcela: as parcelas da mesma compra ficam com a mesma chave. */
function chaveDaSerie(description: string): string {
  return descricaoComparavel(installmentDescription(description, 1, 1));
}

/**
 * Os índices das parcelas que a fatura PROJETOU para os meses seguintes (14/10/2026). Desde que
 * cada compra entra no mês em que foi feita, a fatura que fecha no dia 5 grava em dois meses, e
 * "só o primeiro mês" deixava fora do total as compras do segundo. A projetada se reconhece pela
 * série: da mesma compra parcelada, o lote gravou a parcela da fatura (a menor) e as seguintes.
 */
export function parcelasProjetadas(lancamentos: LancamentoDoLote[]): Set<number> {
  const menorPorSerie = new Map<string, number>();
  const parcela = lancamentos.map((e) => {
    const p = e.description ? parseInstallment(e.description) : null;
    if (!p?.confident || !e.description) return null;
    const serie = `${chaveDaSerie(e.description)}|${p.total}|${e.amount.toFixed(2)}`;
    menorPorSerie.set(serie, Math.min(menorPorSerie.get(serie) ?? Infinity, p.current));
    return { serie, atual: p.current };
  });
  const fora = new Set<number>();
  parcela.forEach((p, i) => {
    if (p && p.atual > (menorPorSerie.get(p.serie) ?? p.atual)) fora.add(i);
  });
  return fora;
}

export function totalDoLote(docType: string, lancamentos: LancamentoDoLote[]): number {
  if (docType === "fatura") {
    if (lancamentos.length === 0) return 0;
    // Com as descrições: tudo o que a fatura trouxe, em qualquer mês, menos as parcelas projetadas.
    if (lancamentos.every((e) => typeof e.description === "string")) {
      const fora = parcelasProjetadas(lancamentos);
      const total = lancamentos.filter((e, i) => e.category === "EXPENSE" && !fora.has(i)).reduce((soma, e) => soma + e.amount, 0);
      return Math.round(total * 100) / 100;
    }
    const mesDaFatura = Math.min(...lancamentos.map((e) => e.year * 12 + e.month));
    const total = lancamentos
      .filter((e) => e.category === "EXPENSE" && e.year * 12 + e.month === mesDaFatura)
      .reduce((soma, e) => soma + e.amount, 0);
    return Math.round(total * 100) / 100;
  }
  const saldo = lancamentos.reduce((soma, e) => soma + (e.category === "INCOME" ? e.amount : -e.amount), 0);
  return Math.round(saldo * 100) / 100;
}
