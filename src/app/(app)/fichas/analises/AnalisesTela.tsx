"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Repeat, Search } from "lucide-react";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import { situacao, vaiBem, type Forca } from "@/lib/analysis/quatro-perguntas";
import type { AtivoAnalisado, DadosDasAnalises } from "@/lib/analysis/analises-dados";
import { AnelDePerguntas, Pct, Ponto, TRILHO, TileDoAtivo, corDaForca, opacidadeDaForca } from "./aneis";
import { LeitorDaCarteira } from "./LeitorDaCarteira";
import { TICKERS_COM_LOGO } from "@/lib/marcas/ativos-lista";

const CARTAO = "rounded-3xl border border-border bg-surface";

/**
 * A entrada das Análises (rodadas 48 e 52): o anel grande da carteira com "5 de 6 vão bem" dentro,
 * a grade de anéis de 4 pedaços (um por pergunta), o cartão do ativo que desliza para o próximo, a
 * faixa da renda fixa e o Comparar dois.
 */
export function AnalisesTela({ dados }: { dados: DadosDasAnalises }) {
  const { ativos, rendaFixa, outros, pendentes } = dados;
  const [sel, setSel] = useState<string | null>(null);
  const [destaque, setDestaque] = useState<string | null>(null);
  const [lupa, setLupa] = useState(false);
  const [falhos, setFalhos] = useState<string[]>([]);
  const lendo = outros.filter((o) => o.lendo);
  const semAnalise = outros.filter((o) => !o.lendo);
  const bem = ativos.filter((a) => vaiBem(a.geral)).length;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const destacar = (tk: string) => {
    setDestaque(tk);
    document.querySelector(`[data-ansel="${tk}"]`)?.scrollIntoView({ block: "center", behavior: reduzMovimento() ? "auto" : "smooth" });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDestaque(null), 2000);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const comparaveis = useMemo(() => {
    const porTipo = new Map<string, AtivoAnalisado[]>();
    for (const a of ativos) {
      const k = a.tipo === "STOCK_INTL" ? "STOCK" : a.tipo;
      porTipo.set(k, [...(porTipo.get(k) ?? []), a]);
    }
    const par = [...porTipo.values()].find((l) => l.length >= 2);
    return par ? [par[0].ticker, par[1].ticker] : null;
  }, [ativos]);

  const vazio = ativos.length === 0 && lendo.length === 0 && rendaFixa.length === 0 && semAnalise.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <LeitorDaCarteira pendentes={pendentes} onFalhou={(tk) => setFalhos((f) => [...f, tk])} />

      {vazio ? (
        // Sem carteira (11/10/2026): a busca é o destaque. Qualquer código abre a análise completa,
        // sem depender de ter o ativo. Os atalhos são só os códigos mais negociados, sem recomendar.
        <section className="flex flex-col gap-3">
          <h1 className="titulo-tema px-1 text-[1.625rem] font-medium leading-tight text-ink">Pesquise qualquer ação, FII ou ETF</h1>
          <Busca ativos={[]} grande />
          <div className="flex flex-col gap-2 px-1">
            <span className="text-[13px] text-ink-muted">Os mais negociados</span>
            <div className="flex flex-wrap gap-2">
              {MAIS_NEGOCIADOS.map((tk) => (
                <Link key={tk} href={`/fichas/ativo/${tk}`} className="inline-flex min-h-10 items-center rounded-full border border-border bg-surface px-3.5 text-sm font-medium tabular-nums text-ink">
                  {tk}
                </Link>
              ))}
            </div>
          </div>
          <Link href="/carteira" className="mx-auto min-h-11 px-3 py-2 text-sm text-ink-muted underline-offset-4 hover:underline">
            Quando tiver investimentos na Carteira, cada um ganha a sua análise aqui
          </Link>
        </section>
      ) : (
        ativos.length > 0 && <AnelDaCarteira ativos={ativos} bem={bem} destaque={destaque} onToque={destacar} />
      )}

      {(ativos.length > 0 || lendo.length > 0) && (
        <>
          <div className="flex items-center justify-between px-1">
            <h2 className="titulo-tema text-lg font-medium text-ink">Ações, fundos e ETFs</h2>
            <button
              type="button"
              onClick={() => setLupa((v) => !v)}
              aria-label="Procurar um investimento"
              aria-expanded={lupa}
              className="flex size-11 items-center justify-center rounded-full border border-border bg-surface text-ink"
            >
              <Search size={18} strokeWidth={1.8} aria-hidden />
            </button>
          </div>
          {lupa && <Busca ativos={ativos} />}

          <div className={`${CARTAO} px-3 pb-4 pt-5`}>
            <div className="grid grid-cols-3 gap-x-1 gap-y-5 max-[339px]:grid-cols-2">
              {ativos.map((a) => (
                <button
                  key={a.ticker}
                  type="button"
                  data-ansel={a.ticker}
                  onClick={() => setSel((s) => (s === a.ticker ? null : a.ticker))}
                  aria-pressed={sel === a.ticker}
                  aria-label={`${a.ticker}: ${situacao(a.geral)}, ${Math.round(a.peso)}% da carteira`}
                  className={`flex min-w-0 flex-col items-center gap-1 rounded-2xl px-1 py-1.5 transition-colors ${sel === a.ticker || destaque === a.ticker ? "bg-surface-2" : ""}`}
                >
                  <AnelDePerguntas forcas={a.perguntas.map((p) => p.f)} tamanho={76} espessura={4.5} meio={<TileDoAtivo ticker={a.ticker} logo={a.logo} tamanho={40} />} />
                  <b className="mt-1 max-w-full truncate text-[13px] font-semibold text-ink">{a.ticker}</b>
                  <Pct valor={a.peso} className="text-xs text-ink-muted" />
                </button>
              ))}
              {lendo.map((o) => (
                <div key={o.id} className="flex min-w-0 flex-col items-center gap-1 px-1 py-1.5" aria-label={`${o.nome}: ${falhos.includes(o.nome) ? "sem leitura agora" : "lendo os números"}`}>
                  <AnelDePerguntas forcas={[null, null, null, null]} tamanho={76} espessura={4.5} meio={<span className={`text-xs text-ink-faint ${falhos.includes(o.nome) ? "" : "an-lendo"}`}>{falhos.includes(o.nome) ? "sem leitura" : "lendo"}</span>} />
                  <b className="mt-1 max-w-full truncate text-[13px] font-semibold text-ink-muted">{o.nome}</b>
                  <Pct valor={o.peso} className="text-xs text-ink-faint" />
                </div>
              ))}
            </div>
            <p className="mt-4 text-center text-xs text-ink-muted">Cada pedaço do anel é uma pergunta</p>
          </div>

          {sel && ativos.some((a) => a.ticker === sel) && <CartaDoAtivo ativos={ativos} ticker={sel} onTroca={setSel} />}
        </>
      )}

      {rendaFixa.length > 0 && (
        <div className={`${CARTAO} px-4 py-2`}>
          <h2 className="pb-1 pt-2 text-[15px] font-medium text-ink">Renda fixa e Tesouro</h2>
          <ul className="flex flex-col">
            {rendaFixa.map((r, i) => (
              <li key={r.id} className={i > 0 ? "border-t border-border" : ""}>
                <Link href={`/fichas/renda-fixa/${r.id}`} className="flex min-h-14 items-center gap-3 py-2">
                  <AnelMini peso={r.peso} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <b className="truncate text-[15px] font-medium text-ink">{r.nomeCurto}</b>
                    <small className="text-[13px] text-ink-muted">rende o combinado</small>
                  </span>
                  <Pct valor={r.peso} className="text-[15px] text-ink" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {semAnalise.length > 0 && (
        <div className={`${CARTAO} px-4 py-2`}>
          <h2 className="pb-1 pt-2 text-[15px] font-medium text-ink">Outros investimentos</h2>
          <ul className="flex flex-col">
            {semAnalise.map((o, i) => (
              <li key={o.id} className={`flex min-h-12 items-center gap-3 py-2 ${i > 0 ? "border-t border-border" : ""}`}>
                <AnelMini peso={o.peso} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="truncate text-[15px] font-medium text-ink">{o.nome}</b>
                  <small className="text-[13px] text-ink-muted">sem análise por aqui</small>
                </span>
                <Pct valor={o.peso} className="text-[15px] text-ink" />
              </li>
            ))}
          </ul>
        </div>
      )}

      {comparaveis && (
        <Link
          href={`/fichas/comparar?a=${comparaveis[0]}&b=${comparaveis[1]}`}
          className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-border bg-surface-2 px-5 text-[15px] font-medium text-ink"
        >
          <Repeat size={16} strokeWidth={1.8} aria-hidden />
          Comparar dois
        </Link>
      )}

      <Link href="/fichas/acoes" className="mx-auto min-h-11 px-3 py-2 text-[13px] text-ink-muted underline-offset-4 hover:underline">
        Suas fichas e a nota detalhada
      </Link>
      <p className="px-1 pb-2 text-center text-[12px] text-ink-muted">Não é recomendação de investimento.</p>
    </div>
  );
}

function reduzMovimento(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Rodada 52: o anel do topo é a carteira. Um pedaço por ativo com análise, do tamanho do peso; o número dentro. */
function AnelDaCarteira({ ativos, bem, destaque, onToque }: { ativos: AtivoAnalisado[]; bem: number; destaque: string | null; onToque: (tk: string) => void }) {
  const T = 176;
  const esp = 11;
  const r = T / 2 - 9;
  const c = 2 * Math.PI * r;
  const vao = (c * 5.5) / 360 + esp;
  const soma = ativos.reduce((t, a) => t + a.peso, 0) || 1;
  const estados = new Set(ativos.map((a) => a.geral));
  // Onde começa cada pedaço: a soma dos pesos antes dele.
  const inicios = ativos.map((_, i) => ativos.slice(0, i).reduce((t, x) => t + (x.peso / soma) * c, 0));
  const marcado = destaque ? ativos.find((a) => a.ticker === destaque) : null;
  return (
    <HeroiDoTema className="items-center">
      <div className="flex flex-col items-center gap-3 py-1">
        <span className="relative inline-flex items-center justify-center" style={{ width: T, height: T }}>
          <svg viewBox={`0 0 ${T} ${T}`} width={T} height={T} className="absolute inset-0" role="img" aria-label={`${bem} de ${ativos.length} vão bem`}>
            <circle cx={T / 2} cy={T / 2} r={r} fill="none" stroke={TRILHO} strokeWidth={esp} />
            {ativos.map((a, i) => {
              const L = (a.peso / soma) * c;
              const s = Math.max(0.5, L - vao);
              const off = -inicios[i] + c / 4 - vao / 2;
              return (
                <circle
                  key={a.ticker}
                  className="an-seg cursor-pointer"
                  cx={T / 2}
                  cy={T / 2}
                  r={r}
                  fill="none"
                  stroke={corDaForca(a.geral)}
                  strokeOpacity={(opacidadeDaForca(a.geral) * [1, 0.85, 0.7][i % 3]).toFixed(2)}
                  strokeWidth={destaque === a.ticker ? esp + 4 : esp}
                  strokeLinecap="round"
                  strokeDasharray={`${s.toFixed(2)} ${(c - s).toFixed(2)}`}
                  strokeDashoffset={off.toFixed(2)}
                  style={{ ["--d" as string]: `${i * 70}ms`, ["--s" as string]: s.toFixed(2), pointerEvents: "stroke" }}
                  onClick={() => onToque(a.ticker)}
                >
                  <title>{`${a.ticker}: ${situacao(a.geral)}, ${Math.round(a.peso)}% da carteira`}</title>
                </circle>
              );
            })}
          </svg>
          <span className="relative flex flex-col items-center" aria-live="polite">
            {marcado ? (
              <>
                <b className="text-[26px] font-medium leading-none tracking-[-0.01em]">{marcado.ticker}</b>
                <small className="mt-1.5 text-xs text-heroi-suave">
                  {situacao(marcado.geral)} · <Pct valor={marcado.peso} />
                </small>
              </>
            ) : (
              <>
                <span className="flex items-baseline gap-1.5">
                  <b className="text-[44px] font-light leading-none tracking-[-0.03em] tabular-nums">{bem}</b>
                  <small className="text-[15px] text-heroi-suave">de {ativos.length}</small>
                </span>
                <small className="mt-1 text-xs text-heroi-suave">{bem === 1 ? "vai bem" : "vão bem"}</small>
              </>
            )}
          </span>
        </span>
        {estados.size > 1 && (
          <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-heroi-suave">
            {(["forte", "ok", "atencao"] as Forca[])
              .filter((f) => estados.has(f))
              .map((f) => (
                <span key={f} className="inline-flex items-center gap-1.5">
                  <Ponto f={f} tamanho={7} />
                  {f === "forte" ? "vai bem" : f === "ok" ? "na média" : "atenção"}
                </span>
              ))}
          </p>
        )}
      </div>
    </HeroiDoTema>
  );
}

/** Anel mini de 1 pedaço: o tamanho na carteira. */
function AnelMini({ peso }: { peso: number }) {
  const T = 30;
  const r = 12;
  const c = 2 * Math.PI * r;
  const s = Math.max(1.5, (Math.min(100, peso) / 100) * c);
  return (
    <svg viewBox={`0 0 ${T} ${T}`} width={T} height={T} className="shrink-0" aria-hidden>
      <circle cx={T / 2} cy={T / 2} r={r} fill="none" stroke={TRILHO} strokeWidth={3.5} />
      <circle cx={T / 2} cy={T / 2} r={r} fill="none" stroke="var(--color-success)" strokeWidth={3.5} strokeLinecap="round" strokeDasharray={`${s.toFixed(2)} ${c.toFixed(2)}`} transform={`rotate(-90 ${T / 2} ${T / 2})`} />
    </svg>
  );
}

/** O cartão do ativo: as quatro respostas em 2 x 2, "Ver a análise completa" e setas (ou deslizar) para o próximo. */
function CartaDoAtivo({ ativos, ticker, onTroca }: { ativos: AtivoAnalisado[]; ticker: string; onTroca: (tk: string) => void }) {
  const i = ativos.findIndex((a) => a.ticker === ticker);
  const a = ativos[i];
  const x0 = useRef<number | null>(null);
  const vai = (d: number) => {
    const j = i + d;
    if (j >= 0 && j < ativos.length) onTroca(ativos[j].ticker);
  };
  return (
    <div
      className={`${CARTAO} an-carta p-4`}
      aria-live="polite"
      onPointerDown={(e) => (x0.current = e.clientX)}
      onPointerUp={(e) => {
        if (x0.current === null) return;
        const dx = e.clientX - x0.current;
        x0.current = null;
        if (Math.abs(dx) > 50) vai(dx < 0 ? 1 : -1);
      }}
    >
      <div className="flex items-center gap-3">
        <TileDoAtivo ticker={a.ticker} logo={a.logo} tamanho={36} />
        <span className="flex min-w-0 flex-1 flex-col">
          <b className="text-[15px] font-semibold text-ink">{a.ticker}</b>
          <small className="truncate text-[13px] text-ink-muted">{a.nome}</small>
        </span>
        <span className="text-xs text-ink-muted tabular-nums">{i + 1} de {ativos.length}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {a.perguntas.map((p) => (
          <div key={p.k} className="flex min-w-0 flex-col gap-1 rounded-2xl bg-surface-2 p-3">
            <small className="flex items-start gap-1.5 text-xs leading-snug text-ink-muted">
              <span className="flex h-[1.375em] shrink-0 items-center"><Ponto f={p.f} tamanho={6} /></span>
              {p.q}
            </small>
            <b className="text-[15px] font-medium leading-snug text-ink">{p.r}</b>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <button type="button" onClick={() => vai(-1)} disabled={i === 0} aria-label="Anterior" className="flex size-11 items-center justify-center rounded-full text-ink disabled:opacity-30">
          <ChevronLeft size={18} strokeWidth={1.8} aria-hidden />
        </button>
        <Link href={`/fichas/ativo/${a.ticker}`} className="min-h-11 px-2 py-2.5 text-[15px] font-medium text-accent-strong">
          Ver a análise completa
        </Link>
        <button type="button" onClick={() => vai(1)} disabled={i === ativos.length - 1} aria-label="Próximo" className="flex size-11 items-center justify-center rounded-full text-ink disabled:opacity-30">
          <ChevronRight size={18} strokeWidth={1.8} aria-hidden />
        </button>
      </div>
    </div>
  );
}

/** Só códigos, sem recomendação: os mais negociados da B3 (ações, FIIs e ETFs). */
const MAIS_NEGOCIADOS = ["PETR4", "VALE3", "ITUB4", "BBAS3", "BBDC4", "MXRF11", "HGLG11", "KNRI11", "BOVA11", "IVVB11"];

/**
 * A lupa: acha entre os seus pelo código ou nome e, fora deles, qualquer código conhecido (os
 * mesmos da lista de logos da B3); um código novo vira "Analisar". Abre a análise completa.
 */
function Busca({ ativos, grande = false }: { ativos: AtivoAnalisado[]; grande?: boolean }) {
  const [q, setQ] = useState("");
  const router = useRouter();
  const sem = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const termo = sem(q.trim());
  const achados = termo ? ativos.filter((a) => sem(`${a.ticker} ${a.nome}`).includes(termo)).slice(0, 6) : [];
  const codigo = q.trim().toUpperCase();
  const codigoValido = /^([A-Z]{4}\d{1,2}|[A-Z]{1,5})$/.test(codigo);
  const doCatalogo = codigo.length >= 2 ? TICKERS_COM_LOGO.filter((tk) => tk.startsWith(codigo) && !ativos.some((a) => a.ticker === tk)).slice(0, 6) : [];
  const codigoNovo = codigoValido && !ativos.some((a) => a.ticker === codigo) && !doCatalogo.includes(codigo);
  return (
    <div className="flex flex-col gap-2">
      <label className={`flex items-center gap-2 rounded-2xl border border-border bg-surface px-3 ${grande ? "min-h-14 shadow-premium-sm" : "min-h-12"}`}>
        <Search size={18} strokeWidth={1.8} className="text-ink-muted" aria-hidden />
        <input
          autoFocus={!grande}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && codigo) router.push(`/fichas/ativo/${codigo}`);
          }}
          placeholder="Código ou nome. Ex.: ITSA4"
          aria-label="Código ou nome do investimento"
          autoComplete="off"
          autoCapitalize="characters"
          className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-faint"
        />
      </label>
      {(achados.length > 0 || doCatalogo.length > 0 || codigoNovo) && (
        <ul className={`${CARTAO} flex flex-col px-3 py-1`}>
          {achados.map((a) => (
            <li key={a.ticker}>
              <Link href={`/fichas/ativo/${a.ticker}`} className="flex min-h-12 items-center gap-3 py-1.5">
                <TileDoAtivo ticker={a.ticker} logo={a.logo} tamanho={32} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="text-[15px] font-medium text-ink">{a.ticker}</b>
                  <small className="truncate text-[13px] text-ink-muted">{a.nome}</small>
                </span>
                <Ponto f={a.geral} />
              </Link>
            </li>
          ))}
          {doCatalogo.map((tk, i) => (
            <li key={tk} className={i === 0 && achados.length ? "border-t border-border" : ""}>
              <Link href={`/fichas/ativo/${tk}`} className="flex min-h-12 items-center gap-3 py-1.5">
                <TileDoAtivo ticker={tk} logo={null} tamanho={32} />
                <b className="text-[15px] font-medium text-ink">{tk}</b>
              </Link>
            </li>
          ))}
          {codigoNovo && (
            <li className={achados.length || doCatalogo.length ? "border-t border-border" : ""}>
              <Link href={`/fichas/ativo/${codigo}`} className="flex min-h-12 items-center gap-3 py-1.5 text-[15px] font-medium text-accent-strong">
                Analisar {codigo}
              </Link>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
