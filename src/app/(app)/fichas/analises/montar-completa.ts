import type { SheetType } from "@prisma/client";
import type { AuthContext } from "@/lib/auth/session";
import type { MoneyFormatter } from "@/lib/money";
import { listAssets } from "@/lib/repositories/asset.repo";
import { getParaVoce } from "@/lib/analysis/para-voce";
import { compactValue, type Laudo } from "@/lib/analysis/laudo";
import { parseIndicatorNumber } from "@/lib/analysis/stock-overview";
import {
  cotacaoDoAtivo,
  fichasPorTicker,
  indicadoresDoLaudo,
  logoDe,
  proventosDe,
  tipoDaAnalise,
  ultimoPrecoDoDia,
} from "@/lib/analysis/analises-dados";
import { nomeConhecido } from "@/lib/analysis/tipo-do-ticker";
import { num2, numBR, perguntasDoAtivo, proventosMensais } from "@/lib/analysis/quatro-perguntas";
import type { LinhaParaVoce, PropsDaCompleta } from "./AnaliseCompleta";

/** "11/10, 14:32" no horário de Brasília. */
export function quando(d: Date): string {
  const f = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return f.format(d);
}

const AVISO: Record<SheetType, string> = {
  STOCK: "Réguas gerais: banco, holding e varejo têm números normais bem diferentes entre si.",
  STOCK_INTL: "Réguas gerais, as mesmas das ações brasileiras. Em dólar, o câmbio mexe no que você ganha em reais.",
  FII: "Fundo de papel e fundo de tijolo têm números que não se comparam; leia junto com o segmento.",
  ETF: "Rentabilidade passada não garante a futura; o que importa num ETF é seguir bem o índice dele.",
};

function numerosDe(tipo: SheetType, ind: Record<string, string>, dyFii: number | null): [string, string][] {
  const n = (k: string) => (ind[k] ? parseIndicatorNumber(ind[k]) : null);
  const L: [string, string | null][] =
    tipo === "FII"
      ? [
          ["Pagou em 12 meses", dyFii !== null ? `${numBR(dyFii)}%` : null],
          ["Preço ÷ patrimônio", n("p_vp") !== null ? `${numBR(n("p_vp")!, 2)}x` : null],
          ["Negocia por dia", ind.liquidez_fii ? compactValue(ind.liquidez_fii) : null],
          ["Taxa de administração", ind.taxa_administracao ?? null],
          ["Área vazia", ind.vacancia_atual ?? null],
          ["Imóveis", ind.numero_imoveis ?? null],
        ]
      : tipo === "ETF"
        ? [
            ["12 meses", ind.rentabilidade_12m ?? null],
            ["5 anos", ind.rentabilidade_5anos ?? null],
            ["Patrimônio", ind.patrimonio_liquido_etf ? compactValue(ind.patrimonio_liquido_etf) : null],
            ["Dividendos 12m", ind.dividend_yield_etf ?? null],
          ]
        : [
            ["Preço ÷ lucro", n("p_l") !== null ? `${numBR(n("p_l")!)}x` : null],
            ["Dividendos 12m", ind.dividend_yield ?? null],
            ["Retorno dos sócios", ind.roe ?? null],
            ["Dívida ÷ caixa", n("divida_liquida_ebitda") !== null ? `${numBR(n("divida_liquida_ebitda")!)}x` : null],
            ["Margem líquida", ind.margem_liquida ?? null],
            ["Preço ÷ patrimônio", n("p_vp") !== null ? `${numBR(n("p_vp")!)}x` : null],
          ];
  return L.filter((x): x is [string, string] => !!x[1]);
}

/**
 * Monta a Análise completa de um ticker já lido. Devolve null quando ainda não há leitura (a página
 * mostra o "lendo" e chama a leitura).
 */
