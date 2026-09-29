import { getExchangeRate } from "@/lib/fx/rates";
import type { CurrencyCode } from "@/lib/money";

/**
 * Cotação de bolsa (sempre em reais, a fonte é a B3 via investidor10) na moeda que a pessoa
 * usa no app.
 *
 * O ativo não guarda moeda: a carteira mostra o número cru com o símbolo da moeda escolhida em
 * Configurações. Quem mora em Portugal e digitou €700 de PETR4 via, depois do cron da noite,
 * €3.850 — o preço em reais gravado como se fosse euro, e o lucro inflado umas 5 vezes.
 *
 * `reaisPorUnidade` é quanto vale 1 unidade da moeda dela em reais (1 € = 5,91). Sem essa
 * cotação o certo é NÃO mexer no valor (null), nunca gravar o número em reais.
 */
export function precoNaMoeda(precoEmReais: number, moeda: CurrencyCode, reaisPorUnidade: number | null): number | null {
  if (moeda === "BRL") return precoEmReais;
  if (!reaisPorUnidade || !Number.isFinite(reaisPorUnidade) || reaisPorUnidade <= 0) return null;
  // 6 casas: é a escala da coluna do preço unitário; o total é arredondado a centavos no banco.
  return Math.round((precoEmReais / reaisPorUnidade) * 1e6) / 1e6;
}

/** Quanto vale 1 unidade da moeda em reais, pra usar em precoNaMoeda (null se a fonte falhou). */
export async function reaisPorUnidadeDa(moeda: CurrencyCode): Promise<number | null> {
  if (moeda === "BRL") return 1;
  // Pede no sentido moeda → real (5,91, não 0,1692): com 4 casas, é o sentido que perde menos.
  const cotacao = await getExchangeRate(moeda, "BRL");
  return cotacao?.rate ?? null;
}
