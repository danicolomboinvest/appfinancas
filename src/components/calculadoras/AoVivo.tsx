"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { Explica } from "@/components/ui/Explica";
import { useMoney } from "@/components/money/MoneyProvider";
import { reaisDoTexto } from "@/lib/dinheiro/digitado";
import type { TipoDeSimulacao, ValoresDaCalculadora } from "@/lib/calculadoras/entradas";
import type { Veredito } from "@/lib/calculadoras/vereditos";
import { BotaoVirarMeta, CampoDoNome, comCentavos, IconeRedondo, milhar, pc, useDinheiroParaGuardar, useSalvar, useSimbolo, VoltarParaCalculadoras, type MetaSugerida } from "./pecas";

/**
 * "Mexer nos números" (protótipo aprovado): uma tela só, o veredito em cima e cada número embaixo
 * com o controle deslizante e os atalhos. A resposta muda enquanto ela mexe. É também onde abre
 * uma simulação salva.
 */
export type TipoDeCampo = "brl" | "pct" | "pctMes" | "meses" | "anos" | "seg";

export type Campo = {
  k: string;
  rotulo: string;
  tipo: TipoDeCampo;
  min?: number;
  max?: number;
  passo?: number;
  /** Na unidade da tela: 11 = 11%, 300000 = R$ 300 mil. */
  atalhos?: number[];
  ajuda: string;
  opcoes?: { valor: string; rotulo: string }[];
  mostrarSe?: (v: ValoresDaCalculadora) => boolean;
};

const ehPct = (t: TipoDeCampo) => t === "pct" || t === "pctMes";
/** Da conta (0,11) para a tela (11) e de volta. */
const naTela = (c: Campo, v: number) => (ehPct(c.tipo) ? v * 100 : v);
const naConta = (c: Campo, v: number) => (ehPct(c.tipo) ? v / 100 : v);
const UNIDADE: Record<TipoDeCampo, string> = { brl: "", pct: "% a.a.", pctMes: "% a.m.", meses: "meses", anos: "anos", seg: "" };

function rotuloDoAtalho(c: Campo, x: number) {
  if (c.tipo === "brl") return x >= 1e6 ? `${(x / 1e6).toLocaleString("pt-BR")} mi` : x >= 1000 ? `${(x / 1000).toLocaleString("pt-BR")} mil` : milhar(x);
  if (ehPct(c.tipo)) return `${pc(x)}%`;
  return `${x} ${c.tipo === "meses" ? "meses" : "anos"}`;
}