export async function montarCompleta(ctx: AuthContext, ticker: string, money: MoneyFormatter, hoje = new Date()): Promise<PropsDaCompleta | null> {
  const [fichas, assets, proventos] = await Promise.all([fichasPorTicker(ctx, [ticker]), listAssets(ctx), proventosDe([ticker])]);
  const ficha = fichas.get(ticker);
  if (!ficha?.laudo) return null;
  const laudo: Laudo = ficha.laudo;
  const tipo = ficha.sheetType;
  const meus = assets.filter((a) => (a.ticker ?? "").trim().toUpperCase() === ticker);
  const a = meus[0];

  let cotacao = a ? cotacaoDoAtivo(a) : null;
  const moeda: "BRL" | "USD" = a?.currency === "USD" || tipo === "STOCK_INTL" || (tipo === "ETF" && /^[A-Z]{1,5}$/.test(ticker)) ? "USD" : "BRL";
  if (cotacao === null && moeda === "BRL") cotacao = (await ultimoPrecoDoDia(ticker))?.preco ?? null;

  const ind = indicadoresDoLaudo(laudo);
  const prov = proventos.get(ticker) ?? [];
  const perguntas = perguntasDoAtivo({ tipo, ticker, indicadores: ind, cotacao, moeda, proventos: prov, hoje });

  const mensal = tipo === "FII" ? proventosMensais(prov, hoje) : null;
  const dyFii = mensal && cotacao ? (mensal.valores.reduce((t, v) => t + v, 0) / cotacao) * 100 : null;

  // "E para você?": o que só este app sabe (a sua posição, o seu plano), nunca recomendação.
  const pv = await getParaVoce(ctx, tipo, ticker, laudo);
  const paraVoce: LinhaParaVoce[] = [];
  if (pv.position) {
    const inv = meus.reduce((t, x) => t + (x.investedValue ? Number(x.investedValue) : 0), 0);
    const dif = pv.position.value - inv;
    paraVoce.push({
      rotulo: "Você tem",
      valor: money(pv.position.value, { round: true }),
      detalhe: `${numBR(pv.position.percentOfPortfolio * 100)}% da carteira${inv > 0 ? ` · ${money(Math.abs(dif), { round: true })} ${dif >= 0 ? "de lucro" : "de prejuízo"}` : ""}`,
    });
  }
  if (pv.strategy) {
    const s = pv.strategy;
    paraVoce.push({
      rotulo: "No seu plano",
      valor: `${s.classLabel}: ${Math.round(s.currentPercent * 100)}% de ${Math.round(s.targetPercent * 100)}%`,
      detalhe: s.status === "DENTRO" ? "Dentro do plano" : s.status === "ACIMA" ? "Acima do plano: já tem bastante" : "Abaixo do plano",
    });
  }
  const porMil = tipo === "FII" ? (dyFii !== null ? (1000 * dyFii) / 100 / 12 : null) : pv.monthlyIncomePerThousand;
  if (porMil !== null && porMil > 0) {
    paraVoce.push({ rotulo: `A cada ${money(1000, { round: true })}`, valor: `uns ${money(porMil, { round: true })} por mês`, detalhe: "pelo que pagou em 12 meses" });
  }

  // Comparar com outro do mesmo tipo que ela tem (o mais pesado).
  const outros = assets
    .filter((x) => (x.ticker ?? "").trim().toUpperCase() !== ticker && tipoDaAnalise(x) === tipo)
    .sort((x, y) => Number(y.currentValue) - Number(x.currentValue));
  const comparaCom = outros[0]?.ticker?.trim().toUpperCase() ?? null;

  const centro = cotacao !== null ? (moeda === "USD" ? `US$ ${num2(cotacao)}` : money(cotacao)) : null;
  const fontes = [`Investidor10 · lido ${quando(ficha.laudoReadAt ?? new Date(laudo.readAt))}`];

  return {
    ticker,
    titulo: ticker,
    subtitulo: ficha.companyName || nomeConhecido(ticker) || (a && a.name.toUpperCase() !== ticker ? a.name : null),
    perguntas,
    logo: logoDe(ficha.companyName, nomeConhecido(ticker), a?.name),
    centro,
    fonte: fontes.join(" · "),
    paraVoce,
    numeros: numerosDe(tipo, ind, dyFii),
    naCarteira: meus.length > 0,
    comparaCom,
    aviso: AVISO[tipo],
  };
}
