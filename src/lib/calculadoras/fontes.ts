/**
 * Os números que as calculadoras puxam do app, e de onde cada um vem (versão nova, 11/10/2026).
 * Regra do plano: "valores puxados do app dizem de onde vêm". Sem o dado, a calculadora pergunta
 * com um exemplo marcado como "Exemplo"; nunca inventa.
 *
 * Aqui só as escolhas puras (testáveis); a leitura do banco fica em `dados-do-app.ts`.
 */

import { taxaDe, type Divida, type TipoDeDivida } from "@/lib/dividas/tipos";

export type ValorComOrigem = { valor: number; origem: string };

/** O aluguel de hoje: primeiro a conta "Aluguel" cadastrada; senão, o último lançamento de aluguel. */
export function acharAluguel(
  contas: { nome: string; valor: number | null }[],
  lancamentos: { descricao: string | null; subcategoria: string | null; valor: number; ano: number; mes: number }[],
): ValorComOrigem | null {
  const conta = contas.find((c) => /aluguel/i.test(c.nome) && c.valor != null && c.valor > 0);
  if (conta) return { valor: conta.valor!, origem: `Das suas contas · ${conta.nome}` };
  const ultimo = lancamentos
    .filter((l) => l.valor > 0 && (/aluguel/i.test(l.descricao ?? "") || /aluguel/i.test(l.subcategoria ?? "")))
    .sort((a, b) => b.ano * 12 + b.mes - (a.ano * 12 + a.mes))[0];
  if (ultimo) return { valor: ultimo.valor, origem: "Do seu orçamento · Moradia" };
  return null;
}

/**
 * `taxaCompra` é a taxa em que ela comprou (Asset.taxaCompra, em fração, lida pelo indexador:
 * no IPCA+ é só o juro real, 0.075 = IPCA + 7,5%; no prefixado, 0.12 = 12% ao ano). Nulo = ela
 * não disse, e a calculadora começa no exemplo.
 */
export type TituloDaCarteira = { id: string; nome: string; investido: number; atual: number; ipca: boolean; vencimento: number | null; taxaCompra: number | null };

/**
 * Os títulos que mudam de preço com a taxa: IPCA+ e prefixado (o pós-fixado, como o Tesouro
 * Selic e o CDB de CDI, quase não oscila). O ano de vencimento sai do nome ("Tesouro IPCA+ 2035"),
 * quando ele está lá.
 */
export function titulosDaCarteira(
  ativos: { id: string; name: string; assetClass: string; fixedIncomeIndex: string | null; investedValue: number | null; currentValue: number; taxaCompra?: number | null }[],
): TituloDaCarteira[] {
  return ativos
    .filter((a) => (a.assetClass === "TESOURO_DIRETO" || a.assetClass === "RENDA_FIXA") && (a.fixedIncomeIndex === "IPCA" || a.fixedIncomeIndex === "PREFIXADO"))
    .map((a) => {
      const ano = a.name.match(/\b(20\d\d)\b/);
      return {
        id: a.id,
        nome: a.name,
        investido: a.investedValue ?? a.currentValue,
        atual: a.currentValue,
        ipca: a.fixedIncomeIndex === "IPCA",
        vencimento: ano ? Number(ano[1]) : null,
        // A taxa do IPCA+ e a do prefixado entram do mesmo jeito na conta (a do IPCA+ já é o juro
        // real); fora da faixa de uma taxa ao ano (0 a 100%) é dado estranho e fica o exemplo.
        taxaCompra: a.taxaCompra != null && a.taxaCompra > 0 && a.taxaCompra < 1 ? a.taxaCompra : null,
      };
    });
}

/**
 * Os números de partida do "Vender antes do prazo" para um título da carteira. A taxa da compra
 * vem do ativo (Asset.taxaCompra) quando ela disse; sem ela, entra um exemplo (marcado na tela)
 * que ela troca nos ajustes. A taxa de hoje começa sempre num exemplo, um ponto (IPCA+) ou dois
 * (prefixado) acima da compra, e ela arrasta.
 */
export function valoresDoTitulo(t: TituloDaCarteira | null, anoAtual: number) {
  if (!t) return null;
  const faltam = t.vencimento ? Math.max(1, t.vencimento - anoAtual) : 6;
  const passo = t.ipca ? 0.01 : 0.02;
  const taxa = t.taxaCompra ?? (t.ipca ? 0.06 : 0.1);
  const hoje = Math.round((taxa + passo) * 10000) / 10000;
  return {
    faceValue: 1000,
    originalRate: taxa,
    newRate: hoje,
    totalYears: faltam + 1,
    yearsRemaining: faltam,
    hasSemiannualCoupons: "nao",
    duration: 0,
    // O valor de hoje, na curva: a conta escala o preço de mercado a partir dele.
    investedAmount: Math.round(t.atual),
  };
}

/**
 * Uma dívida da área Dívidas, pronta para o "Quitar ou investir" (protótipo aprovado: "Qual
 * dívida? As suas aparecem aqui."). Os juros ao mês são os que ela disse; sem eles, a estimativa
 * do tipo, marcada como estimada (a mesma regra da área Dívidas, `taxaDe`).
 */
export type DividaParaCalculadora = {
  id: string;
  nome: string;
  tipo: TipoDeDivida;
  saldo: number;
  jurosAoMes: number;
  estimada: boolean;
  parcelasAbertas: number | null;
};

export function dividasParaQuitar(dividas: (Divida & { parcelasAbertas?: number | null })[]): DividaParaCalculadora[] {
  return dividas
    .filter((d) => d.saldo > 0)
    .map((d) => {
      const { taxa, estimada } = taxaDe(d);
      const abertas = d.parcelasAbertas ?? null;
      return { id: d.id, nome: d.nome, tipo: d.tipo, saldo: d.saldo, jurosAoMes: taxa, estimada, parcelasAbertas: abertas && abertas > 0 ? abertas : null };
    });
}

/** A meta de carro (pelo ícone ou pelo nome), para o consórcio e o carro usarem. */
export function acharMetaDeCarro<T extends { icon: string; name: string }>(metas: T[]): T | null {
  return metas.find((m) => m.icon === "CARRO") ?? metas.find((m) => /carro/i.test(m.name)) ?? null;
}
