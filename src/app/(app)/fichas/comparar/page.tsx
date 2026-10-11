import Link from "next/link";
import { getRequiredSession } from "@/lib/auth/session";
import { listAssets } from "@/lib/repositories/asset.repo";
import { cotacaoDoAtivo, fichasPorTicker, indicadoresDoLaudo, logoDe, proventosDe } from "@/lib/analysis/analises-dados";
import { gruposComparar, perguntasDoAtivo, proventosMensais, type Pergunta } from "@/lib/analysis/quatro-perguntas";
import { nomeConhecido } from "@/lib/analysis/tipo-do-ticker";
import { CompararTela } from "../analises/CompararTela";

const AVISO = {
  STOCK: "Empresas de setores diferentes têm números normais diferentes.",
  STOCK_INTL: "Empresas de setores diferentes têm números normais diferentes.",
  FII: "Fundo de papel e fundo de tijolo não se comparam por todos os números.",
  ETF: "Rentabilidade passada não garante a futura.",
} as const;

/** Comparar dois do mesmo tipo (rodada 56). Escolhe entre os ativos já lidos da carteira e das fichas. */
export default async function CompararPage(props: PageProps<"/fichas/comparar">) {
  const sp = await props.searchParams;
  const ctx = await getRequiredSession();
  const hoje = new Date();
  const [fichas, assets] = await Promise.all([fichasPorTicker(ctx), listAssets(ctx)]);
  // Ações primeiro: é o Comparar do protótipo (ITSA4 x BBAS3); depois FIIs e ETFs.
  const ordemDoTipo = { STOCK: 0, STOCK_INTL: 1, FII: 2, ETF: 3 } as const;
  const pesoNaCarteira = (t: string) => assets.filter((x) => (x.ticker ?? "").trim().toUpperCase() === t.toUpperCase()).reduce((s, x) => s + Number(x.currentValue), 0);
  const lidas = [...fichas.values()]
    .filter((f) => f.laudo)
    .sort((x, y) => ordemDoTipo[x.sheetType] - ordemDoTipo[y.sheetType] || pesoNaCarteira(y.ticker) - pesoNaCarteira(x.ticker));
  const pedido = (k: "a" | "b") => (typeof sp[k] === "string" ? (sp[k] as string).trim().toUpperCase() : null);
  const fa = lidas.find((f) => f.ticker.toUpperCase() === pedido("a")) ?? lidas[0];
  const tipoDe = (t: string) => (t === "STOCK_INTL" ? "STOCK" : t);
  const mesmoTipo = lidas.filter((f) => fa && tipoDe(f.sheetType) === tipoDe(fa.sheetType));
  const fb = mesmoTipo.find((f) => f.ticker.toUpperCase() === pedido("b") && f.ticker !== fa?.ticker) ?? mesmoTipo.find((f) => f.ticker !== fa?.ticker);

  if (!fa || !fb) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-2 rounded-3xl border border-border bg-surface px-6 py-10 text-center">
        <p className="text-lg font-medium text-ink">Para comparar, são dois do mesmo tipo</p>
        <p className="max-w-xs text-sm text-ink-muted">Duas ações, dois fundos imobiliários ou dois ETFs já analisados.</p>
        <Link href="/fichas" className="mt-2 min-h-11 px-3 py-2 text-sm font-medium text-accent-strong">Voltar às Análises</Link>
      </div>
    );
  }

  const tickers = [fa.ticker.toUpperCase(), fb.ticker.toUpperCase()];
  const proventos = await proventosDe(tickers);
  const lado = (f: typeof fa) => {
    const tk = f.ticker.toUpperCase();
    const ativo = assets.find((x) => (x.ticker ?? "").trim().toUpperCase() === tk);
    const cotacao = ativo ? cotacaoDoAtivo(ativo) : null;
    const prov = proventos.get(tk) ?? [];
    const ind = indicadoresDoLaudo(f.laudo!);
    const perguntas: Pergunta[] = perguntasDoAtivo({ tipo: f.sheetType, ticker: tk, indicadores: ind, cotacao, moeda: ativo?.currency === "USD" ? "USD" : "BRL", proventos: prov, hoje });
    const m = f.sheetType === "FII" ? proventosMensais(prov, hoje) : null;
    const dy = m && cotacao ? (m.valores.reduce((t, v) => t + v, 0) / cotacao) * 100 : null;
    return { ticker: tk, logo: logoDe(f.companyName, nomeConhecido(tk), ativo?.name), perguntas, ind, dy };
  };
  const A = lado(fa);
  const B = lado(fb);
  const grupos = gruposComparar(fa.sheetType, A.ind, B.ind, { dyA: A.dy, dyB: B.dy });

  // A frase do fim, só com o que as duas têm (ações): paga bem? quem está mais barata?
  let frase: string | null = null;
  if (tipoDe(fa.sheetType) === "STOCK") {
    const g = (P: Pergunta[], k: string) => P.find((x) => x.k === k)?.f ?? null;
    const pa = g(A.perguntas, "paga"), pb = g(B.perguntas, "paga");
    const ordem = { forte: 3, ok: 2, atencao: 1 } as const;
    const ca = g(A.perguntas, "preco"), cb = g(B.perguntas, "preco");
    const partes: string[] = [];
    if (pa && pb) partes.push(pa === "forte" && pb === "forte" ? "As duas pagam bem." : pa === pb ? "As duas pagam pouco." : `${pa === "forte" ? A.ticker : B.ticker} paga mais.`);
    if (ca && cb) partes.push(ordem[ca] === ordem[cb] ? "O preço está parecido." : `${ordem[ca] > ordem[cb] ? A.ticker : B.ticker} está mais barata hoje.`);
    frase = partes.length ? partes.join(" ") : null;
  }

  const opcoes = mesmoTipo.map((f) => f.ticker.toUpperCase());
  return (
    <CompararTela
      a={{ ticker: A.ticker, logo: A.logo, perguntas: A.perguntas }}
      b={{ ticker: B.ticker, logo: B.logo, perguntas: B.perguntas }}
      grupos={grupos}
      opcoes={opcoes}
      frase={frase}
      aviso={AVISO[fa.sheetType]}
    />
  );
}
