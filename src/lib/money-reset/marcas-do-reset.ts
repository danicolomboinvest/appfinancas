import { marcaDaDescricao } from "@/lib/marcas/marca";

/**
 * As marcas no Money Reset (pedido da Dani, 12/10/2026: "mais visual, streaming, uma logozinha").
 * Onde a missão fala de gasto, aparece o logo real da marca que ELA paga, achado pela descrição do
 * extrato com o mesmo catálogo das Transações (lib/marcas). Sem dados ainda, a tela mostra logos do
 * catálogo marcados como exemplo, sem nenhum valor (regra: sem número inventado).
 *
 * Banco, corretora, Pix e bandeira de cartão não são "para onde o dinheiro foi": é por onde ele
 * passou (pagamento de fatura, Pix, aplicação). Ficam fora da fileira de gastos. Puro.
 */

const NAO_E_GASTO = new Set([
  "nubank", "mercadopago", "picpay", "pix", "visa", "mastercard", "elo", "itau", "bradesco", "santander", "bancodobrasil", "caixa",
  "inter", "c6bank", "btgpactual", "xp", "bancopan", "b3", "eqi", "fatos", "wise", "binance", "agora", "pagbank", "willbank",
  "bancooriginal", "sicredi", "sicoob", "mercadobitcoin", "rico", "clear", "avenue", "nomad", "toro", "neon", "genial", "modal",
  "safra", "warren", "agibank", "google", "apple",
]);

/** Pagamento de fatura, aplicação, resgate: não é gasto, mesmo com nome de loja no meio. */
const MOVIMENTO = /\b(pagamento de fatura|pagamento fatura|pgto fatura|pag fatura|aplicacao|resgate|estorno)\b/i;

export type LancamentoComMarca = {
  description: string | null;
  amount: number;
  year: number;
  month: number;
  parentCategory: string | null;
};

export type GastoDeMarca = {
  slug: string;
  nome: string;
  /** O texto que o LogoDoLancamento usa para achar o logo (o nome da marca casa com o catálogo). */
  descricao: string;
  /** Média por mês, nos meses que têm lançamento. */
  mensal: number;
  /** Quantas vezes por mês, em média (pedido do iFood, corrida do Uber). */
  vezes: number;
  parentCategory: string | null;
};

/**
 * As marcas que mais levam o dinheiro dela, por média mensal. `meses` é quantos meses têm
 * lançamento (quem chegou há 2 meses não divide por 3). Só lançamentos de gasto devem entrar.
 */
export function marcasQueMaisLevam(lancamentos: LancamentoComMarca[], meses: number, limite = 6): GastoDeMarca[] {
  if (meses <= 0) return [];
  const porMarca = new Map<string, { nome: string; descricao: string; total: number; vezes: number; cats: Map<string, number> }>();
  for (const l of lancamentos) {
    if (!l.description || MOVIMENTO.test(l.description)) continue;
    const marca = marcaDaDescricao(l.description);
    if (!marca || marca.baixa || NAO_E_GASTO.has(marca.slug)) continue;
    const valor = Math.abs(l.amount);
    if (valor <= 0) continue;
    const g = porMarca.get(marca.slug) ?? { nome: marca.nome, descricao: l.description, total: 0, vezes: 0, cats: new Map() };
    g.total += valor;
    g.vezes += 1;
    if (l.parentCategory) g.cats.set(l.parentCategory, (g.cats.get(l.parentCategory) ?? 0) + valor);
    porMarca.set(marca.slug, g);
  }
  return [...porMarca.entries()]
    .map(([slug, g]) => ({
      slug,
      nome: g.nome,
      descricao: g.descricao,
      mensal: g.total / meses,
      vezes: g.vezes / meses,
      parentCategory: [...g.cats.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    }))
    .sort((a, b) => b.mensal - a.mensal)
    .slice(0, limite);
}

/**
 * Logos de exemplo, para quem ainda não trouxe o extrato. O texto de cada um é o que casa com o
 * catálogo (o teste confere que todos acham o logo). Nunca vão com valor.
 */
export const EXEMPLOS = {
  bancos: ["Nubank", "Itaú", "Bradesco", "Banco Inter", "C6 Bank", "Banco do Brasil", "Caixa Economica", "Santander"],
  streaming: ["Netflix", "Spotify", "Disney+", "Globoplay", "Prime Video"],
  delivery: ["iFood", "Rappi"],
  compras: ["Shopee", "Mercado Livre", "Shein", "Amazon"],
  contas: ["Vivo", "Claro Fibra", "TIM Brasil", "Enel", "Sabesp"],
} as const;
