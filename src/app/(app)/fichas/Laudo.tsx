"use client";

import { useEffect, useState, useTransition } from "react";
import { HelpCircle, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import {
  FRIENDLY_LABEL,
  SECTION_SCALE,
  attentionLine,
  compactValue,
  sectionGauge,
  technicalLabel,
  type Laudo,
  type LaudoChange,
  type LaudoItem,
  type LaudoSection,
} from "@/lib/analysis/laudo";
import type { OverviewSignal } from "@/lib/analysis/stock-overview";
import { readLaudoAction } from "./laudo-actions";

const NUMBERS_KEY = "spi.laudo.numeros";

const SIGNAL_TEXT: Record<OverviewSignal, string> = { favoravel: "text-success", neutro: "text-ink-muted", atencao: "text-danger" };
const SIGNAL_BG: Record<OverviewSignal, string> = {
  favoravel: "bg-success-soft",
  neutro: "bg-surface-2",
  atencao: "bg-danger-soft",
};
const SIGNAL_BORDER: Record<OverviewSignal, string> = { favoravel: "border-success", neutro: "border-ink-faint", atencao: "border-danger" };
const SIGNAL_LABEL: Record<OverviewSignal, string> = { favoravel: "a favor", neutro: "na média", atencao: "atenção" };

/** Rótulos curtos pra grade de números (três por linha): o nome cheio vai na explicação. */
const SHORT_LABEL: Record<string, string> = {
  divida_liquida_ebitda: "Dív./EBITDA",
  divida_liquida_patrimonio: "Dív./Patrim.",
  // "Liquidez" sozinho parecia liquidez DE MERCADO (quanto negocia por dia), e a Petrobras
  // com 0,85 em atenção não fazia sentido pra ninguém. É liquidez CORRENTE: caixa de curto
  // prazo ÷ contas de curto prazo. O nome tem que dizer isso.
  liquidez_corrente: "Caixa × contas",
  evolucao_receita: "Vendas 5a",
  evolucao_lucro: "Lucro 5a",
  margem_liquida: "Margem líq.",
  patrimonio_liquido_etf: "Patrimônio",
  patrimonio_liquido: "Patrimônio",
  numero_imoveis: "Imóveis",
  rentabilidade_12m: "12 meses",
  rentabilidade_5anos: "5 anos",
  taxa_administracao: "Taxa adm.",
  vacancia_atual: "Vacância",
  liquidez_fii: "Liquidez/dia",
  dividend_yield: "Dividendos",
  dividend_yield_etf: "Dividendos",
};

function formatReadAt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/**
 * O laudo, em formas no lugar de frases.
 *
 * Duas rodadas de "tira texto" não resolveram porque o problema era de desenho: a tela
 * respondia com frases onde deveria responder com posição e cor. Agora a nota é um ANEL,
 * os sinais são três blocos, cada pergunta é um TERMÔMETRO (a resposta é onde o marcador
 * cai) e os números vivem numa grade de três por linha que só mostra número e cor.
 * A única frase que sobra é a dos pontos de atenção.
 */
export function LaudoView({
  sheetId,
  ticker,
  companyName,
  inPortfolio,
  initialLaudo,
}: {
  sheetId: string;
  ticker: string;
  companyName: string | null;
  inPortfolio: boolean;
  initialLaudo: Laudo | null;
}) {
  const [laudo, setLaudo] = useState<Laudo | null>(initialLaudo);
  const [changes, setChanges] = useState<LaudoChange[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reading, startReading] = useTransition();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [showNumbers, setShowNumbers] = useState(false);
  const [showCaveat, setShowCaveat] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- preferência do aparelho, lida na montagem; no servidor não existe localStorage
      if (window.localStorage.getItem(NUMBERS_KEY) === "1") setShowNumbers(true);
    } catch {
      /* fica no resumo */
    }
  }, []);

  function toggleNumbers() {
    setShowNumbers((v) => {
      try {
        window.localStorage.setItem(NUMBERS_KEY, v ? "0" : "1");
      } catch {
        /* ignora */
      }
      return !v;
    });
  }

  function read() {
    startReading(async () => {
      const r = await readLaudoAction(sheetId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setLaudo(r.laudo);
      setChanges(r.changes);
    });
  }

  useEffect(() => {
    if (initialLaudo === null) read();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só na montagem
  }, []);

  const header = (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">{ticker.toUpperCase()}</h1>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          {companyName && <span className="truncate">{companyName}</span>}
          {inPortfolio && (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-strong">na sua carteira</span>
          )}
        </p>
      </div>
      {laudo?.autoScore !== null && laudo?.autoScore !== undefined ? <ScoreRing score={laudo.autoScore} /> : <RingPlaceholder />}
    </div>
  );

  if (!laudo) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <Card className="flex flex-col gap-2 p-5">
          {error ? (
            <>
              <p className="text-sm text-danger">{error}</p>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  read();
                }}
                className="w-fit text-sm font-medium text-accent-strong hover:underline"
              >
                Tentar de novo
              </button>
            </>
          ) : (
            <p className="text-sm text-ink-muted">Lendo os números de {ticker.toUpperCase()}…</p>
          )}
        </Card>
      </div>
    );
  }

  const atencao = attentionLine(laudo);
  const allItems = laudo.sections.flatMap((s) => s.items);
  const openItem = allItems.find((i) => i.key === openKey) ?? null;
  const attentionItems = allItems.filter((i) => i.signal === "atencao");

  return (
    <div className="flex flex-col gap-5">
      {header}

      {/* Os três sinais: blocos, número grande, cor. */}
      <div className="grid grid-cols-3 gap-2">
        {(["favoravel", "neutro", "atencao"] as OverviewSignal[]).map((s) => (
          <div key={s} className={`rounded-2xl py-3 text-center ${SIGNAL_BG[s]}`}>
            <p className={`text-3xl font-extrabold leading-none ${SIGNAL_TEXT[s]}`}>{laudo.counts[s]}</p>
            <p className={`mt-1 text-[11px] ${SIGNAL_TEXT[s]}`}>{SIGNAL_LABEL[s]}</p>
          </div>
        ))}
      </div>

      <p className="text-sm text-ink-muted">
        {atencao.text}
        {atencao.names.length > 0 && (
          <>
            {" "}
            <span className="font-semibold text-danger">{atencao.names.join(", ")}</span>.
          </>
        )}
      </p>

      {changes.length > 0 && (
        <Card className="flex flex-col gap-1.5 border-accent/40 bg-accent-soft/40 p-4">
          <p className="text-sm font-semibold text-ink">Mudou desde a última leitura</p>
          {changes.map((c) => (
            <p key={c.key} className="text-caption text-ink-muted">
              {FRIENDLY_LABEL[c.key] ?? c.label}: {c.fromValue} → {c.toValue}{" "}
              <span className={SIGNAL_TEXT[c.to ?? "neutro"]}>({c.to ? SIGNAL_LABEL[c.to] : "—"})</span>
            </p>
          ))}
        </Card>
      )}

      {laudo.facts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {laudo.facts.map((f) => (
            <span key={f.label} className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] text-ink-muted">
              {f.label}: <span className="text-ink">{f.value}</span>
            </span>
          ))}
        </div>
      )}

      {/* Um termômetro por pergunta. */}
      <div className="flex flex-col gap-2.5">
        {laudo.sections.map((section) => (
          <Gauge key={section.id} section={section} />
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button type="button" onClick={toggleNumbers} className="text-sm font-medium text-accent-strong hover:underline">
          {showNumbers ? "Esconder os números" : `Ver os ${allItems.length} números ›`}
        </button>
        <button
          type="button"
          onClick={() => setShowCaveat((v) => !v)}
          aria-label="Como ler estes sinais"
          aria-expanded={showCaveat}
          className={`rounded-full p-1.5 transition-colors ${showCaveat ? "bg-surface-2 text-ink" : "text-ink-faint hover:text-ink"}`}
        >
          <HelpCircle size={18} strokeWidth={1.75} />
        </button>
      </div>
      {showCaveat && <p className="-mt-2 text-caption leading-relaxed text-ink-muted">{laudo.caveat}</p>}

      {/* A grade: só número e cor. Tocou, a explicação aparece embaixo. */}
      {showNumbers && (
        <div className="flex flex-col gap-2.5">
          <div className="grid grid-cols-3 gap-2">
            {allItems.map((item) => (
              <NumberTile
                key={item.key}
                item={item}
                open={openKey === item.key}
                onToggle={() => setOpenKey(openKey === item.key ? null : item.key)}
              />
            ))}
          </div>
          {(openItem ? [openItem] : attentionItems).map((item) => (
            <Explanation key={item.key} item={item} />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            setError(null);
            read();
          }}
          disabled={reading}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-strong hover:underline disabled:opacity-50"
        >
          <RefreshCw size={14} strokeWidth={2} className={reading ? "animate-spin" : ""} />
          {reading ? "Lendo…" : "Reanalisar agora"}
        </button>
        <span className="text-caption text-ink-faint">lida em {formatReadAt(laudo.readAt)}</span>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

/** A nota como anel: 8,8 de 10 vira 88% de arco. Cor pelo terço em que cai. */
function ScoreRing({ score }: { score: number }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, score / 10));
  const cor = score >= 7 ? "var(--color-success)" : score >= 4 ? "var(--color-accent)" : "var(--color-danger)";
  return (
    <svg width="104" height="104" viewBox="0 0 104 104" role="img" aria-label={`Nota automática ${score.toFixed(1).replace(".", ",")} de 10`} className="shrink-0">
      <circle cx="52" cy="52" r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth="11" />
      <circle
        cx="52"
        cy="52"
        r={r}
        fill="none"
        stroke={cor}
        strokeWidth="11"
        strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`}
        transform="rotate(-90 52 52)"
        style={{ transition: "stroke-dasharray 700ms cubic-bezier(0.2, 0, 0, 1)" }}
      />
      <text x="52" y="50" textAnchor="middle" fill="var(--color-ink)" fontSize="26" fontWeight="800">
        {score.toFixed(1).replace(".", ",")}
      </text>
      <text x="52" y="67" textAnchor="middle" fill="var(--color-ink-faint)" fontSize="11">
        de 10
      </text>
    </svg>
  );
}

function RingPlaceholder() {
  return <div className="size-[104px] shrink-0 rounded-full border-[11px] border-surface-2" aria-hidden />;
}

/**
 * O termômetro: faixa vermelha → cinza → verde, marcador onde a média dos selos cai, o
 * rótulo curto à direita da pergunta e os dois primeiros números embaixo. Frase só quando
 * há atenção — e é uma.
 */
function Gauge({ section }: { section: LaudoSection }) {
  const g = sectionGauge(section);
  const scale = SECTION_SCALE[section.id] ?? { low: "ruim", high: "bom", mid: "na média" };
  const atencao = section.items.filter((i) => i.signal === "atencao");
  const chave = section.items.slice(0, 2);
  return (
    <Card className={`flex flex-col gap-3 p-4 ${g.signal === "atencao" ? "border-danger/40 bg-danger-soft/30" : ""}`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[15px] font-semibold text-ink">{section.question}</p>
        <p className={`shrink-0 text-sm font-bold ${SIGNAL_TEXT[g.signal]}`}>{g.label}</p>
      </div>
      <div className="relative pt-1">
        <div
          className="h-2.5 rounded-full opacity-90"
          style={{ background: "linear-gradient(90deg, var(--color-danger) 0 33%, var(--color-ink-faint) 33% 66%, var(--color-success) 66% 100%)" }}
        />
        <span
          className={`absolute top-0 size-[18px] -translate-x-1/2 rounded-full border-[3px] bg-canvas ${SIGNAL_BORDER[g.signal]}`}
          style={{ left: `${g.position * 100}%`, transition: "left 700ms cubic-bezier(0.2, 0, 0, 1)" }}
          aria-hidden
        />
      </div>
      <div className="flex items-baseline justify-between gap-2 text-[11px] text-ink-faint">
        <span>{scale.low}</span>
        <span className="truncate text-center">
          {chave.map((i, idx) => (
            <span key={i.key}>
              {idx > 0 && " · "}
              {(SHORT_LABEL[i.key] ?? technicalLabel(i)).toLowerCase()}{" "}
              <b className={i.signal === "atencao" ? "text-danger" : "text-ink"}>{compactValue(i.value)}</b>
            </span>
          ))}
        </span>
        <span>{scale.high}</span>
      </div>
      {atencao.map((i) => (
        <p key={i.key} className="text-caption leading-relaxed text-danger">
          {i.plain}.
        </p>
      ))}
    </Card>
  );
}

function NumberTile({ item, open, onToggle }: { item: LaudoItem; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={`rounded-xl border-t-[3px] px-2.5 py-3 text-left transition-all ${SIGNAL_BG[item.signal]} ${SIGNAL_BORDER[item.signal]} ${
        open ? "ring-2 ring-accent/70" : item.signal === "atencao" ? "ring-2 ring-danger/50" : ""
      }`}
    >
      <p className={`text-[22px] font-extrabold leading-none tracking-tight ${item.signal === "atencao" ? "text-danger" : "text-ink"}`}>
        {compactValue(item.value)}
      </p>
      <p className={`mt-1.5 truncate text-[11px] ${item.signal === "atencao" ? "text-danger" : "text-ink-muted"}`}>
        {SHORT_LABEL[item.key] ?? technicalLabel(item)}
      </p>
    </button>
  );
}

function Explanation({ item }: { item: LaudoItem }) {
  const bad = item.signal === "atencao";
  return (
    <div className={`rounded-lg px-3 py-2 ${bad ? "border border-danger/30 bg-danger-soft/40" : "bg-surface-2/60"}`}>
      <p className={`text-caption leading-relaxed ${bad ? "text-danger" : "text-ink"}`}>
        <span className="font-semibold">{FRIENDLY_LABEL[item.key] ?? technicalLabel(item)}</span> — {item.plain}.
        <span className="text-ink-faint"> Régua: {item.reference}.</span>
      </p>
    </div>
  );
}
