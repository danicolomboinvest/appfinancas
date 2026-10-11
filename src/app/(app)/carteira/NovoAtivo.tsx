"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, FileUp, Globe, Landmark, PiggyBank, Search, TrendingUp } from "lucide-react";
import { useCurrency, useMoney } from "@/components/money/MoneyProvider";
import { currencySymbol } from "@/lib/money";
import { useToast } from "@/components/ui/toast-context";
import { Explica } from "@/components/ui/Explica";
import { searchTickersAction } from "@/lib/market/actions";
import type { TickerKind } from "@/lib/market/ticker-search";
import { NOME_DO_TIPO, type Onde, type Tipo } from "@/lib/portfolio/classificacao";
import { estimarRendaFixa, mesesDesde, textoDoRendimento, type Rendimento } from "@/lib/portfolio/estimativa-renda-fixa";
import { createAssetAction } from "./actions";
import { cotacaoDoNovoAtivoAction, type CotacaoDoNovoAtivo } from "./carteira-nova-actions";
import type { NumeroDeFora } from "./dados";

/**
 * Novo ativo pela busca (rodada 23, novo-ativo-proposta.html): "Onde você investiu?" reconhece e
 * classifica sozinha; uma pergunta por tela, só com o que o tipo precisa; o rendimento em
 * pílulas ("Não sei" estima com 100% do CDI e marca "estimado"); "É para alguma meta?"; e a
 * revelação. Todo número de fora mostra a origem e a hora; se a fonte falhar, a tela diz e
 * pergunta o valor (nunca inventa). Fundo: ela diz a classe e o app classifica por ela.
 */

export type TituloParaBusca = { nome: string; tipo: string; preco: number; taxa: number | null; fonte: string; quando: string; velho: boolean };

type Achado =
  | { k: "tesouro"; nome: string; sub: string; titulo: TituloParaBusca | null }
  | { k: "rf"; nome: string; sub: string }
  | { k: "bolsa"; nome: string; sub: string; ticker: string; classe: "ACAO" | "FII" | "INTERNACIONAL" }
  | { k: "ext"; nome: string; sub: string; ticker: string }
  | { k: "fundo"; nome: string; sub: string };

const PRODUTOS = ["CDB", "LCI", "LCA", "Caixinha", "RDB", "Poupança"];
const BANCOS = ["Nubank", "Banco Inter", "Itaú", "Banco do Brasil", "Caixa", "Bradesco", "Santander", "C6 Bank", "Mercado Pago", "PicPay", "XP", "BTG Pactual", "PagBank", "Sicredi", "Sicoob", "EQI"];
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** ETF da B3 que investe lá fora: conta como Exterior. */
const ETF_DE_FORA = /s&p|sp ?500|nasdaq|global|eua|usa|mundo|world|europa|china|ivvb|nasd|spxi|wrld|acwi|xina|euro/i;

function buscarLocal(q: string, titulos: TituloParaBusca[]): Achado[] {
  const t = semAcento(q.trim());
  if (!t) return [];
  const palavras = t.split(/\s+/);
  const r: Achado[] = [];
  for (const ti of titulos) {
    const alvo = semAcento(`tesouro direto ${ti.nome} ${ti.tipo}`);
    if (palavras.every((w) => alvo.includes(w)) || (t === "pre" && /prefixado/i.test(ti.tipo))) {
      r.push({ k: "tesouro", nome: ti.nome, sub: ti.taxa !== null ? `${taxaDoTitulo(ti)} hoje` : "Tesouro Direto", titulo: ti });
    }
  }
  const produtos = PRODUTOS.filter((p) => palavras.some((w) => semAcento(p).startsWith(w)));
  const bancos = BANCOS.filter((b) => palavras.some((w) => w.length >= 2 && semAcento(b).split(" ").some((x) => x.startsWith(w) && !["banco", "do", "bank"].includes(x))));
  const combos = (produtos.length ? produtos : bancos.length ? ["CDB", "Caixinha"] : []).flatMap((p) => (bancos.length ? bancos.slice(0, 3).map((b) => `${p} ${b}`) : [p]));
  for (const c of combos) r.push({ k: "rf", nome: c, sub: "Renda fixa" });
  if (/fundo|fic|fia|multi/.test(t)) r.push({ k: "fundo", nome: q.trim().replace(/^\w/, (x) => x.toUpperCase()), sub: "Fundo de investimento" });
  return r;
}

function taxaDoTitulo(t: TituloParaBusca): string {
  if (t.taxa === null) return "";
  const n = t.taxa.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (/Selic/.test(t.tipo)) return `Selic + ${n}%`;
  if (/IPCA|Renda\+|Educa\+/.test(t.tipo)) return `IPCA + ${n}%`;
  return `${n}% ao ano`;
}

type Passo = "busca" | "classe" | "inv" | "quando" | "rende" | "taxa" | "hoje" | "cotas" | "pm" | "confere" | "meta" | "fim";