export function AoVivo({
  nome,
  ajuda,
  campos,
  exemplo,
  inicial,
  calcular,
  detalhes,
  tipo,
  meta,
  salvaInicial,
  onValores,
}: {
  nome: string;
  ajuda: string;
  campos: { base: Campo[]; finos: Campo[] };
  exemplo: ValoresDaCalculadora;
  inicial: ValoresDaCalculadora;
  calcular: (v: ValoresDaCalculadora) => { veredito: Veredito; sub: string };
  detalhes: (v: ValoresDaCalculadora) => ReactNode;
  tipo: TipoDeSimulacao;
  meta?: (v: ValoresDaCalculadora) => { titulo: string; sub: string; meta: MetaSugerida };
  /** Abriu de uma simulação salva: já nasce com o selo "Salva". */
  salvaInicial?: boolean;
  onValores?: (v: ValoresDaCalculadora) => void;
}) {
  const [v, setV] = useState<ValoresDaCalculadora>(inicial);
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);
  const [finosAbertos, setFinosAbertos] = useState(false);
  const money = useMoney();
  const { veredito, sub } = calcular(v);
  const numero = money(veredito.numero, { round: true });
  const resumo = veredito.erro ? veredito.erro : `${veredito.frase} · ${numero}`;
  // O que vai para o banco sai sem o olho do topo: escondido, o resumo era gravado "R$ ••••".
  const guardar = useDinheiroParaGuardar();
  const resumoGuardado = veredito.erro ? veredito.erro : `${veredito.frase} · ${guardar(veredito.numero, { round: true })}`;
  const s = useSalvar(tipo, v, resumoGuardado, salvaInicial ? JSON.stringify(inicial) : null);
  const ehExemplo = Object.keys(exemplo).every((k) => String(exemplo[k]) === String(v[k]));

  const muda = (k: string, x: number | string) =>
    setV((a) => {
      const novo = { ...a, [k]: x };
      onValores?.(novo);
      return novo;
    });

  // A barra do veredito aparece quando o herói sai da tela, para ela ver o efeito sem subir.
  const heroi = useRef<HTMLDivElement>(null);
  const [fora, setFora] = useState(false);
  useEffect(() => {
    const el = heroi.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(([e]) => setFora(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const mx = Math.max(1, ...veredito.barras.map((b) => Math.abs(b.valor)));
  const m = meta?.(v);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
      {fora && (
        <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-canvas/95 px-5 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] backdrop-blur">
          <span className="min-w-0 truncate text-sm font-medium text-ink">{resumo}</span>
          <button type="button" onClick={() => heroi.current?.scrollIntoView({ behavior: "smooth", block: "start" })} className="min-h-10 shrink-0 text-sm font-medium text-accent-strong">
            Ver
          </button>
        </div>
      )}

      <VoltarParaCalculadoras />

      <div ref={heroi} className="scroll-mt-20">
        <HeroiDoTema>
          <div className="flex items-start justify-between gap-2">
            <span className="text-[15px] text-heroi-suave">{nome}</span>
            <Explica noHeroi rotulo="Como ler">
              {ajuda}
            </Explica>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ehExemplo ? (
              <span className="vidro-heroi rounded-full px-2.5 py-1 text-xs font-medium">Exemplo</span>
            ) : (
              <button type="button" onClick={() => { setV(exemplo); onValores?.(exemplo); }} className="vidro-heroi rounded-full px-2.5 py-1 text-xs font-medium">
                Voltar ao exemplo
              </button>
            )}
            {s.salva && <span className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium text-success">Salva</span>}
          </div>
          <b className="text-xl font-medium leading-snug">{veredito.frase}</b>
          {!veredito.erro && (
            <>
              <ValorDestaque texto={numero} />
              <span className="text-sm text-heroi-suave">{sub}</span>
              <div className="flex flex-col gap-2 pt-1">
                {veredito.barras.map((b) => (
                  <div key={b.chave} className="grid grid-cols-[4.75rem_minmax(0,1fr)_auto] items-center gap-3 text-sm">
                    <span className={b.vence ? "font-medium" : "text-heroi-suave"}>{b.rotulo}</span>
                    <span className="heroi-veu h-2 overflow-hidden rounded-full">
                      <i className={`block h-full rounded-full ${b.vence ? "bg-[var(--color-heroi-tinta)]" : "bg-[var(--color-dinheiro-gastou)]"}`} style={{ width: `${Math.max(2, (Math.abs(b.valor) / mx) * 100)}%` }} />
                    </span>
                    <b className="font-medium tabular-nums">{money(b.valor, { round: true })}</b>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" aria-expanded={detalhesAbertos} onClick={() => setDetalhesAbertos((d) => !d)} className="vidro-heroi min-h-10 rounded-full px-4 text-sm font-medium">
                  {detalhesAbertos ? "Fechar detalhes" : "Ver detalhes"}
                </button>
                {!s.salva && (
                  <button type="button" onClick={s.abrir} className="vidro-heroi min-h-10 rounded-full px-4 text-sm font-medium">
                    Salvar simulação
                  </button>
                )}
              </div>
            </>
          )}
        </HeroiDoTema>
      </div>
      <CampoDoNome s={s} />

      {detalhesAbertos && !veredito.erro && <div className="flex flex-col gap-3">{detalhes(v)}</div>}
      {m && !veredito.erro && <BotaoVirarMeta titulo={m.titulo} sub={m.sub} meta={m.meta} />}

      {campos.base.filter((c) => !c.mostrarSe || c.mostrarSe(v)).map((c) => (
        <CampoAoVivo key={c.k} c={c} v={v} muda={muda} erro={veredito.erro && /prazo/i.test(c.rotulo) && !(Number(v[c.k]) >= 1) ? veredito.erro : undefined} />
      ))}

      {campos.finos.length > 0 && (
        <div className="glass rounded-2xl">
          <button type="button" aria-expanded={finosAbertos} onClick={() => setFinosAbertos((a) => !a)} className="flex min-h-14 w-full items-center gap-3 px-3.5 text-left">
            <IconeRedondo>
              <SlidersHorizontal size={17} aria-hidden />
            </IconeRedondo>
            <span className="flex-1 text-[15px] font-medium text-ink">Ajustes finos</span>
            <ChevronDown size={18} className={`text-ink-muted transition-transform ${finosAbertos ? "rotate-180" : ""}`} aria-hidden />
          </button>
          {finosAbertos && (
            <div className="flex flex-col gap-3 px-2 pb-2">
              {campos.finos.filter((c) => !c.mostrarSe || c.mostrarSe(v)).map((c) => (
                <CampoAoVivo key={c.k} c={c} v={v} muda={muda} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Um número: rótulo e "?" em cima, o valor grande, o controle deslizante e os atalhos. */
function CampoAoVivo({ c, v, muda, erro }: { c: Campo; v: ValoresDaCalculadora; muda: (k: string, x: number | string) => void; erro?: string }) {
  const simbolo = useSimbolo();
  const [rascunho, setRascunho] = useState<string | null>(null);
  const topo = (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-ink-muted">{c.rotulo}</span>
      <Explica>{c.ajuda}</Explica>
    </div>
  );
  if (c.tipo === "seg") {
    return (
      <div className="glass flex flex-col gap-3 rounded-2xl p-4">
        {topo}
        <div className="grid gap-1 rounded-full bg-surface-2 p-1" style={{ gridTemplateColumns: `repeat(${c.opcoes!.length}, minmax(0, 1fr))` }} role="group" aria-label={c.rotulo}>
          {c.opcoes!.map((o) => (
            <button key={o.valor} type="button" aria-pressed={String(v[c.k]) === o.valor} onClick={() => muda(c.k, o.valor)} className={`min-h-10 rounded-full text-sm ${String(v[c.k]) === o.valor ? "bg-ink text-canvas" : "text-ink-muted"}`}>
              {o.rotulo}
            </button>
          ))}
        </div>
      </div>
    );
  }
  const bruto = Number(v[c.k]);
  const tela = Number.isFinite(bruto) ? naTela(c, bruto) : 0;
  const mostrado = rascunho ?? (v[c.k] === "" ? "" : c.tipo === "brl" ? comCentavos(tela) : pc(tela));
  const min = c.min ?? 0;
  const max = c.max ?? Math.max(1, tela * 2);
  const dentro = Math.min(max, Math.max(min, tela));
  return (
    <div className="glass flex flex-col gap-2.5 rounded-2xl p-4">
      {topo}
      <label className="flex items-baseline gap-1.5 text-ink">
        {c.tipo === "brl" && <span className="text-base text-ink-muted">{simbolo}</span>}
        <input
          inputMode="decimal"
          aria-label={c.rotulo}
          value={mostrado}
          onFocus={() => setRascunho(mostrado)}
          onBlur={() => setRascunho(null)}
          onChange={(e) => {
            if (c.tipo === "brl") {
              // Dígitos como centavos, igual a todo campo de dinheiro do app (lib/dinheiro/digitado).
              const n = reaisDoTexto(e.target.value) ?? 0;
              setRascunho(comCentavos(n));
              return muda(c.k, n);
            }
            const t = e.target.value.replace(/[^\d,]/g, "");
            setRascunho(t);
            if (t === "") return muda(c.k, "");
            const n = Number(t.replace(",", "."));
            if (Number.isFinite(n)) muda(c.k, naConta(c, n));
          }}
          className="min-w-0 flex-1 bg-transparent text-[1.75rem] font-light leading-none tracking-[-0.02em] tabular-nums outline-none"
        />
        {UNIDADE[c.tipo] && <span className="shrink-0 text-sm text-ink-muted">{UNIDADE[c.tipo]}</span>}
      </label>
      {erro && <p className="text-sm text-danger">{erro}</p>}
      <input
        type="range"
        aria-label={`${c.rotulo}, deslizante`}
        min={min}
        max={max}
        step={c.passo ?? 1}
        value={dentro}
        onChange={(e) => muda(c.k, naConta(c, Number(e.target.value)))}
        className="slider-app w-full"
        style={{ ["--pct" as string]: `${((dentro - min) / (max - min || 1)) * 100}%` }}
      />
      {c.atalhos && (
        <div className="flex flex-wrap gap-1.5">
          {c.atalhos.map((x) => (
            <button key={x} type="button" onClick={() => muda(c.k, naConta(c, x))} className={`min-h-9 rounded-full px-3 text-sm tabular-nums ${Math.abs(tela - x) < 1e-9 ? "bg-ink text-canvas" : "bg-surface-2 text-ink-muted"}`}>
              {rotuloDoAtalho(c, x)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