const PASSOS: Record<Achado["k"], Passo[]> = {
  tesouro: ["inv", "quando", "taxa", "hoje", "meta"],
  rf: ["inv", "quando", "rende", "confere", "meta"],
  bolsa: ["cotas", "pm", "confere", "meta"],
  ext: ["cotas", "pm", "confere", "meta"],
  fundo: ["classe", "inv", "hoje", "meta"],
};

const CLASSES_DE_FUNDO: [string, string, Tipo, Onde][] = [
  ["rf", "Fundo de renda fixa", "pos", "brasil"],
  ["acoes", "Fundo de ações", "acoes", "brasil"],
  ["mm", "Fundo multimercado", "multimercado", "brasil"],
  ["ext", "Fundo de investimento no exterior", "acoes", "exterior"],
  ["fii", "Fundo imobiliário", "fiis", "brasil"],
];

const lerNumero = (s: string) => {
  const limpo = s.replace(/[^\d,.]/g, "");
  const n = Number(limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo);
  return Number.isFinite(n) ? n : 0;
};
const MES_A = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function NovoAtivo({
  metas,
  totalAntes,
  titulos,
  cdi,
  cdiFracao,
  ipca,
  ipcaFracao,
  onImportar,
  onManual,
  onFechar,
}: {
  metas: { id: string; nome: string }[];
  totalAntes: number;
  titulos: TituloParaBusca[];
  cdi: NumeroDeFora | null;
  cdiFracao: number | null;
  ipca: NumeroDeFora | null;
  ipcaFracao: number | null;
  onImportar: () => void;
  onManual: () => void;
  onFechar: () => void;
}) {
  const money = useMoney();
  const moedaDoApp = useCurrency();
  const router = useRouter();
  const { showError } = useToast();
  const [passo, setPasso] = useState<Passo>("busca");
  const [q, setQ] = useState("");
  const [tickers, setTickers] = useState<Achado[]>([]);
  const [x, setX] = useState<Achado | null>(null);
  const [inv, setInv] = useState("");
  const [hojeTxt, setHojeTxt] = useState("");
  const [qtdTitulos, setQtdTitulos] = useState("");
  const [modoHoje, setModoHoje] = useState<"valor" | "titulos">("valor");
  const hojeData = new Date();
  const [ano, setAno] = useState(hojeData.getFullYear());
  const [quando, setQuando] = useState<{ ano: number; mes: number } | null>(null);
  const [naoLembro, setNaoLembro] = useState(false);
  const [rende, setRende] = useState<Rendimento | null>(null);
  const [naoSei, setNaoSei] = useState(false);
  const [cotas, setCotas] = useState("");
  const [pm, setPm] = useState("");
  const [cot, setCot] = useState<CotacaoDoNovoAtivo | null>(null);
  const [fundo, setFundo] = useState<string | null>(null);
  const [exato, setExato] = useState(false);
  const [meta, setMeta] = useState<string | null>(null);
  const [taxaTxt, setTaxaTxt] = useState("");
  const [taxaNaoSei, setTaxaNaoSei] = useState(false);
  const [salvando, startSalvar] = useTransition();
  const [buscando, startBuscar] = useTransition();
  const ultimaBusca = useRef("");

  // Ações, FIIs, ETFs e o exterior vêm da busca do app (a mesma do formulário de sempre).
  useEffect(() => {
    const termo = q.trim();
    if (termo.length < 2) return;
    const id = setTimeout(() => {
      ultimaBusca.current = termo;
      startBuscar(async () => {
        const kinds: TickerKind[] = ["STOCK", "FII", "ETF", "BDR", "STOCK_INTL", "ETF_INTL"];
        const hits = await searchTickersAction(termo, kinds).catch(() => []);
        if (ultimaBusca.current !== termo) return;
        setTickers(
          hits.slice(0, 5).map((h): Achado => {
            if (h.kind === "STOCK_INTL" || h.kind === "ETF_INTL") return { k: "ext", nome: h.name || h.ticker, sub: `${h.ticker} · Exterior, em dólar`, ticker: h.ticker };
            if (h.kind === "FII") return { k: "bolsa", nome: h.name || h.ticker, sub: `${h.ticker} · FII`, ticker: h.ticker, classe: "FII" };
            if (h.kind === "ETF") {
              const fora = ETF_DE_FORA.test(`${h.ticker} ${h.name}`);
              return { k: "bolsa", nome: h.name || h.ticker, sub: `${h.ticker} · ETF${fora ? " · Exterior" : ""}`, ticker: h.ticker, classe: fora ? "INTERNACIONAL" : "ACAO" };
            }
            return { k: "bolsa", nome: h.name || h.ticker, sub: `${h.ticker} · ${h.kind === "BDR" ? "BDR" : "Ação"}`, ticker: h.ticker, classe: "ACAO" };
          }),
        );
      });
    }, 250);
    return () => clearTimeout(id);
  }, [q]);

  const achados = useMemo(() => [...buscarLocal(q, titulos), ...(q.trim().length >= 2 ? tickers : [])].slice(0, 7), [q, titulos, tickers]);

  // Tesouro Selic rende a Selic: não há "taxa da compra" para perguntar.
  const passosDe = (a: Achado): Passo[] => (a.k === "tesouro" && /selic/i.test(a.titulo?.tipo ?? a.nome) ? PASSOS.tesouro.filter((p) => p !== "taxa") : PASSOS[a.k]);
  const passos = x ? passosDe(x) : [];
  const i = passos.indexOf(passo);

  const escolher = (a: Achado) => {
    setX(a);
    setCot(null);
    setPasso(passosDe(a)[0]);
    if (a.k === "bolsa" || a.k === "ext") {
      cotacaoDoNovoAtivoAction(a.ticker, a.k === "ext").then(setCot).catch(() => setCot({ preco: null, dolar: null, em: new Date().toISOString() }));
    }
  };
  const voltar = () => {
    if (passo === "busca") return onFechar();
    if (i <= 0) return setPasso("busca");
    setPasso(passos[i - 1]);
  };
  const avancar = () => (i >= 0 && i < passos.length - 1 ? setPasso(passos[i + 1]) : null);

  const investido = lerNumero(inv);
  const qtd = lerNumero(cotas);
  const precoMedio = lerNumero(pm);
  const ehExt = x?.k === "ext";
  const dolar = cot?.dolar ?? null;
  const horaDaCotacao = cot ? new Date(cot.em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
  const meses = quando ? mesesDesde(quando.ano, quando.mes, hojeData) : null;
  const rendimento: Rendimento | null = naoSei ? { indexador: "cdi", percentual: 100 } : rende;
  const estimado = x?.k === "rf" && rendimento && meses !== null ? estimarRendaFixa({ investido, meses, rende: rendimento, cdiAoAno: cdiFracao, ipca12m: ipcaFracao }) : null;
  const tit = x?.k === "tesouro" ? x.titulo : null;
  const valorHoje = (() => {
    if (!x) return 0;
    if (x.k === "bolsa") return qtd * (cot?.preco ?? precoMedio);
    if (x.k === "ext") return qtd * (cot?.preco ?? precoMedio) * (dolar ?? 1);
    if (x.k === "tesouro") return modoHoje === "titulos" && tit ? lerNumero(qtdTitulos) * tit.preco : lerNumero(hojeTxt);
    if (x.k === "rf") return exato || estimado === null ? lerNumero(hojeTxt) : estimado;
    return lerNumero(hojeTxt);
  })();
  const investidoFinal = x && (x.k === "bolsa" || x.k === "ext") ? qtd * precoMedio * (ehExt ? (dolar ?? 1) : 1) : investido;

  function salvar() {
    if (!x) return;
    const fd = new FormData();
    const nome = x.k === "bolsa" || x.k === "ext" ? x.ticker : x.nome;
    fd.set("name", x.k === "bolsa" || x.k === "ext" ? x.ticker : x.k === "rf" && rendimento && !naoSei ? `${x.nome} ${textoDoRendimento(rendimento)}` : nome);
    if (x.k === "bolsa" || x.k === "ext") fd.set("ticker", x.ticker);
    const classe = x.k === "tesouro" ? "TESOURO_DIRETO" : x.k === "rf" ? "RENDA_FIXA" : x.k === "bolsa" ? x.classe : x.k === "ext" ? "INTERNACIONAL" : "FUNDO";
    fd.set("assetClass", classe);
    if (x.k === "tesouro") fd.set("fixedIncomeIndex", /IPCA|Renda\+|Educa\+/.test(x.titulo?.tipo ?? x.nome) ? "IPCA" : /Prefixado/i.test(x.titulo?.tipo ?? x.nome) ? "PREFIXADO" : "POS_FIXADO");
    if (x.k === "rf" && rendimento) fd.set("fixedIncomeIndex", rendimento.indexador === "ipca" ? "IPCA" : rendimento.indexador === "pre" ? "PREFIXADO" : "POS_FIXADO");
    if (x.k === "fundo" && fundo) {
      const c = CLASSES_DE_FUNDO.find((f) => f[0] === fundo)!;
      fd.set("tipoEscolhido", c[2]);
      fd.set("ondeEscolhido", c[3]);
    }
    if (meta?.startsWith("meta:")) {
      fd.set("objective", "META");
      fd.set("goalId", meta.slice(5));
    } else fd.set("objective", meta === "reserva" ? "RESERVA_EMERGENCIA" : meta === "liberdade" ? "LIBERDADE_FINANCEIRA" : "OUTRO");
    if (x.k === "ext") {
      fd.set("assetCurrency", "USD");
      fd.set("quantity", String(qtd).replace(".", ","));
      fd.set("investedValue", String(Math.round(qtd * precoMedio * 100) / 100));
      if (cot?.preco) fd.set("currentValue", String(Math.round(qtd * cot.preco * 100) / 100));
    } else if (x.k === "bolsa") {
      fd.set("quantity", String(qtd).replace(".", ","));
      fd.set("investedValue", String(Math.round(qtd * precoMedio * 100) / 100));
      fd.set("currentValue", String(Math.round(valorHoje * 100) / 100));
    } else {
      fd.set("investedValue", String(investido));
      fd.set("currentValue", String(Math.round((valorHoje > 0 ? valorHoje : investido) * 100) / 100));
      if (x.k === "tesouro" && modoHoje === "titulos" && lerNumero(qtdTitulos) > 0) fd.set("quantity", String(lerNumero(qtdTitulos)).replace(".", ","));
    }
    // A taxa em que ela comprou (Asset.taxaCompra): no CDB, a da pergunta "Quanto rende?"; no
    // Tesouro, a da pergunta "Qual taxa você comprou?". "Não sei" não grava nada.
    if (x.k === "rf" && rendimento && !naoSei) fd.set("taxaCompra", String(rendimento.indexador === "cdi" ? rendimento.percentual : rendimento.taxa).replace(".", ","));
    if (x.k === "tesouro" && !taxaNaoSei && lerNumero(taxaTxt) > 0) fd.set("taxaCompra", taxaTxt);
    if (quando) fd.set("acquisitionDate", `${quando.ano}-${String(quando.mes).padStart(2, "0")}-01`);
    startSalvar(async () => {
      const r = await createAssetAction({}, fd);
      if (r.error) return showError(r.error);
      setPasso("fim");
      router.refresh();
    });
  }

  const reiniciar = () => {
    setPasso("busca");
    setQ("");
    setX(null);
    setInv("");
    setHojeTxt("");
    setQtdTitulos("");
    setQuando(null);
    setNaoLembro(false);
    setRende(null);
    setNaoSei(false);
    setCotas("");
    setPm("");
    setFundo(null);
    setExato(false);
    setMeta(null);
    setTaxaTxt("");
    setTaxaNaoSei(false);
  };

  const ok = (() => {
    switch (passo) {
      case "classe":
        return fundo !== null;
      case "inv":
        return investido > 0;
      case "quando":
        return quando !== null || naoLembro;
      case "rende":
        return rendimento !== null;
      case "taxa":
        return taxaNaoSei || lerNumero(taxaTxt) > 0;
      case "hoje":
        return valorHoje > 0;
      case "cotas":
        return qtd > 0;
      case "pm":
        return precoMedio > 0;
      case "confere":
        return valorHoje > 0;
      case "meta":
        return meta !== null;
      default:
        return true;
    }
  })();

  // ————— telas —————
  if (passo === "fim" && x) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-3xl p-5" style={{ background: "linear-gradient(145deg, var(--color-heroi-de), var(--color-heroi-para))", color: "var(--color-heroi-tinta)" }}>
          <p className="text-[14px] text-heroi-suave">Entrou na sua carteira</p>
          <p className="mt-1 text-[2.25rem] font-light leading-none tracking-[-0.03em] tabular-nums">{money(totalAntes + valorHoje)}</p>
          <p className="mt-1 text-[14px] text-heroi-suave">Agora o app acompanha por você</p>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 p-3.5">
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-medium text-ink">{x.k === "bolsa" || x.k === "ext" ? x.ticker : x.nome}</span>
            <span className="block text-[12.5px] text-ink-muted">{x.sub}</span>
          </span>
          <span className="text-right">
            <span className="block text-[15px] font-medium tabular-nums text-ink">{money(valorHoje > 0 ? valorHoje : investido)}</span>
            {x.k === "rf" && !exato && estimado !== null && <span className="block text-[12px] text-ink-muted">estimado</span>}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={reiniciar} className="min-h-12 rounded-full bg-accent-gradient text-[15px] font-medium text-on-accent">
            Adicionar outro
          </button>
          <button type="button" onClick={onFechar} className="min-h-12 rounded-full bg-surface-2 text-[15px] font-medium text-ink">
            Ver carteira
          </button>
        </div>
      </div>
    );
  }

  if (passo === "busca") {
    return (
      <div className="flex flex-col gap-4">
        <p className="titulo-tema text-[26px] font-light leading-tight text-ink">Onde você investiu?</p>
        <label className="glass flex min-h-12 items-center gap-2.5 rounded-full px-4">
          <Search size={18} className="shrink-0 text-ink-muted" aria-hidden />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ex.: ipca, cdb inter, itsa, voo, mxrf"
            aria-label="Onde você investiu"
            className="min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-faint"
            autoComplete="off"
          />
        </label>
        {q.trim() ? (
          <div className="flex flex-col">
            {achados.map((a, k) => (
              <button key={`${a.k}-${a.nome}-${k}`} type="button" onClick={() => escolher(a)} className="flex min-h-14 items-center gap-3 border-t border-border py-2.5 text-left first:border-t-0">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-muted" aria-hidden>
                  {a.k === "tesouro" ? <Landmark size={17} /> : a.k === "rf" ? <PiggyBank size={17} /> : a.k === "ext" ? <Globe size={17} /> : <TrendingUp size={17} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-ink">{a.nome}</span>
                  <span className="block truncate text-[12.5px] text-ink-muted">{a.sub}</span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-ink-faint" />
              </button>
            ))}
            {achados.length === 0 && !buscando && <p className="py-2 text-[14px] text-ink-muted">Não achei pelo nome.</p>}
            <button type="button" onClick={() => escolher({ k: "fundo", nome: q.trim(), sub: "Fundo de investimento" })} className="mt-1 min-h-11 text-left text-[14px] text-ink-muted underline underline-offset-[3px]">
              É um fundo
            </button>
            <button type="button" onClick={onManual} className="min-h-11 text-left text-[14px] font-medium text-ink underline underline-offset-[3px]">
              Adicionar do meu jeito
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              {(
                [
                  ["ipca", "Tesouro Direto", "Selic, IPCA+", Landmark],
                  ["cdb", "CDB ou caixinha", "LCI, LCA também", PiggyBank],
                  ["itsa", "Ações e FIIs", "ETF da bolsa", TrendingUp],
                  ["voo", "Exterior", "Em dólar", Globe],
                ] as const
              ).map(([termo, t, s, Icone]) => (
                <button key={termo} type="button" onClick={() => setQ(termo)} className="glass flex min-h-[104px] flex-col items-start justify-between gap-2 rounded-3xl p-3.5 text-left">
                  <span className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-ink" aria-hidden>
                    <Icone size={18} strokeWidth={1.7} />
                  </span>
                  <span>
                    <span className="block text-[15px] font-medium text-ink">{t}</span>
                    <span className="block text-[12.5px] text-ink-muted">{s}</span>
                  </span>
                </button>
              ))}
            </div>
            <button type="button" onClick={onImportar} className="flex min-h-14 items-center gap-3 rounded-3xl bg-pill px-4 py-3 text-left text-on-pill">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,currentColor_12%,transparent)]" aria-hidden>
                <FileUp size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium">Importar da B3</span>
                <span className="block text-[12.5px] opacity-75">Traz tudo de uma vez</span>
              </span>
              <ChevronRight size={18} className="shrink-0 opacity-75" />
            </button>
          </>
        )}
      </div>
    );
  }

  if (!x) return null;
  const campo = CAMPO_GRANDE;
  const fonteDoIndice = rendimento?.indexador === "ipca" ? ipca : cdi;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={voltar} className="-ml-1 inline-flex min-h-11 items-center gap-1 text-[14px] text-ink-muted">
          <ChevronLeft size={18} /> Voltar
        </button>
        <span className="text-[13px] tabular-nums text-ink-muted">
          {i + 1} de {passos.length}
        </span>
      </div>
      <div className="flex gap-1" aria-hidden>
        {passos.map((p, k) => (
          <span key={p} className={`h-1 flex-1 rounded-full ${k <= i ? "bg-ink" : "bg-surface-2"}`} />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-medium text-ink">{x.k === "bolsa" || x.k === "ext" ? x.ticker : x.nome}</span>
          <span className="block truncate text-[12.5px] text-ink-muted">
            {x.k === "fundo" && fundo ? `${CLASSES_DE_FUNDO.find((f) => f[0] === fundo)![1]} · você escolheu` : x.sub}
          </span>
        </span>
      </div>

      {passo === "classe" && (
        <div className="flex flex-col gap-2.5">
          <p className="text-[18px] text-ink">Que tipo de fundo é?</p>
          {CLASSES_DE_FUNDO.map(([k, nome, tipo, onde]) => (
            <button key={k} type="button" onClick={() => setFundo(k)} aria-pressed={fundo === k} className={`flex min-h-12 items-center justify-between rounded-2xl border px-4 text-left text-[15px] ${fundo === k ? "border-transparent bg-pill text-on-pill" : "border-border text-ink"}`}>
              {nome}
              <span className={`text-[12px] ${fundo === k ? "opacity-80" : "text-ink-muted"}`}>
                {NOME_DO_TIPO[tipo]}
                {onde === "exterior" ? " · Exterior" : ""}
              </span>
            </button>
          ))}
          <p className="text-[12.5px] text-ink-muted">Está no nome do fundo ou no app do banco. Fundo de renda fixa não conta como renda variável.</p>
        </div>
      )}

      {passo === "inv" && (
        <div className="flex flex-col gap-2.5">
          <p className="text-[18px] text-ink">Quanto você investiu?</p>
          <Valor v={inv} set={setInv} rotulo="Quanto você investiu" />
          <div className="flex flex-wrap gap-2">
            {[500, 1000, 3000, 5000, 10000].map((v) => (
              <button key={v} type="button" onClick={() => setInv(String(v))} className="min-h-10 rounded-full border border-border-strong px-3.5 text-[14px] text-ink">
                {money(v, { round: true })}
              </button>
            ))}
          </div>
          <p className="text-[12.5px] text-ink-muted">Some todas as compras desse {x.k === "tesouro" ? "título" : "investimento"}.</p>
        </div>
      )}

      {passo === "quando" && (
        <div className="flex flex-col gap-3">
          <p className="text-[18px] text-ink">Quando foi a compra?</p>
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setAno(ano - 1)} aria-label="Ano anterior" className="flex size-11 items-center justify-center rounded-full text-ink">
              <ChevronLeft size={18} />
            </button>
            <span className="text-[16px] font-medium tabular-nums text-ink">{ano}</span>
            <button type="button" onClick={() => setAno(Math.min(hojeData.getFullYear(), ano + 1))} disabled={ano >= hojeData.getFullYear()} aria-label="Próximo ano" className="flex size-11 items-center justify-center rounded-full text-ink disabled:opacity-30">
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {MES_A.map((m, k) => {
              const futuro = ano === hojeData.getFullYear() && k > hojeData.getMonth();
              const on = quando?.ano === ano && quando.mes === k + 1;
              return (
                <button key={m} type="button" disabled={futuro} onClick={() => { setQuando({ ano, mes: k + 1 }); setNaoLembro(false); }} className={`min-h-11 rounded-full text-[14px] ${on ? "bg-pill font-medium text-on-pill" : "bg-surface-2 text-ink"} disabled:opacity-30`}>
                  {m}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => { setNaoLembro(true); setQuando(null); }} aria-pressed={naoLembro} className={`min-h-11 w-fit rounded-full px-4 text-[14px] ${naoLembro ? "bg-pill text-on-pill" : "border border-border-strong text-ink"}`}>
            Não lembro
          </button>
          <p className="text-[12.5px] text-ink-muted">Se foram várias compras, use a primeira.</p>
        </div>
      )}

      {passo === "rende" && (
        <div className="flex flex-col gap-3">
          <p className="text-[18px] text-ink">Quanto rende?</p>
          <div className="flex flex-wrap gap-2">
            {([{ indexador: "cdi", percentual: 100 }, { indexador: "cdi", percentual: 110 }, { indexador: "ipca", taxa: 6 }, { indexador: "pre", taxa: 12 }] as Rendimento[]).map((r) => {
              const on = !naoSei && rende && textoDoRendimento(rende) === textoDoRendimento(r);
              return (
                <button key={textoDoRendimento(r)} type="button" onClick={() => { setRende(r); setNaoSei(false); }} className={`min-h-11 rounded-full px-4 text-[14px] ${on ? "bg-pill font-medium text-on-pill" : "border border-border-strong text-ink"}`}>
                  {textoDoRendimento(r)}
                </button>
              );
            })}
            <button type="button" onClick={() => { setNaoSei(true); setRende(null); }} className={`min-h-11 rounded-full px-4 text-[14px] ${naoSei ? "bg-pill font-medium text-on-pill" : "border border-border-strong text-ink"}`}>
              Não sei
            </button>
          </div>
          <OutraTaxa onEscolher={(r) => { setRende(r); setNaoSei(false); }} />
          <p className="text-[12.5px] text-ink-muted">{naoSei ? "Vou estimar com 100% do CDI e marcar como estimado. Confira no banco depois." : "Está no app do banco, ao lado do nome."}</p>
        </div>
      )}

      {passo === "taxa" && x.k === "tesouro" && (
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-1.5 text-[18px] text-ink">
            Qual taxa você comprou?
            <Explica>Está no app da corretora ou no extrato do Tesouro, ao lado do título. No IPCA+, só o número depois do IPCA (7,5 para IPCA + 7,5%). Se não souber, toque em Não sei.</Explica>
          </p>
          <label className="flex items-baseline gap-2 rounded-3xl bg-surface-2 px-4 py-3">
            {/IPCA|Renda\+|Educa\+/.test(x.titulo?.tipo ?? x.nome) && <span className="text-[15px] text-ink-muted">IPCA +</span>}
            <input inputMode="decimal" value={taxaTxt} onChange={(e) => { setTaxaTxt(e.target.value); setTaxaNaoSei(false); }} placeholder="0,00" aria-label="Taxa da compra" className={campo} />
            <span className="text-[15px] text-ink-muted">% ao ano</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {tit?.taxa !== null && tit?.taxa !== undefined && (
              <button type="button" onClick={() => { setTaxaTxt(tit.taxa!.toLocaleString("pt-BR", { maximumFractionDigits: 2 })); setTaxaNaoSei(false); }} className="min-h-11 rounded-full border border-border-strong px-4 text-[14px] text-ink">
                A de hoje: {taxaDoTitulo(tit)}
              </button>
            )}
            <button type="button" onClick={() => { setTaxaNaoSei(true); setTaxaTxt(""); }} aria-pressed={taxaNaoSei} className={`min-h-11 rounded-full px-4 text-[14px] ${taxaNaoSei ? "bg-pill font-medium text-on-pill" : "border border-border-strong text-ink"}`}>
              Não sei
            </button>
          </div>
          {tit?.taxa !== null && tit?.taxa !== undefined && <p className="text-[12.5px] text-ink-muted">A taxa de hoje é do {tit.fonte} · {tit.quando}. A sua pode ser outra: vale a do dia em que você comprou.</p>}
        </div>
      )}

      {passo === "hoje" && (
        <div className="flex flex-col gap-3">
          <p className="text-[18px] text-ink">Quanto vale hoje?</p>
          {x.k === "tesouro" && tit && (
            <div role="radiogroup" aria-label="Como você sabe" className="grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1">
              {(["valor", "titulos"] as const).map((m) => (
                <button key={m} type="button" role="radio" aria-checked={modoHoje === m} onClick={() => setModoHoje(m)} className={`min-h-10 rounded-full text-[14px] ${modoHoje === m ? "bg-surface font-medium text-ink shadow-sm" : "text-ink-muted"}`}>
                  {m === "valor" ? "Sei o valor" : "Sei quantos títulos"}
                </button>
              ))}
            </div>
          )}
          {x.k === "tesouro" && tit && modoHoje === "titulos" ? (
            <>
              <label className="flex items-baseline gap-2 rounded-3xl bg-surface-2 px-4 py-3">
                <input inputMode="decimal" value={qtdTitulos} onChange={(e) => setQtdTitulos(e.target.value)} placeholder="0,00" aria-label="Quantos títulos" className={campo} />
                <span className="text-[15px] text-ink-muted">títulos</span>
              </label>
              {lerNumero(qtdTitulos) > 0 && <p className="text-[14px] tabular-nums text-ink">= {money(lerNumero(qtdTitulos) * tit.preco)}</p>}
            </>
          ) : (
            <Valor v={hojeTxt} set={setHojeTxt} rotulo="Quanto vale hoje" />
          )}
          {x.k === "tesouro" && tit && (
            <p className="text-[12.5px] text-ink-muted">
              Preço do título: {money(tit.preco)} · {tit.fonte} · {tit.quando}. Estimado, antes do IR e da taxa da B3.
            </p>
          )}
          {x.k !== "tesouro" && <p className="text-[12.5px] text-ink-muted">{x.k === "fundo" && fundo !== "rf" ? "Fundo de ações e multimercado não dá para estimar: o valor está no app do banco, em posição." : "O valor está no app do banco."}</p>}
        </div>
      )}

      {passo === "cotas" && (
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl bg-surface-2 p-3.5">
            <p className="text-[13px] text-ink-muted">{cot === null ? "Buscando a cotação de hoje" : cot.preco ? "Cotação de hoje" : "A fonte da cotação não respondeu agora"}</p>
            {cot?.preco ? (
              <>
                <p className="mt-0.5 text-[19px] font-medium tabular-nums text-ink">{ehExt ? `US$ ${cot.preco.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : money(cot.preco)}</p>
                <p className="text-[12px] text-ink-muted">
                  cotação de hoje · {horaDaCotacao}
                  {ehExt && dolar ? ` · dólar ${money(dolar)} · hoje · ${horaDaCotacao}` : ""}
                </p>
              </>
            ) : cot ? (
              <p className="text-[12.5px] text-ink-muted">O app busca de novo ao salvar. Enquanto isso, vale o preço médio.</p>
            ) : null}
          </div>
          <p className="text-[18px] text-ink">Quantas cotas você tem?</p>
          <label className="flex items-baseline gap-2 rounded-3xl bg-surface-2 px-4 py-3">
            <input inputMode="decimal" value={cotas} onChange={(e) => setCotas(e.target.value)} placeholder="0" aria-label="Cotas" className={campo} />
            <span className="text-[15px] text-ink-muted">cotas</span>
          </label>
        </div>
      )}

      {passo === "pm" && (
        <div className="flex flex-col gap-3">
          <p className="text-[18px] text-ink">Quanto pagou em cada uma, em média?</p>
          <Valor v={pm} set={setPm} rotulo="Preço médio" moeda={currencySymbol(ehExt ? "USD" : moedaDoApp)} />
          {precoMedio > 0 && qtd > 0 && (
            <p className="text-[14px] tabular-nums text-ink">
              {cotas} cotas × {currencySymbol(ehExt ? "USD" : moedaDoApp)} {precoMedio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} = <b className="font-medium">{ehExt ? `US$ ${(qtd * precoMedio).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : money(qtd * precoMedio)}</b> investidos
            </p>
          )}
          <p className="text-[12.5px] text-ink-muted">Na corretora aparece como preço médio.</p>
        </div>
      )}

      {passo === "confere" && (
        <div className="flex flex-col gap-3">
          <p className="text-[18px] text-ink">Confere?</p>
          {x.k === "rf" && (exato || estimado === null) ? (
            <>
              <Valor v={hojeTxt} set={setHojeTxt} rotulo="Quanto vale hoje" />
              <p className="text-[12.5px] text-ink-muted">{estimado === null ? "Sem a data da compra (ou sem o índice do Banco Central) não dá para estimar. O valor está no app do banco." : "O valor está no app do banco."}</p>
            </>
          ) : (
            <div className="rounded-3xl p-5" style={{ background: "linear-gradient(145deg, var(--color-heroi-de), var(--color-heroi-para))", color: "var(--color-heroi-tinta)" }}>
              <p className="text-[14px] text-heroi-suave">Vale hoje</p>
              <p className="mt-1 text-[2.25rem] font-light leading-none tracking-[-0.03em] tabular-nums">{money(valorHoje)}</p>
              <p className="mt-1.5 text-[13px] text-heroi-suave">
                {valorHoje - investidoFinal >= 0 ? "+" : "−"}
                {money(Math.abs(valorHoje - investidoFinal))}
                {quando ? ` desde ${MES_A[quando.mes - 1]} ${quando.ano}` : ""}
              </p>
              <p className="mt-2 text-[12.5px] text-heroi-suave">
                {x.k === "rf"
                  ? `${naoSei ? "Estimado com 100% do CDI" : `Estimado com ${textoDoRendimento(rendimento!)}`}, antes do IR. ${fonteDoIndice ? `${rendimento?.indexador === "ipca" ? "IPCA" : "CDI"} ${fonteDoIndice.valor} · ${fonteDoIndice.fonte} · ${fonteDoIndice.quando}` : ""}`
                  : cot?.preco
                    ? `${cotas} cotas × cotação de hoje · ${horaDaCotacao}`
                    : "Pelo preço médio (a cotação não respondeu)"}
              </p>
            </div>
          )}
          {x.k === "rf" && !exato && estimado !== null && (
            <button type="button" onClick={() => setExato(true)} className="min-h-11 rounded-full bg-surface-2 text-[14px] font-medium text-ink">
              Digitar o valor exato
            </button>
          )}
        </div>
      )}

      {passo === "meta" && (
        <div className="flex flex-col gap-2.5">
          <p className="text-[18px] text-ink">É para alguma meta?</p>
          <div className="flex flex-wrap gap-2">
            {[...metas.map((m) => [`meta:${m.id}`, m.nome] as [string, string]), ["liberdade", "Liberdade financeira"] as [string, string], ["reserva", "Reserva de emergência"] as [string, string], ["nenhuma", "Nenhuma por enquanto"] as [string, string]].map(([k, nome]) => (
              <button key={k} type="button" onClick={() => setMeta(k)} aria-pressed={meta === k} className={`min-h-11 rounded-full px-4 text-[14px] ${meta === k ? "bg-pill font-medium text-on-pill" : "border border-border-strong text-ink"}`}>
                {nome}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        disabled={!ok || salvando}
        onClick={() => (passo === "meta" ? salvar() : avancar())}
        className="mt-1 min-h-12 rounded-full bg-accent-gradient text-[15px] font-medium text-on-accent disabled:opacity-40"
      >
        {passo === "meta" ? (salvando ? "Adicionando..." : "Adicionar à carteira") : passo === "confere" ? "Está certo" : "Continuar"}
      </button>
    </div>
  );
}

const CAMPO_GRANDE = "min-w-0 flex-1 bg-transparent text-[2rem] font-light tabular-nums text-ink outline-none placeholder:text-ink-faint";

/** O campo de valor grande ("R$ 0"), fora do componente para não perder o foco a cada letra. */
function Valor({ v, set, rotulo, moeda }: { v: string; set: (s: string) => void; rotulo: string; moeda?: string }) {
  const doApp = currencySymbol(useCurrency());
  return (
    <label className="flex items-baseline gap-2 rounded-3xl bg-surface-2 px-4 py-3">
      <span className="text-[15px] text-ink-muted">{moeda ?? doApp}</span>
      <input inputMode="decimal" value={v} onChange={(e) => set(e.target.value)} placeholder="0" aria-label={rotulo} className={CAMPO_GRANDE} />
    </label>
  );
}

function OutraTaxa({ onEscolher }: { onEscolher: (r: Rendimento) => void }) {
  const [aberta, setAberta] = useState(false);
  const [tipo, setTipo] = useState<"cdi" | "ipca" | "pre">("cdi");
  const [v, setV] = useState("");
  if (!aberta)
    return (
      <button type="button" onClick={() => setAberta(true)} className="min-h-11 w-fit text-[14px] text-ink-muted underline underline-offset-[3px]">
        Outra taxa
      </button>
    );
  const n = lerNumero(v);
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-3">
      <div className="grid grid-cols-3 gap-1">
        {([["cdi", "do CDI"], ["ipca", "IPCA +"], ["pre", "ao ano"]] as const).map(([k, t]) => (
          <button key={k} type="button" onClick={() => setTipo(k)} className={`min-h-10 rounded-full text-[13px] ${tipo === k ? "bg-surface font-medium text-ink shadow-sm" : "text-ink-muted"}`}>
            {t}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} placeholder="0" aria-label="Taxa" className="min-h-11 w-24 rounded-xl border border-border bg-surface px-3 text-[16px] tabular-nums text-ink outline-none" />
        <span className="text-[14px] text-ink-muted">{tipo === "cdi" ? "% do CDI" : tipo === "ipca" ? "% + IPCA" : "% ao ano"}</span>
        <button
          type="button"
          disabled={!(n > 0)}
          onClick={() => onEscolher(tipo === "cdi" ? { indexador: "cdi", percentual: n } : { indexador: tipo, taxa: n })}
          className="ml-auto min-h-10 rounded-full bg-pill px-4 text-[14px] text-on-pill disabled:opacity-40"
        >
          Usar
        </button>
      </div>
    </div>
  );
}
